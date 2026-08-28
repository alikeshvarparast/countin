"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/auth";
import { getClubMembership, getCommunityBySlug, listApprovedMembers, requireAdmin, requireActiveMember, requireMember } from "@/lib/access";
import { upsertChatRead } from "@/lib/chat";
import { db } from "@/lib/db";
import {
  chatMessages,
  chatReactions,
  clubPollOptions,
  clubPollVotes,
  clubPolls,
  communities,
} from "@/lib/db/schema";
import { createId, now } from "@/lib/id";
import { notifyMany } from "@/lib/notify";
import { localInputToMs } from "@/lib/utils";
import { currentClubVotes, logVote } from "@/lib/votes";

export async function sendChatMessage(formData: FormData) {
  const user = await requireUser();
  const slug = String(formData.get("slug") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const community = getCommunityBySlug(slug);
  if (!community) return { error: "Community not found." };
  requireMember(community.id, user.id);
  if (body.length < 1) return { error: "Write a message." };
  if (body.length > 2000) return { error: "Keep messages under 2000 characters." };

  const replyToId = String(formData.get("replyToId") ?? "").trim() || null;
  if (replyToId) {
    const parent = db.select().from(chatMessages).where(eq(chatMessages.id, replyToId)).get();
    if (!parent || parent.communityId !== community.id) return { error: "Reply target not found." };
  }

  const createdAt = now();
  db.insert(chatMessages)
    .values({
      id: createId(),
      communityId: community.id,
      userId: user.id,
      body,
      replyToId,
      createdAt,
    })
    .run();

  upsertChatRead(community.id, user.id, createdAt);
  revalidatePath(`/app/c/${slug}/chat`);
  revalidatePath(`/app/c/${slug}`, "layout");
  return { ok: true };
}

export async function markChatRead(slug: string) {
  const user = await requireUser();
  const community = getCommunityBySlug(slug);
  if (!community) return { error: "Community not found." };
  if (!getClubMembership(community.id, user.id)) return { error: "Not a member." };
  upsertChatRead(community.id, user.id);
  revalidatePath(`/app/c/${slug}`, "layout");
  return { ok: true };
}

const CHAT_EMOJIS = new Set(["👍", "❤️", "😂", "🔥", "⚽", "👏"]);

export async function toggleChatReaction(formData: FormData) {
  const user = await requireUser();
  const slug = String(formData.get("slug") ?? "");
  const messageId = String(formData.get("messageId") ?? "");
  const emoji = String(formData.get("emoji") ?? "").trim();
  const community = getCommunityBySlug(slug);
  if (!community) return { error: "Community not found." };
  requireMember(community.id, user.id);
  if (!CHAT_EMOJIS.has(emoji)) return { error: "Pick a supported reaction." };

  const message = db.select().from(chatMessages).where(eq(chatMessages.id, messageId)).get();
  if (!message || message.communityId !== community.id) return { error: "Message not found." };

  const existing = db
    .select()
    .from(chatReactions)
    .where(
      and(eq(chatReactions.messageId, messageId), eq(chatReactions.userId, user.id), eq(chatReactions.emoji, emoji)),
    )
    .get();

  if (existing) {
    db.delete(chatReactions).where(eq(chatReactions.id, existing.id)).run();
  } else {
    db.insert(chatReactions)
      .values({
        id: createId(),
        messageId,
        userId: user.id,
        emoji,
        createdAt: now(),
      })
      .run();
  }

  revalidatePath(`/app/c/${slug}/chat`);
  return { ok: true };
}

export async function createClubPoll(formData: FormData) {
  const user = await requireUser();
  const slug = String(formData.get("slug") ?? "");
  const community = getCommunityBySlug(slug);
  if (!community) return { error: "Community not found." };
  requireAdmin(community.id, user.id);

  const question = String(formData.get("question") ?? "").trim();
  const options = formData
    .getAll("option")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const closesAt = localInputToMs(String(formData.get("closesAt") ?? ""));

  if (question.length < 2) return { error: "Ask a question." };
  if (options.length < 2) return { error: "Add at least two options." };

  const pollId = createId();
  db.insert(clubPolls)
    .values({
      id: pollId,
      communityId: community.id,
      question,
      createdById: user.id,
      closesAt,
      createdAt: now(),
    })
    .run();

  for (const label of options) {
    db.insert(clubPollOptions)
      .values({
        id: createId(),
        pollId,
        label,
      })
      .run();
  }

  await notifyMany(
    listApprovedMembers(community.id)
      .map((m) => m.userId)
      .filter((id) => id !== user.id),
    {
      communityId: community.id,
      type: "new_poll",
      title: `Poll · ${community.name}`,
      body: question,
      href: `/app/c/${community.slug}`,
    },
  );

  revalidatePath(`/app/c/${slug}`);
  return { ok: true, id: pollId };
}

export async function voteClubPoll(formData: FormData) {
  const user = await requireUser();
  const optionId = String(formData.get("optionId") ?? "");
  const option = db.select().from(clubPollOptions).where(eq(clubPollOptions.id, optionId)).get();
  if (!option) return { error: "Option not found." };
  const poll = db.select().from(clubPolls).where(eq(clubPolls.id, option.pollId)).get();
  if (!poll) return { error: "Poll not found." };
  if (poll.closesAt && now() > poll.closesAt) return { error: "This poll has closed." };
  requireActiveMember(poll.communityId, user.id);
  const community = db.select().from(communities).where(eq(communities.id, poll.communityId)).get();

  const { votes: existing } = currentClubVotes(poll.id);
  const mine = existing.filter((v) => v.userId === user.id);
  const previousOptionId = mine[0]?.optionId ?? null;
  for (const vote of mine) {
    db.delete(clubPollVotes).where(eq(clubPollVotes.id, vote.id)).run();
  }

  db.insert(clubPollVotes)
    .values({
      id: createId(),
      optionId,
      userId: user.id,
      createdAt: now(),
    })
    .run();
  logVote({
    kind: "club",
    pollId: poll.id,
    userId: user.id,
    actorId: user.id,
    optionId,
    previousOptionId,
    action: previousOptionId ? "change" : "cast",
  });

  if (community) revalidatePath(`/app/c/${community.slug}`);
  return { ok: true };
}
