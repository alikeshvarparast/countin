"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/auth";
import { requireActiveMember, requireAdmin } from "@/lib/access";
import { db } from "@/lib/db";
import {
  clubPollOptions,
  clubPollVotes,
  clubPolls,
  communities,
  pollOptions,
  polls,
  pollSuggestions,
  voteLogs,
  votes,
  weeklyEvents,
} from "@/lib/db/schema";
import { createId, now } from "@/lib/id";
import { localInputToMs } from "@/lib/utils";
import { currentClubVotes, currentEventVotes, logVote } from "@/lib/votes";

function revalidatePoll(kind: "club" | "event", pollId: string) {
  if (kind === "club") {
    const poll = db.select().from(clubPolls).where(eq(clubPolls.id, pollId)).get();
    if (!poll) return;
    const community = db.select().from(communities).where(eq(communities.id, poll.communityId)).get();
    if (community) revalidatePath(`/app/c/${community.slug}`);
    return;
  }
  const poll = db.select().from(polls).where(eq(polls.id, pollId)).get();
  if (!poll) return;
  const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, poll.eventId)).get();
  if (!event) return;
  const community = db.select().from(communities).where(eq(communities.id, event.communityId)).get();
  if (community) {
    revalidatePath(`/app/c/${community.slug}`);
    revalidatePath(`/app/c/${community.slug}/events/${event.id}`);
  }
}

function communityIdForPoll(kind: "club" | "event", pollId: string) {
  if (kind === "club") {
    return db.select().from(clubPolls).where(eq(clubPolls.id, pollId)).get()?.communityId ?? null;
  }
  const poll = db.select().from(polls).where(eq(polls.id, pollId)).get();
  if (!poll) return null;
  return db.select().from(weeklyEvents).where(eq(weeklyEvents.id, poll.eventId)).get()?.communityId ?? null;
}

