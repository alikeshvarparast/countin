"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/auth";
import {
  getCommunityBySlug,
  listAdmins,
  listApprovedMembers,
  primaryAdminId,
  requireAdmin,
  requireMember,
} from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  communities,
  ledgerEntries,
  pollOptions,
  polls,
  rsvps,
  users,
  weeklyEvents,
  votes,
} from "@/lib/db/schema";
import { createId, now } from "@/lib/id";
import { notify, notifyMany } from "@/lib/notify";
import { localInputToMs } from "@/lib/utils";

function splitCents(total: number, n: number) {
  const base = Math.floor(total / n);
  const rem = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

function goingCount(eventId: string) {
  return db
    .select()
    .from(rsvps)
    .where(and(eq(rsvps.eventId, eventId), eq(rsvps.status, "going")))
    .all().length;
}

async function maybeReadyToBook(community: { id: string; slug: string; name: string }, eventId: string) {
  const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, eventId)).get();
  if (!event || event.status !== "open") return;
  if (goingCount(eventId) >= event.minPlayers) {
    db.update(weeklyEvents)
      .set({ status: "ready_to_book" })
      .where(eq(weeklyEvents.id, eventId))
      .run();
    const admins = listAdmins(community.id);
    await notifyMany(
      admins.map((a) => a.userId),
      {
        communityId: community.id,
        type: "ready_to_book",
        title: `Ready to book · ${event.title}`,
        body: `${community.name} hit the minimum for ${event.title}. Confirm the field.`,
        href: `/app/c/${community.slug}/events/${event.id}`,
      },
    );
  }
}

export async function createWeeklyEvent(formData: FormData) {
  const user = await requireUser();
  const slug = String(formData.get("slug") ?? "");
  const community = getCommunityBySlug(slug);
  if (!community) return { error: "Community not found." };
  requireAdmin(community.id, user.id);

  const title = String(formData.get("title") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || community.location || "";
  const minPlayers = Number(formData.get("minPlayers") ?? 10);
  const usePoll = String(formData.get("usePoll") ?? "") === "on";
  if (title.length < 2) return { error: "Give the event a title." };
  if (!Number.isFinite(minPlayers) || minPlayers < 2) return { error: "Minimum players must be at least 2." };

  const id = createId();
  const t = now();

  if (usePoll) {
    const optionLabels = formData.getAll("option").map((v) => String(v).trim()).filter(Boolean);
    if (optionLabels.length < 2) return { error: "Add at least two time options for the poll." };
    const pollCloses = localInputToMs(String(formData.get("pollClosesAt") ?? ""));

    db.insert(weeklyEvents)
      .values({
        id,
        communityId: community.id,
        title,
        location: location || null,
        minPlayers,
        status: "polling",
        createdById: user.id,
        createdAt: t,
      })
      .run();

    const pollId = createId();
    db.insert(polls)
      .values({
        id: pollId,
        eventId: id,
        question: `When should we play ${title}?`,
        closesAt: pollCloses,
        createdAt: t,
      })
      .run();

    for (const label of optionLabels) {
      db.insert(pollOptions)
        .values({
          id: createId(),
          pollId,
          label,
          startsAt: localInputToMs(label),
        })
        .run();
    }

    audit({
      communityId: community.id,
      actorId: user.id,
      action: "weekly.poll_create",
      entityType: "weekly_event",
      entityId: id,
    });

    await notifyMany(
      listApprovedMembers(community.id).map((m) => m.userId),
      {
        communityId: community.id,
        type: "new_poll",
        title: `Time poll · ${title}`,
        body: `Vote on when ${community.name} should play.`,
        href: `/app/c/${community.slug}/events/${id}`,
      },
    );
  } else {
    const startsAt = localInputToMs(String(formData.get("startsAt") ?? ""));
    const rsvpDeadlineAt = localInputToMs(String(formData.get("rsvpDeadlineAt") ?? ""));
    if (!startsAt) return { error: "Pick a kickoff time." };

    db.insert(weeklyEvents)
      .values({
        id,
        communityId: community.id,
        title,
        location: location || null,
        startsAt,
        minPlayers,
        rsvpDeadlineAt,
        status: "open",
        createdById: user.id,
        createdAt: t,
      })
      .run();

    audit({
      communityId: community.id,
      actorId: user.id,
      action: "weekly.event_create",
      entityType: "weekly_event",
      entityId: id,
    });

    await notifyMany(
      listApprovedMembers(community.id).map((m) => m.userId),
      {
        communityId: community.id,
        type: "new_event",
        title: `New session · ${title}`,
        body: `RSVP for ${community.name}. Presence can change until the deadline.`,
        href: `/app/c/${community.slug}/events/${id}`,
      },
    );
  }

  revalidatePath(`/app/c/${slug}`);
  revalidatePath(`/app/c/${slug}/events`);
  return { ok: true, id };
}

export async function votePoll(formData: FormData) {
  const user = await requireUser();
  const optionId = String(formData.get("optionId") ?? "");
  const option = db.select().from(pollOptions).where(eq(pollOptions.id, optionId)).get();
  if (!option) return { error: "Option not found." };
  const poll = db.select().from(polls).where(eq(polls.id, option.pollId)).get();
  if (!poll) return { error: "Poll not found." };
  const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, poll.eventId)).get();
  if (!event) return { error: "Event not found." };
  const community = db.select().from(communities).where(eq(communities.id, event.communityId)).get();
  if (!community) return { error: "Community not found." };
  requireMember(event.communityId, user.id);
  if (event.status !== "polling") return { error: "This poll is closed." };
  if (poll.closesAt && now() > poll.closesAt) return { error: "The poll has closed." };

  const allOptions = db.select().from(pollOptions).where(eq(pollOptions.pollId, poll.id)).all();
  const existing = db
    .select()
    .from(votes)
    .where(
      and(
        eq(votes.userId, user.id),
        inArray(
          votes.optionId,
          allOptions.map((o) => o.id),
        ),
      ),
    )
    .all();
  for (const v of existing) {
    db.delete(votes).where(eq(votes.id, v.id)).run();
  }
  db.insert(votes)
    .values({ id: createId(), optionId, userId: user.id, createdAt: now() })
    .run();

  revalidatePath(`/app/c/${community.slug}/events/${event.id}`);
  return { ok: true };
}

