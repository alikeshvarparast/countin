import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { clubPollOptions, clubPollVotes, pollOptions, polls, users, voteLogs, votes } from "@/lib/db/schema";
import { createId, now } from "@/lib/id";

export function logVote(input: {
  kind: "club" | "event";
  pollId: string;
  userId: string;
  actorId: string;
  optionId?: string | null;
  previousOptionId?: string | null;
  action: "cast" | "change" | "delete" | "admin_edit";
}) {
  db.insert(voteLogs)
    .values({
      id: createId(),
      kind: input.kind,
      pollId: input.pollId,
      userId: input.userId,
      actorId: input.actorId,
      optionId: input.optionId ?? null,
      previousOptionId: input.previousOptionId ?? null,
      action: input.action,
      createdAt: now(),
    })
    .run();
}

export function listVoteHistory(kind: "club" | "event", pollId: string) {
  const logs = db
    .select()
    .from(voteLogs)
    .where(and(eq(voteLogs.kind, kind), eq(voteLogs.pollId, pollId)))
    .all()
    .sort((a, b) => a.createdAt - b.createdAt);
  const people = db.select({ id: users.id, name: users.name }).from(users).all();
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "Member";
  const optionLabel = (optionId: string | null) => {
    if (!optionId) return "";
    if (kind === "club") {
      return db.select().from(clubPollOptions).where(eq(clubPollOptions.id, optionId)).get()?.label ?? "";
    }
    return db.select().from(pollOptions).where(eq(pollOptions.id, optionId)).get()?.label ?? "";
  };
  return logs.map((row) => {
    const vote = optionLabel(row.optionId);
    const previous = optionLabel(row.previousOptionId);
    let detail = vote;
    if (row.action === "change" || row.action === "admin_edit") {
      detail = previous ? `${previous} → ${vote}` : vote;
    }
    if (row.action === "delete") detail = previous || vote;
    return {
      id: row.id,
      at: row.createdAt,
      userId: row.userId,
      userName: nameOf(row.userId),
      actorName: nameOf(row.actorId),
      action: row.action,
      detail,
    };
  });
}

export function currentEventVotes(pollId: string) {
  const options = db.select().from(pollOptions).where(eq(pollOptions.pollId, pollId)).all();
  if (options.length === 0) return { options, votes: [] as typeof votes.$inferSelect[] };
  const rows = db
    .select()
    .from(votes)
    .where(
      inArray(
        votes.optionId,
        options.map((o) => o.id),
      ),
    )
    .all();
  return { options, votes: rows };
}

export function currentClubVotes(pollId: string) {
  const options = db.select().from(clubPollOptions).where(eq(clubPollOptions.pollId, pollId)).all();
  if (options.length === 0) return { options, votes: [] as typeof clubPollVotes.$inferSelect[] };
  const rows = db
    .select()
    .from(clubPollVotes)
    .where(
      inArray(
        clubPollVotes.optionId,
        options.map((o) => o.id),
      ),
    )
    .all();
  return { options, votes: rows };
}

export function eventPollIdForOption(optionId: string) {
  const option = db.select().from(pollOptions).where(eq(pollOptions.id, optionId)).get();
  if (!option) return null;
  const poll = db.select().from(polls).where(eq(polls.id, option.pollId)).get();
  return poll ? { option, poll } : null;
}
