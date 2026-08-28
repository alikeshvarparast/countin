import { desc, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { ChatRoom } from "@/components/chat-room";
import { db } from "@/lib/db";
import { chatMessages, chatReactions, users } from "@/lib/db/schema";
import { getCommunityBySlug } from "@/lib/access";
import { getChatLastReadAt } from "@/lib/chat";
import { notFound } from "next/navigation";

export default async function ChatPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const community = getCommunityBySlug(slug);
  if (!community) notFound();
  const session = await auth();
  if (!session?.user?.id) return null;

  const rows = db
    .select({
      message: chatMessages,
      user: users,
    })
    .from(chatMessages)
    .innerJoin(users, eq(users.id, chatMessages.userId))
    .where(eq(chatMessages.communityId, community.id))
    .orderBy(desc(chatMessages.createdAt))
    .all()
    .slice(0, 120)
    .reverse();

  const ids = rows.map((r) => r.message.id);
  const reactionRows =
    ids.length === 0
      ? []
      : db
          .select()
          .from(chatReactions)
          .where(inArray(chatReactions.messageId, ids))
          .all();

  const reactionMap = new Map<string, { emoji: string; count: number; mine: boolean }[]>();
  for (const row of reactionRows) {
    const list = reactionMap.get(row.messageId) ?? [];
    const existing = list.find((r) => r.emoji === row.emoji);
    const mine = row.userId === session.user.id;
    if (existing) {
      existing.count += 1;
      existing.mine = existing.mine || mine;
    } else {
      list.push({ emoji: row.emoji, count: 1, mine });
    }
    reactionMap.set(row.messageId, list);
  }

  const byId = new Map(rows.map((r) => [r.message.id, r]));
  const missingParentIds = [
    ...new Set(rows.map((r) => r.message.replyToId).filter((id): id is string => typeof id === "string" && !byId.has(id))),
  ];
  const extraParents =
    missingParentIds.length === 0
      ? []
      : db
          .select({
            message: chatMessages,
            user: users,
          })
          .from(chatMessages)
          .innerJoin(users, eq(users.id, chatMessages.userId))
          .where(inArray(chatMessages.id, missingParentIds))
          .all();
  for (const row of extraParents) byId.set(row.message.id, row);

  const lastReadAt = getChatLastReadAt(community.id, session.user.id);
  const firstUnreadId =
    rows.find((r) => r.message.userId !== session.user.id && r.message.createdAt > lastReadAt)?.message.id ?? null;

  return (
    <ChatRoom
      key={community.id}
      slug={slug}
      currentUserId={session.user.id}
      firstUnreadId={firstUnreadId}
      messages={rows.map(({ message, user }) => {
        const parent = message.replyToId ? byId.get(message.replyToId) : undefined;
        return {
          id: message.id,
          body: message.body,
          createdAt: message.createdAt,
          replyTo: parent
            ? { id: parent.message.id, body: parent.message.body, name: parent.user.name }
            : null,
          reactions: reactionMap.get(message.id) ?? [],
          user: { id: user.id, name: user.name, imageUrl: user.imageUrl },
        };
      })}
    />
  );
}