export async function lockPollTime(formData: FormData) {
  const user = await requireUser();
  const optionId = String(formData.get("optionId") ?? "");
  const rsvpDeadlineAt = localInputToMs(String(formData.get("rsvpDeadlineAt") ?? ""));
  const option = db.select().from(pollOptions).where(eq(pollOptions.id, optionId)).get();
  if (!option) return { error: "Option not found." };
  const poll = db.select().from(polls).where(eq(polls.id, option.pollId)).get();
  if (!poll) return { error: "Poll not found." };
  const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, poll.eventId)).get();
  if (!event) return { error: "Event not found." };
  requireAdmin(event.communityId, user.id);
  if (event.status !== "polling") return { error: "Time is already locked." };

  const startsAt = option.startsAt ?? localInputToMs(option.label);
  db.update(weeklyEvents)
    .set({
      startsAt,
      status: "open",
      rsvpDeadlineAt: rsvpDeadlineAt || event.rsvpDeadlineAt,
    })
    .where(eq(weeklyEvents.id, event.id))
    .run();

  const community = db.select().from(communities).where(eq(communities.id, event.communityId)).get();
  if (!community) return { error: "Community not found." };

  audit({
    communityId: community.id,
    actorId: user.id,
    action: "weekly.lock_time",
    entityType: "weekly_event",
    entityId: event.id,
    meta: { optionId },
  });

  await notifyMany(
    listApprovedMembers(community.id).map((m) => m.userId),
    {
      communityId: community.id,
      type: "event_open",
      title: `Time locked · ${event.title}`,
      body: `Kickoff is set. RSVP if you are coming.`,
      href: `/app/c/${community.slug}/events/${event.id}`,
    },
  );

  revalidatePath(`/app/c/${community.slug}/events/${event.id}`);
  return { ok: true };
}

export async function setRsvp(formData: FormData) {
  const user = await requireUser();
  const eventId = String(formData.get("eventId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (status !== "going" && status !== "not_going") return { error: "Pick going or not going." };
  const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, eventId)).get();
  if (!event) return { error: "Event not found." };
  requireMember(event.communityId, user.id);
  if (!["open", "ready_to_book", "booked"].includes(event.status)) {
    return { error: "RSVP is not open." };
  }
  if (event.rsvpDeadlineAt && now() > event.rsvpDeadlineAt) {
    return { error: "The presence deadline has passed." };
  }

  const existing = db
    .select()
    .from(rsvps)
    .where(and(eq(rsvps.eventId, eventId), eq(rsvps.userId, user.id)))
    .get();
  const t = now();
  if (existing) {
    db.update(rsvps).set({ status, updatedAt: t }).where(eq(rsvps.id, existing.id)).run();
  } else {
    db.insert(rsvps)
      .values({ id: createId(), eventId, userId: user.id, status, updatedAt: t })
      .run();
  }

  const community = db.select().from(communities).where(eq(communities.id, event.communityId)).get();
  if (community) await maybeReadyToBook(community, event.id);

  revalidatePath(`/app/c/${community?.slug}/events/${event.id}`);
  return { ok: true };
}

export async function confirmFieldBooked(eventId: string) {
  const user = await requireUser();
  const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, eventId)).get();
  if (!event) return { error: "Event not found." };
  requireAdmin(event.communityId, user.id);
  if (!["open", "ready_to_book"].includes(event.status)) {
    return { error: "This event cannot be marked booked." };
  }
  db.update(weeklyEvents).set({ status: "booked" }).where(eq(weeklyEvents.id, eventId)).run();
  const community = db.select().from(communities).where(eq(communities.id, event.communityId)).get();
  if (!community) return { error: "Community not found." };

  audit({
    communityId: community.id,
    actorId: user.id,
    action: "weekly.book",
    entityType: "weekly_event",
    entityId: event.id,
  });

  await notifyMany(
    listApprovedMembers(community.id).map((m) => m.userId),
    {
      communityId: community.id,
      type: "field_booked",
      title: `Field booked · ${event.title}`,
      body: `The pitch is confirmed for ${community.name}.`,
      href: `/app/c/${community.slug}/events/${event.id}`,
    },
  );
  revalidatePath(`/app/c/${community.slug}/events/${event.id}`);
  return { ok: true };
}

