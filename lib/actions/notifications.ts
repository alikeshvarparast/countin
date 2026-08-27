"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { now } from "@/lib/id";

export async function markNotificationRead(id: string) {
  const user = await requireUser();
  const row = db.select().from(notifications).where(eq(notifications.id, id)).get();
  if (!row || row.userId !== user.id) return { error: "Not found." };
  if (!row.readAt) {
    db.update(notifications).set({ readAt: now() }).where(eq(notifications.id, id)).run();
  }
  revalidatePath("/app/notifications");
  return { ok: true };
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  const unread = db.select().from(notifications).where(eq(notifications.userId, user.id)).all();
  const t = now();
  for (const row of unread) {
    if (!row.readAt) {
      db.update(notifications).set({ readAt: t }).where(eq(notifications.id, row.id)).run();
    }
  }
  revalidatePath("/app/notifications");
  revalidatePath("/app");
  return { ok: true };
}
