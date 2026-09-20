import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createId, now } from "@/lib/id";

export const OFFLINE_PAYER_ROLE = "offline";

export function isOfflinePayer(user: { platformRole?: string | null; email?: string | null } | null | undefined) {
  if (!user) return false;
  if (user.platformRole === OFFLINE_PAYER_ROLE) return true;
  return Boolean(user.email?.endsWith("@offline.countin.local"));
}

/** Placeholder account for someone who is not on the app — share only, no membership/notifs. */
export function createOfflinePayer(name: string) {
  const label = name.trim().slice(0, 80);
  if (label.length < 1) throw new Error("Name required.");
  const id = createId();
  db.insert(users)
    .values({
      id,
      name: label,
      email: `offline-${id}@offline.countin.local`,
      passwordHash: "!",
      telegramUsername: "offline",
      platformRole: OFFLINE_PAYER_ROLE,
      createdAt: now(),
    })
    .run();
  return id;
}

export function getOfflinePayerIds(userIds: string[]) {
  if (userIds.length === 0) return new Set<string>();
  const offline = new Set<string>();
  for (const id of userIds) {
    const row = db.select().from(users).where(eq(users.id, id)).get();
    if (isOfflinePayer(row)) offline.add(id);
  }
  return offline;
}
