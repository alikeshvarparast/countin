import { and, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  notificationDeliveries,
  notifications,
  users,
} from "@/lib/db/schema";
import { createId, now } from "@/lib/id";
import { sendTelegramMessage } from "@/lib/telegram";
import { sendWhatsAppMessage, whatsappEnabled } from "@/lib/whatsapp";

export type NotifyInput = {
  userId: string;
  communityId?: string | null;
  type: string;
  title: string;
  body: string;
  href?: string | null;
};

const MAX_ATTEMPTS = 8;

function backoffMs(attempts: number) {
  const minutes = Math.min(60 * 6, 1 * 5 ** Math.min(attempts, 4));
  return minutes * 60 * 1000;
}

export async function notify(input: NotifyInput) {
  const createdAt = now();
  const notificationId = createId();
  db.insert(notifications)
    .values({
      id: notificationId,
      userId: input.userId,
      communityId: input.communityId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
      readAt: null,
      createdAt,
    })
    .run();

  db.insert(notificationDeliveries)
    .values({
      id: createId(),
      notificationId,
      channel: "in_app",
      status: "sent",
      attempts: 1,
      createdAt,
      sentAt: createdAt,
    })
    .run();

  const telegramDeliveryId = createId();
  db.insert(notificationDeliveries)
    .values({
      id: telegramDeliveryId,
      notificationId,
      channel: "telegram",
      status: "pending",
      attempts: 0,
      nextRetryAt: createdAt,
      createdAt,
    })
    .run();

  if (whatsappEnabled()) {
    db.insert(notificationDeliveries)
      .values({
        id: createId(),
        notificationId,
        channel: "whatsapp",
        status: "pending",
        attempts: 0,
        nextRetryAt: createdAt,
        createdAt,
      })
      .run();
  }

  await deliverOne(telegramDeliveryId);
  return notificationId;
}

export async function notifyMany(userIds: string[], input: Omit<NotifyInput, "userId">) {
  const unique = [...new Set(userIds)];
  for (const userId of unique) {
    await notify({ ...input, userId });
  }
}

async function deliverOne(deliveryId: string) {
  const delivery = db
    .select()
    .from(notificationDeliveries)
    .where(eq(notificationDeliveries.id, deliveryId))
    .get();
  if (!delivery || delivery.status === "sent" || delivery.status === "skipped") return;

  const notification = db
    .select()
    .from(notifications)
    .where(eq(notifications.id, delivery.notificationId))
    .get();
  if (!notification) return;

  const user = db.select().from(users).where(eq(users.id, notification.userId)).get();
  if (!user) return;

  const text = `${notification.title}\n\n${notification.body}${
    notification.href ? `\n\nOpen: ${absoluteHref(notification.href)}` : ""
  }`;

  if (delivery.channel === "telegram") {
    if (!user.telegramChatId) {
      markDelivery(delivery.id, {
        status: "failed",
        lastError: "Telegram is not linked. Open the bot with your start link.",
        retryable: false,
      });
      return;
    }
    const result = await sendTelegramMessage(user.telegramChatId, text);
    if (result.ok) {
      markDelivery(delivery.id, {
        status: "sent",
        providerMessageId: result.messageId,
      });
    } else {
      markDelivery(delivery.id, {
        status: result.retryable ? "pending" : "failed",
        lastError: result.error,
        retryable: result.retryable,
      });
    }
    return;
  }

  if (delivery.channel === "whatsapp") {
    if (!user.whatsappPhone) {
      markDelivery(delivery.id, {
        status: "failed",
        lastError: "No WhatsApp number on file.",
        retryable: false,
      });
      return;
    }
    const result = await sendWhatsAppMessage(user.whatsappPhone, text);
    if (result.ok) {
      markDelivery(delivery.id, {
        status: "sent",
        providerMessageId: result.messageId,
      });
    } else {
      markDelivery(delivery.id, {
        status: result.retryable ? "pending" : "failed",
        lastError: result.error,
        retryable: result.retryable,
      });
    }
  }
}

function absoluteHref(href: string) {
  if (href.startsWith("http")) return href;
  const base = process.env.AUTH_URL || "http://localhost:3000";
  return `${base}${href}`;
}

function markDelivery(
  id: string,
  input: {
    status: "sent" | "pending" | "failed" | "skipped";
    lastError?: string;
    providerMessageId?: string;
    retryable?: boolean;
  },
) {
  const current = db
    .select()
    .from(notificationDeliveries)
    .where(eq(notificationDeliveries.id, id))
    .get();
  if (!current) return;
  const attempts = current.attempts + 1;
  const t = now();
  const nextRetryAt =
    input.status === "pending" && input.retryable && attempts < MAX_ATTEMPTS
      ? t + backoffMs(attempts)
      : null;
  const status =
    input.status === "pending" && (!input.retryable || attempts >= MAX_ATTEMPTS)
      ? "failed"
      : input.status;

  db.update(notificationDeliveries)
    .set({
      status,
      lastError: input.lastError ?? current.lastError,
      providerMessageId: input.providerMessageId ?? current.providerMessageId,
      attempts,
      nextRetryAt,
      sentAt: status === "sent" ? t : current.sentAt,
    })
    .where(eq(notificationDeliveries.id, id))
    .run();
}

export async function retryPendingDeliveries(limit = 40) {
  const t = now();
  const rows = db
    .select()
    .from(notificationDeliveries)
    .where(
      and(
        inArray(notificationDeliveries.channel, ["telegram", "whatsapp"]),
        or(
          eq(notificationDeliveries.status, "pending"),
          and(
            eq(notificationDeliveries.status, "failed"),
            lte(notificationDeliveries.attempts, MAX_ATTEMPTS - 1),
          ),
        ),
        or(isNull(notificationDeliveries.nextRetryAt), lte(notificationDeliveries.nextRetryAt, t)),
      ),
    )
    .all()
    .slice(0, limit);

  for (const row of rows) {
    if (row.status === "failed" && row.lastError && !isRetryableError(row.lastError)) {
      continue;
    }
    await deliverOne(row.id);
  }
  return rows.length;
}

function isRetryableError(message: string) {
  return /network|timeout|429|5\d\d|unavailable/i.test(message);
}
