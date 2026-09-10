import { and, eq, isNull } from "drizzle-orm";
import { listMemberClubs } from "@/lib/access";
import { countUnreadChat } from "@/lib/chat";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";

export function countInboxUnread(userId: string) {
  return db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .all().length;
}

export function countChatUnreadAll(userId: string) {
  return listMemberClubs(userId).reduce((sum, club) => sum + countUnreadChat(club.id, userId), 0);
}

export function countAppBadge(userId: string) {
  return countInboxUnread(userId) + countChatUnreadAll(userId);
}
