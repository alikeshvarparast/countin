import fs from "node:fs";
import path from "node:path";
import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { createId, now } from "@/lib/id";
import { publicAppUrl } from "@/lib/telegram";
import { countAppBadge } from "@/lib/unread";

export type PushPayload = {
  title: string;
  body: string;
  href?: string | null;
  unreadCount?: number;
  tag?: string;
};

type VapidKeys = { publicKey: string; privateKey: string };

let cachedKeys: VapidKeys | null = null;

function vapidPath() {
  return path.join(process.cwd(), "data", "vapid.json");
}

export function getVapidKeys(): VapidKeys {
  if (cachedKeys) return cachedKeys;
  const fromEnv = {
    publicKey: process.env.VAPID_PUBLIC_KEY?.trim() ?? "",
    privateKey: process.env.VAPID_PRIVATE_KEY?.trim() ?? "",
  };
  if (fromEnv.publicKey && fromEnv.privateKey) {
    cachedKeys = fromEnv;
    return cachedKeys;
  }
  const file = vapidPath();
  if (fs.existsSync(file)) {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as VapidKeys;
    if (parsed.publicKey && parsed.privateKey) {
      cachedKeys = parsed;
      return cachedKeys;
    }
  }
  const generated = webpush.generateVAPIDKeys();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(generated, null, 2));
  cachedKeys = generated;
  return cachedKeys;
}

function vapidSubject() {
  const explicit = process.env.VAPID_SUBJECT?.trim();
  if (explicit) return explicit;
  try {
    const host = new URL(publicAppUrl() || "http://localhost:3000").hostname;
    return `mailto:hello@${host}`;
  } catch {
    return "mailto:hello@localhost";
  }
}

function configureWebPush() {
  const keys = getVapidKeys();
  webpush.setVapidDetails(vapidSubject(), keys.publicKey, keys.privateKey);
}

export function savePushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}) {
  const t = now();
  const existing = db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, input.endpoint))
    .get();
  if (existing) {
    db.update(pushSubscriptions)
      .set({
        userId: input.userId,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? existing.userAgent,
        updatedAt: t,
      })
      .where(eq(pushSubscriptions.id, existing.id))
      .run();
    return existing.id;
  }
  const id = createId();
  db.insert(pushSubscriptions)
    .values({
      id,
      userId: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
      createdAt: t,
      updatedAt: t,
    })
    .run();
  return id;
}

export function deletePushSubscription(endpoint: string, userId?: string) {
  const row = db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).get();
  if (!row) return;
  if (userId && row.userId !== userId) return;
  db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, row.id)).run();
}

export function userHasPushSubscription(userId: string) {
  return Boolean(db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)).get());
}

function isGoneStatus(statusCode?: number) {
  return statusCode === 404 || statusCode === 410;
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const rows = db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)).all();
  if (rows.length === 0) return { ok: true, sent: 0 };

  configureWebPush();
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    href: payload.href ?? "/app/notifications",
    unreadCount: payload.unreadCount ?? countAppBadge(userId),
    tag: payload.tag,
  });

  let sent = 0;
  let lastError = "";
  let retryable = false;

  for (const row of rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        body,
      );
      sent += 1;
    } catch (error) {
      const statusCode =
        typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode?: number }).statusCode)
          : undefined;
      if (isGoneStatus(statusCode)) {
        db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, row.id)).run();
        continue;
      }
      lastError = error instanceof Error ? error.message : "Push delivery failed.";
      retryable = statusCode === 429 || (statusCode !== undefined && statusCode >= 500) || statusCode === undefined;
    }
  }

  if (sent > 0) return { ok: true, sent };
  if (!lastError) return { ok: true, sent: 0 };
  return { ok: false, sent: 0, error: lastError, retryable };
}