export async function suggestPollOption(formData: FormData) {
  const user = await requireUser();
  const kind = String(formData.get("kind") ?? "") === "event" ? "event" : "club";
  const pollId = String(formData.get("pollId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  if (label.length < 2) return { error: "Describe the option." };
  const communityId = communityIdForPoll(kind, pollId);
  if (!communityId) return { error: "Poll not found." };
  requireActiveMember(communityId, user.id);
  db.insert(pollSuggestions)
    .values({
      id: createId(),
      kind,
      pollId,
      label,
      suggestedById: user.id,
      status: "pending",
      createdAt: now(),
    })
    .run();
  revalidatePoll(kind, pollId);
  return { ok: true };
}

export async function acceptPollSuggestion(formData: FormData) {
  const user = await requireUser();
  const suggestionId = String(formData.get("suggestionId") ?? "");
  const row = db.select().from(pollSuggestions).where(eq(pollSuggestions.id, suggestionId)).get();
  if (!row) return { error: "Suggestion not found." };
  const communityId = communityIdForPoll(row.kind as "club" | "event", row.pollId);
  if (!communityId) return { error: "Poll not found." };
  requireAdmin(communityId, user.id);
  if (row.kind === "club") {
    db.insert(clubPollOptions)
      .values({ id: createId(), pollId: row.pollId, label: row.label })
      .run();
  } else {
    db.insert(pollOptions)
      .values({
        id: createId(),
        pollId: row.pollId,
        label: row.label,
        startsAt: localInputToMs(row.label),
      })
      .run();
  }
  db.update(pollSuggestions).set({ status: "accepted" }).where(eq(pollSuggestions.id, row.id)).run();
  revalidatePoll(row.kind as "club" | "event", row.pollId);
  return { ok: true };
}

export async function adminSetVote(formData: FormData) {
  const user = await requireUser();
  const kind = String(formData.get("kind") ?? "") === "event" ? "event" : "club";
  const pollId = String(formData.get("pollId") ?? "");
  const targetUserId = String(formData.get("userId") ?? "");
  const optionId = String(formData.get("optionId") ?? "");
  const communityId = communityIdForPoll(kind, pollId);
  if (!communityId) return { error: "Poll not found." };
  requireAdmin(communityId, user.id);

  if (kind === "club") {
    const { votes: existing } = currentClubVotes(pollId);
    const mine = existing.filter((v) => v.userId === targetUserId);
    const previousOptionId = mine[0]?.optionId ?? null;
    for (const v of mine) db.delete(clubPollVotes).where(eq(clubPollVotes.id, v.id)).run();
    db.insert(clubPollVotes)
      .values({ id: createId(), optionId, userId: targetUserId, createdAt: now() })
      .run();
    logVote({
      kind: "club",
      pollId,
      userId: targetUserId,
      actorId: user.id,
      optionId,
      previousOptionId,
      action: "admin_edit",
    });
  } else {
    const { votes: existing } = currentEventVotes(pollId);
    const mine = existing.filter((v) => v.userId === targetUserId);
    const previousOptionId = mine[0]?.optionId ?? null;
    for (const v of mine) db.delete(votes).where(eq(votes.id, v.id)).run();
    db.insert(votes)
      .values({ id: createId(), optionId, userId: targetUserId, createdAt: now() })
      .run();
    logVote({
      kind: "event",
      pollId,
      userId: targetUserId,
      actorId: user.id,
      optionId,
      previousOptionId,
      action: "admin_edit",
    });
  }
  revalidatePoll(kind, pollId);
  return { ok: true };
}

export async function adminDeleteVote(formData: FormData) {
  const user = await requireUser();
  const kind = String(formData.get("kind") ?? "") === "event" ? "event" : "club";
  const pollId = String(formData.get("pollId") ?? "");
  const targetUserId = String(formData.get("userId") ?? "");
  const communityId = communityIdForPoll(kind, pollId);
  if (!communityId) return { error: "Poll not found." };
  requireAdmin(communityId, user.id);

  if (kind === "club") {
    const { votes: existing } = currentClubVotes(pollId);
    const mine = existing.filter((v) => v.userId === targetUserId);
    const previousOptionId = mine[0]?.optionId ?? null;
    for (const v of mine) db.delete(clubPollVotes).where(eq(clubPollVotes.id, v.id)).run();
    logVote({
      kind: "club",
      pollId,
      userId: targetUserId,
      actorId: user.id,
      previousOptionId,
      action: "delete",
    });
  } else {
    const { votes: existing } = currentEventVotes(pollId);
    const mine = existing.filter((v) => v.userId === targetUserId);
    const previousOptionId = mine[0]?.optionId ?? null;
    for (const v of mine) db.delete(votes).where(eq(votes.id, v.id)).run();
    logVote({
      kind: "event",
      pollId,
      userId: targetUserId,
      actorId: user.id,
      previousOptionId,
      action: "delete",
    });
  }
  revalidatePoll(kind, pollId);
  return { ok: true };
}

export async function addPollOption(formData: FormData) {
  const user = await requireUser();
  const kind = String(formData.get("kind") ?? "") === "event" ? "event" : "club";
  const pollId = String(formData.get("pollId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  if (label.length < 2) return { error: "Describe the option." };
  const communityId = communityIdForPoll(kind, pollId);
  if (!communityId) return { error: "Poll not found." };
  requireAdmin(communityId, user.id);
  if (kind === "club") {
    db.insert(clubPollOptions)
      .values({ id: createId(), pollId, label })
      .run();
  } else {
    db.insert(pollOptions)
      .values({
        id: createId(),
        pollId,
        label,
        startsAt: localInputToMs(label),
      })
      .run();
  }
  revalidatePoll(kind, pollId);
  return { ok: true };
}

export async function deletePoll(formData: FormData) {
  const user = await requireUser();
  const kind = String(formData.get("kind") ?? "") === "event" ? "event" : "club";
  const pollId = String(formData.get("pollId") ?? "");
  const communityId = communityIdForPoll(kind, pollId);
  if (!communityId) return { error: "Poll not found." };
  requireAdmin(communityId, user.id);

  db.delete(voteLogs)
    .where(and(eq(voteLogs.kind, kind), eq(voteLogs.pollId, pollId)))
    .run();
  db.delete(pollSuggestions)
    .where(and(eq(pollSuggestions.kind, kind), eq(pollSuggestions.pollId, pollId)))
    .run();

  if (kind === "club") {
    const options = db.select().from(clubPollOptions).where(eq(clubPollOptions.pollId, pollId)).all();
    for (const option of options) {
      db.delete(clubPollVotes).where(eq(clubPollVotes.optionId, option.id)).run();
    }
    db.delete(clubPollOptions).where(eq(clubPollOptions.pollId, pollId)).run();
    db.delete(clubPolls).where(eq(clubPolls.id, pollId)).run();
  } else {
    const options = db.select().from(pollOptions).where(eq(pollOptions.pollId, pollId)).all();
    for (const option of options) {
      db.delete(votes).where(eq(votes.optionId, option.id)).run();
    }
    db.delete(pollOptions).where(eq(pollOptions.pollId, pollId)).run();
    db.delete(polls).where(eq(polls.id, pollId)).run();
  }

  revalidatePoll(kind, pollId);
  return { ok: true };
}
