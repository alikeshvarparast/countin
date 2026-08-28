import { and, count, eq, gt, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages, chatReads } from "@/lib/db/schema";
import { now } from "@/lib/id";

export function getChatLastReadAt(communityId: string, userId: string) {
  return (
    db
      .select()
      .from(chatReads)
      .where(and(eq(chatReads.communityId, communityId), eq(chatReads.userId, userId)))
      .get()?.lastReadAt ?? 0
  );
}

export function countUnreadChat(communityId: string, userId: string) {
  const lastReadAt = getChatLastReadAt(communityId, userId);
  return (
    db
      .select({ n: count() })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.communityId, communityId),
          gt(chatMessages.createdAt, lastReadAt),
          ne(chatMessages.userId, userId),
        ),
      )
      .get()?.n ?? 0
  );
}

export function upsertChatRead(communityId: string, userId: string, at = now()) {
  const existing = db
    .select()
    .from(chatReads)
    .where(and(eq(chatReads.communityId, communityId), eq(chatReads.userId, userId)))
    .get();
  if (existing) {
    if (at > existing.lastReadAt) {
      db.update(chatReads)
        .set({ lastReadAt: at })
        .where(and(eq(chatReads.communityId, communityId), eq(chatReads.userId, userId)))
        .run();
    }
    return;
  }
  db.insert(chatReads)
    .values({ communityId, userId, lastReadAt: at })
    .run();
}