export async function cancelWeeklyEvent(eventId: string) {
  const user = await requireUser();
  const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, eventId)).get();
  if (!event) return { error: "Event not found." };
  requireAdmin(event.communityId, user.id);
  db.update(weeklyEvents).set({ status: "cancelled" }).where(eq(weeklyEvents.id, eventId)).run();
  const community = db.select().from(communities).where(eq(communities.id, event.communityId)).get();
  if (!community) return { error: "Community not found." };
  audit({
    communityId: community.id,
    actorId: user.id,
    action: "weekly.cancel",
    entityType: "weekly_event",
    entityId: event.id,
  });
  await notifyMany(
    listApprovedMembers(community.id).map((m) => m.userId),
    {
      communityId: community.id,
      type: "event_cancelled",
      title: `Cancelled · ${event.title}`,
      body: `This session for ${community.name} was cancelled.`,
      href: `/app/c/${community.slug}/events/${event.id}`,
    },
  );
  revalidatePath(`/app/c/${community.slug}/events/${event.id}`);
  return { ok: true };
}

export async function postWeeklyCost(formData: FormData) {
  const user = await requireUser();
  const eventId = String(formData.get("eventId") ?? "");
  const amount = Number(formData.get("amount") ?? "");
  const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, eventId)).get();
  if (!event) return { error: "Event not found." };
  requireAdmin(event.communityId, user.id);
  if (event.totalCostCents != null) return { error: "Cost was already posted." };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter the total cost." };

  const going = db
    .select({ userId: rsvps.userId, name: users.name })
    .from(rsvps)
    .innerJoin(users, eq(users.id, rsvps.userId))
    .where(and(eq(rsvps.eventId, eventId), eq(rsvps.status, "going")))
    .all();
  if (going.length === 0) return { error: "No one is marked present. Correct RSVPs first." };

  const cents = Math.round(amount * 100);
  const shares = splitCents(cents, going.length);
  const adminId = primaryAdminId(event.communityId);
  const t = now();

  db.update(weeklyEvents)
    .set({ totalCostCents: cents, status: "completed" })
    .where(eq(weeklyEvents.id, eventId))
    .run();

  const community = db.select().from(communities).where(eq(communities.id, event.communityId)).get();
  if (!community) return { error: "Community not found." };

  going.forEach((person, i) => {
    db.insert(ledgerEntries)
      .values({
        id: createId(),
        communityId: community.id,
        fromUserId: person.userId,
        toUserId: adminId,
        amountCents: shares[i],
        reason: "weekly_share",
        status: "pending",
        weeklyEventId: event.id,
        createdAt: t,
      })
      .run();
  });

  audit({
    communityId: community.id,
    actorId: user.id,
    action: "weekly.post_cost",
    entityType: "weekly_event",
    entityId: event.id,
    meta: { cents, attendees: going.length },
  });

  await notifyMany(
    going.map((p) => p.userId),
    {
      communityId: community.id,
      type: "cost_posted",
      title: `You owe a share · ${event.title}`,
      body: `Cost is in for ${community.name}. Settle up with the admin.`,
      href: `/app/c/${community.slug}/ledger`,
    },
  );

  revalidatePath(`/app/c/${community.slug}/events/${event.id}`);
  revalidatePath(`/app/c/${community.slug}/ledger`);
  return { ok: true };
}

export async function settleLedgerEntry(entryId: string) {
  const user = await requireUser();
  const entry = db.select().from(ledgerEntries).where(eq(ledgerEntries.id, entryId)).get();
  if (!entry) return { error: "Entry not found." };
  const membership = requireMember(entry.communityId, user.id);
  const canSettle = membership.role === "admin" || entry.toUserId === user.id;
  if (!canSettle) return { error: "Only the payee or an admin can mark this paid." };
  if (entry.status === "settled") return { error: "Already settled." };

  db.update(ledgerEntries)
    .set({ status: "settled", settledAt: now(), settledById: user.id })
    .where(eq(ledgerEntries.id, entryId))
    .run();

  const community = db.select().from(communities).where(eq(communities.id, entry.communityId)).get();
  if (!community) return { error: "Community not found." };

  audit({
    communityId: community.id,
    actorId: user.id,
    action: "ledger.settle",
    entityType: "ledger_entry",
    entityId: entry.id,
  });

  await notify({
    userId: entry.fromUserId,
    communityId: community.id,
    type: "payment_settled",
    title: `Payment recorded · ${community.name}`,
    body: `A pending charge was marked paid.`,
    href: `/app/c/${community.slug}/ledger`,
  });

  revalidatePath(`/app/c/${community.slug}/ledger`);
  return { ok: true };
}
