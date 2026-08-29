"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/auth";
import {
  getCommunityBySlug,
  listAdmins,
  listApprovedMembers,
  primaryAdminId,
  requireAdmin,
  requireActiveMember,
  isStaff,
} from "@/lib/access";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  communities,
  eventGuests,
  ledgerEntries,
  pollOptions,
  polls,
  rsvps,
  users,
  weeklyEvents,
  votes,
} from "@/lib/db/schema";
import { createId, now } from "@/lib/id";
import { goingHeadcount, notifyCollector, syncWeeklyShares, attendanceShares, splitCents } from "@/lib/ledger";
import { currentEventVotes, logVote } from "@/lib/votes";
import { notify, notifyMany } from "@/lib/notify";
import { eventStartFromParts, localInputToMs, parseDurationMinutes } from "@/lib/utils";

function goingCount(eventId: string) {
  return goingHeadcount(eventId);
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

  const durationMinutes = parseDurationMinutes(formData.get("durationHours"), formData.get("durationMinutes"));
  if (durationMinutes == null) return { error: "Set how long the session lasts." };

  const id = createId();
  const t = now();
  const paymentFields = {
    paymentMode: "postpay" as const,
    paymentInfo: null,
    collectorUserId: user.id,
    totalCostCents: null,
    durationMinutes,
  };

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
        hasTime: false,
        createdById: user.id,
        createdAt: t,
        ...paymentFields,
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
    const parsed = eventStartFromParts(
      String(formData.get("startDate") ?? ""),
      String(formData.get("startTime") ?? ""),
      community.timezone,
    );
    const rsvpDeadlineAt = localInputToMs(String(formData.get("rsvpDeadlineAt") ?? ""));
    if (!parsed) return { error: "Pick a date." };

    db.insert(weeklyEvents)
      .values({
        id,
        communityId: community.id,
        title,
        location: location || null,
        startsAt: parsed.startsAt,
        hasTime: parsed.hasTime,
        minPlayers,
        rsvpDeadlineAt,
        status: "open",
        createdById: user.id,
        createdAt: t,
        ...paymentFields,
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
  requireActiveMember(event.communityId, user.id);
  if (event.status !== "polling") return { error: "This poll is closed." };
  if (poll.closesAt && now() > poll.closesAt) return { error: "The poll has closed." };

  const { votes: existing } = currentEventVotes(poll.id);
  const mine = existing.filter((v) => v.userId === user.id);
  const previousOptionId = mine[0]?.optionId ?? null;
  for (const v of mine) {
    db.delete(votes).where(eq(votes.id, v.id)).run();
  }
  db.insert(votes)
    .values({ id: createId(), optionId, userId: user.id, createdAt: now() })
    .run();
  logVote({
    kind: "event",
    pollId: poll.id,
    userId: user.id,
    actorId: user.id,
    optionId,
    previousOptionId,
    action: previousOptionId ? "change" : "cast",
  });

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
      hasTime: true,
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
  requireActiveMember(event.communityId, user.id);
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
  if (community) {
    await maybeReadyToBook(community, event.id);
    await syncWeeklyShares(event.id);
  }

  revalidatePath(`/app/c/${community?.slug}`);
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
  await syncWeeklyShares(event.id);
  if (event.paymentMode === "prepaid" && event.collectorUserId) {
    await notifyCollector(
      community,
      event.collectorUserId,
      `Payments to verify · ${event.title}`,
      `Attendance is locked in. Confirm who has paid.`,
    );
  }
  revalidatePath(`/app/c/${community.slug}`);
  revalidatePath(`/app/c/${community.slug}/events/${event.id}`);
  revalidatePath(`/app/c/${community.slug}/ledger`);
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
  revalidatePath(`/app/c/${community.slug}`);
  revalidatePath(`/app/c/${community.slug}/events/${event.id}`);
  return { ok: true };
}

export async function postWeeklyCost(formData: FormData) {
  const user = await requireUser();
  const eventId = String(formData.get("eventId") ?? "");
  const amount = Number(formData.get("amount") ?? "");
  const paymentInfo = String(formData.get("paymentInfo") ?? "").trim();
  const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, eventId)).get();
  if (!event) return { error: "Event not found." };
  requireAdmin(event.communityId, user.id);
  if (event.totalCostCents != null && event.paymentMode === "prepaid") {
    return { error: "Cost was already set for this pre-paid event." };
  }
  if (event.totalCostCents != null && event.status === "completed") return { error: "Cost was already posted." };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter the total cost." };

  const { counts, units, going } = attendanceShares(eventId);
  if (units === 0 || going.length === 0) return { error: "No one is marked present. Correct RSVPs first." };

  const cents = Math.round(amount * 100);
  const collectorId = event.collectorUserId ?? primaryAdminId(event.communityId);
  const t = now();

  db.update(weeklyEvents)
    .set({
      totalCostCents: cents,
      status: "completed",
      paymentInfo: paymentInfo || event.paymentInfo,
    })
    .where(eq(weeklyEvents.id, eventId))
    .run();

  const community = db.select().from(communities).where(eq(communities.id, event.communityId)).get();
  if (!community) return { error: "Community not found." };

  const unitAmounts = splitCents(cents, units);
  let cursor = 0;
  for (const [userId, shareCount] of counts) {
    const amountCents = unitAmounts.slice(cursor, cursor + shareCount).reduce((s, n) => s + n, 0);
    cursor += shareCount;
    db.insert(ledgerEntries)
      .values({
        id: createId(),
        communityId: community.id,
        fromUserId: userId,
        toUserId: collectorId,
        amountCents,
        reason: "weekly_share",
        status: "pending",
        weeklyEventId: event.id,
        createdAt: t,
      })
      .run();
  }

  audit({
    communityId: community.id,
    actorId: user.id,
    action: "weekly.post_cost",
    entityType: "weekly_event",
    entityId: event.id,
    meta: { cents, attendees: units },
  });

  await notifyMany([...counts.keys()], {
    communityId: community.id,
    type: "cost_posted",
    title: `You owe a share · ${event.title}`,
    body: `Cost is in for ${community.name}. Pay ${collectorNameSafe(collectorId)} and wait for confirmation.`,
    href: `/app/c/${community.slug}/ledger`,
  });
  await notifyCollector(
    community,
    collectorId,
    `Payments to verify · ${event.title}`,
    `Shares are on the ledger. Mark each payment when it arrives.`,
  );

  revalidatePath(`/app/c/${community.slug}/events/${event.id}`);
  revalidatePath(`/app/c/${community.slug}/ledger`);
  return { ok: true };
}

function collectorNameSafe(userId: string) {
  return db.select().from(users).where(eq(users.id, userId)).get()?.name ?? "the collector";
}

export async function settleLedgerEntry(entryId: string) {
  const user = await requireUser();
  const entry = db.select().from(ledgerEntries).where(eq(ledgerEntries.id, entryId)).get();
  if (!entry) return { error: "Entry not found." };
  const canSettle = isStaff(entry.communityId, user.id) || entry.toUserId === user.id;
  if (!canSettle) return { error: "Only the collector or an admin can mark this paid." };
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

export async function addEventGuest(formData: FormData) {
  const user = await requireUser();
  const eventId = String(formData.get("eventId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  if (label.length < 2) return { error: "Name the guest, e.g. Ali's friend." };
  const t = now();

  if (eventId) {
    const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, eventId)).get();
    if (!event) return { error: "Event not found." };
    requireActiveMember(event.communityId, user.id);
    const going = db
      .select()
      .from(rsvps)
      .where(and(eq(rsvps.eventId, eventId), eq(rsvps.userId, user.id), eq(rsvps.status, "going")))
      .get();
    if (!going) return { error: "Mark yourself going before adding a guest." };
    db.insert(eventGuests)
      .values({
        id: createId(),
        weeklyEventId: eventId,
        sessionId: null,
        hostUserId: user.id,
        label,
        status: "pending",
        createdAt: t,
      })
      .run();
    const community = db.select().from(communities).where(eq(communities.id, event.communityId)).get();
    if (community) {
      await notifyMany(
        listAdmins(community.id).map((a) => a.userId),
        {
          communityId: community.id,
          type: "guest_pending",
          title: `Guest waiting · ${event.title}`,
          body: `${user.name} added ${label}. Approve them on the event page.`,
          href: `/app/c/${community.slug}/events/${eventId}`,
        },
      );
      revalidatePath(`/app/c/${community.slug}/events/${eventId}`);
      revalidatePath(`/app/c/${community.slug}`);
    }
    return { ok: true };
  }

  if (sessionId) {
    const { seasonSessions, seasons, sessionSlots } = await import("@/lib/db/schema");
    const row = db.select().from(seasonSessions).where(eq(seasonSessions.id, sessionId)).get();
    if (!row) return { error: "Session not found." };
    requireActiveMember(row.communityId, user.id);
    const season = db.select().from(seasons).where(eq(seasons.id, row.seasonId)).get();
    if (!season || season.status !== "locked") {
      return { error: "Guests can be added after the contract nights open." };
    }
    const hostSlot = db
      .select()
      .from(sessionSlots)
      .where(and(eq(sessionSlots.sessionId, sessionId), eq(sessionSlots.userId, user.id)))
      .get();
    if (!hostSlot || hostSlot.status === "occasional_pending") {
      return { error: "You need a place on this night before adding a guest." };
    }
    db.insert(eventGuests)
      .values({
        id: createId(),
        weeklyEventId: null,
        sessionId,
        hostUserId: user.id,
        label,
        status: "pending",
        createdAt: t,
      })
      .run();
    const community = db.select().from(communities).where(eq(communities.id, row.communityId)).get();
    if (community) {
      await notifyMany(
        listAdmins(community.id).map((a) => a.userId),
        {
          communityId: community.id,
          type: "guest_pending",
          title: `Guest waiting · ${season.name}`,
          body: `${user.name} added ${label}. Approve them on that night's page.`,
          href: `/app/c/${community.slug}/sessions/${sessionId}`,
        },
      );
      revalidatePath(`/app/c/${community.slug}/sessions/${sessionId}`);
      revalidatePath(`/app/c/${community.slug}`);
    }
    return { ok: true };
  }

  return { error: "Missing event." };
}

export async function decideEventGuest(formData: FormData) {
  const user = await requireUser();
  const guestId = String(formData.get("guestId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const guest = db.select().from(eventGuests).where(eq(eventGuests.id, guestId)).get();
  if (!guest) return { error: "Guest not found." };
  if (guest.status !== "pending") return { error: "This guest is not waiting." };

  let communityId: string | null = null;
  let title = "Event";
  if (guest.weeklyEventId) {
    const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, guest.weeklyEventId)).get();
    if (!event) return { error: "Event not found." };
    requireAdmin(event.communityId, user.id);
    communityId = event.communityId;
    title = event.title;
  } else if (guest.sessionId) {
    const { seasonSessions, seasons } = await import("@/lib/db/schema");
    const row = db.select().from(seasonSessions).where(eq(seasonSessions.id, guest.sessionId)).get();
    if (!row) return { error: "Session not found." };
    requireAdmin(row.communityId, user.id);
    const season = db.select().from(seasons).where(eq(seasons.id, row.seasonId)).get();
    communityId = row.communityId;
    title = season?.name ?? "Session";
  } else {
    return { error: "Missing event." };
  }

  const community = db.select().from(communities).where(eq(communities.id, communityId)).get();
  if (!community) return { error: "Community not found." };
  const href = guest.weeklyEventId
    ? `/app/c/${community.slug}/events/${guest.weeklyEventId}`
    : `/app/c/${community.slug}/sessions/${guest.sessionId}`;

  if (decision === "rejected") {
    db.update(eventGuests).set({ status: "rejected" }).where(eq(eventGuests.id, guestId)).run();
    await notify({
      userId: guest.hostUserId,
      communityId: community.id,
      type: "guest_rejected",
      title: `Guest declined · ${title}`,
      body: `${guest.label} was not approved.`,
      href,
    });
  } else if (decision === "approved") {
    db.update(eventGuests).set({ status: "approved" }).where(eq(eventGuests.id, guestId)).run();
    if (guest.weeklyEventId) await syncWeeklyShares(guest.weeklyEventId);
    await notify({
      userId: guest.hostUserId,
      communityId: community.id,
      type: "guest_approved",
      title: `Guest approved · ${title}`,
      body: `${guest.label} is on the list.`,
      href,
    });
  } else {
    return { error: "Invalid decision." };
  }

  audit({
    communityId: community.id,
    actorId: user.id,
    action: decision === "approved" ? "guest.approve" : "guest.decline",
    entityType: "event_guest",
    entityId: guest.id,
  });

  revalidatePath(href);
  revalidatePath(`/app/c/${community.slug}`);
  if (guest.weeklyEventId) revalidatePath(`/app/c/${community.slug}/ledger`);
  return { ok: true };
}

export async function removeEventGuest(guestId: string) {
  const user = await requireUser();
  const guest = db.select().from(eventGuests).where(eq(eventGuests.id, guestId)).get();
  if (!guest) return { error: "Guest not found." };
  if (guest.hostUserId !== user.id) {
    const event = guest.weeklyEventId
      ? db.select().from(weeklyEvents).where(eq(weeklyEvents.id, guest.weeklyEventId)).get()
      : null;
    if (event) requireAdmin(event.communityId, user.id);
    else {
      const { seasonSessions } = await import("@/lib/db/schema");
      const row = guest.sessionId
        ? db.select().from(seasonSessions).where(eq(seasonSessions.id, guest.sessionId)).get()
        : null;
      if (row) requireAdmin(row.communityId, user.id);
    }
  }
  db.delete(eventGuests).where(eq(eventGuests.id, guestId)).run();
  if (guest.weeklyEventId) {
    await syncWeeklyShares(guest.weeklyEventId);
    const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, guest.weeklyEventId)).get();
    const community = event
      ? db.select().from(communities).where(eq(communities.id, event.communityId)).get()
      : null;
    if (community) {
      revalidatePath(`/app/c/${community.slug}/events/${guest.weeklyEventId}`);
      revalidatePath(`/app/c/${community.slug}/ledger`);
    }
  }
  if (guest.sessionId) {
    const { seasonSessions } = await import("@/lib/db/schema");
    const row = db.select().from(seasonSessions).where(eq(seasonSessions.id, guest.sessionId)).get();
    const community = row
      ? db.select().from(communities).where(eq(communities.id, row.communityId)).get()
      : null;
    if (community) revalidatePath(`/app/c/${community.slug}/sessions/${guest.sessionId}`);
  }
  return { ok: true };
}
