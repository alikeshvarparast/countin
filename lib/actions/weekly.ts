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
import { postClubChat } from "@/lib/chat";
import { goingHeadcount, notifyCollector, syncWeeklyShares, attendanceShares, splitCents } from "@/lib/ledger";
import { currentEventVotes, logVote } from "@/lib/votes";
import { notify, notifyMany } from "@/lib/notify";
import { eventStartFromParts, formatMoney, localInputToMs, parseDurationMinutes, sessionSlotIsGoing } from "@/lib/utils";

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
  const maxRaw = String(formData.get("maxPlayers") ?? "").trim();
  const maxPlayers = maxRaw ? Number(maxRaw) : null;
  const paymentMode = String(formData.get("paymentMode") ?? "postpay") === "prepaid" ? "prepaid" : "postpay";
  const usePoll = String(formData.get("usePoll") ?? "") === "on";
  if (title.length < 2) return { error: "Give the event a title." };
  if (!Number.isFinite(minPlayers) || minPlayers < 2) return { error: "Minimum players must be at least 2." };
  if (maxPlayers != null && (!Number.isFinite(maxPlayers) || maxPlayers < minPlayers)) {
    return { error: "Maximum must be at least the minimum." };
  }

  const hoursRaw = String(formData.get("durationHours") ?? "").trim();
  const minutesRaw = String(formData.get("durationMinutes") ?? "").trim();
  const durationProvided = hoursRaw !== "" || (minutesRaw !== "" && minutesRaw !== "0");
  let durationMinutes: number | null = null;
  if (durationProvided) {
    durationMinutes = parseDurationMinutes(hoursRaw || "0", minutesRaw || "0");
    if (durationMinutes == null) return { error: "Duration looks invalid." };
  }

  const id = createId();
  const t = now();
  const paymentFields = {
    paymentMode: paymentMode as "postpay" | "prepaid",
    paymentInfo: null,
    collectorUserId: user.id,
    totalCostCents: null,
    durationMinutes,
    maxPlayers,
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

export async function updateWeeklyEvent(formData: FormData) {
  const user = await requireUser();
  const eventId = String(formData.get("eventId") ?? "");
  const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, eventId)).get();
  if (!event) return { error: "Event not found." };
  requireAdmin(event.communityId, user.id);
  if (event.status === "cancelled" || event.status === "completed") {
    return { error: "This event can no longer be edited." };
  }

  const community = db.select().from(communities).where(eq(communities.id, event.communityId)).get();
  if (!community) return { error: "Community not found." };

  const title = String(formData.get("title") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || community.location || "";
  const minPlayers = Number(formData.get("minPlayers") ?? event.minPlayers);
  const maxRaw = String(formData.get("maxPlayers") ?? "").trim();
  const maxPlayers = maxRaw ? Number(maxRaw) : null;
  const paymentMode = String(formData.get("paymentMode") ?? event.paymentMode) === "prepaid" ? "prepaid" : "postpay";

  if (title.length < 2) return { error: "Give the event a title." };
  if (!Number.isFinite(minPlayers) || minPlayers < 2) return { error: "Minimum players must be at least 2." };
  if (maxPlayers != null && (!Number.isFinite(maxPlayers) || maxPlayers < minPlayers)) {
    return { error: "Maximum must be at least the minimum." };
  }

  const hoursRaw = String(formData.get("durationHours") ?? "").trim();
  const minutesRaw = String(formData.get("durationMinutes") ?? "").trim();
  const durationProvided = hoursRaw !== "" || (minutesRaw !== "" && minutesRaw !== "0");
  let durationMinutes: number | null = null;
  if (durationProvided) {
    durationMinutes = parseDurationMinutes(hoursRaw || "0", minutesRaw || "0");
    if (durationMinutes == null) return { error: "Duration looks invalid." };
  }

  const patch: {
    title: string;
    location: string | null;
    minPlayers: number;
    maxPlayers: number | null;
    durationMinutes: number | null;
    paymentMode: "postpay" | "prepaid";
    startsAt?: number | null;
    hasTime?: boolean;
    rsvpDeadlineAt?: number | null;
  } = {
    title,
    location: location || null,
    minPlayers,
    maxPlayers,
    durationMinutes,
    paymentMode: event.paymentRequestedAt ? (event.paymentMode as "postpay" | "prepaid") : paymentMode,
  };

  if (event.status !== "polling") {
    const parsed = eventStartFromParts(
      String(formData.get("startDate") ?? ""),
      String(formData.get("startTime") ?? ""),
      community.timezone,
    );
    if (!parsed) return { error: "Pick a date." };
    const rsvpRaw = String(formData.get("rsvpDeadlineAt") ?? "").trim();
    patch.startsAt = parsed.startsAt;
    patch.hasTime = parsed.hasTime;
    patch.rsvpDeadlineAt = rsvpRaw ? localInputToMs(rsvpRaw) : null;
  }

  db.update(weeklyEvents).set(patch).where(eq(weeklyEvents.id, event.id)).run();

  audit({
    communityId: community.id,
    actorId: user.id,
    action: "weekly.event_update",
    entityType: "weekly_event",
    entityId: event.id,
  });

  revalidatePath(`/app/c/${community.slug}`);
  revalidatePath(`/app/c/${community.slug}/events`);
  revalidatePath(`/app/c/${community.slug}/events/${event.id}`);
  return { ok: true };
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
  if (status !== "going" && status !== "not_going" && status !== "waitlist") {
    return { error: "Pick going or not going." };
  }
  const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, eventId)).get();
  if (!event) return { error: "Event not found." };
  requireActiveMember(event.communityId, user.id);
  if (!["open", "ready_to_book", "booked"].includes(event.status)) {
    return { error: "RSVP is not open." };
  }
  const staff = isStaff(event.communityId, user.id);
  // After the field is booked, members can still change presence (with admin notify / min checks).
  if (
    event.status !== "booked" &&
    !staff &&
    event.rsvpDeadlineAt &&
    now() > event.rsvpDeadlineAt
  ) {
    return { error: "The presence deadline has passed." };
  }

  const community = db.select().from(communities).where(eq(communities.id, event.communityId)).get();
  const { eventWaitlist } = await import("@/lib/db/schema");
  const t = now();
  const existingWait = db
    .select()
    .from(eventWaitlist)
    .where(and(eq(eventWaitlist.eventId, eventId), eq(eventWaitlist.userId, user.id)))
    .get();

  if (status === "waitlist") {
    const existing = db
      .select()
      .from(rsvps)
      .where(and(eq(rsvps.eventId, eventId), eq(rsvps.userId, user.id)))
      .get();
    if (existing) db.delete(rsvps).where(eq(rsvps.id, existing.id)).run();
    if (!existingWait) {
      db.insert(eventWaitlist)
        .values({ id: createId(), eventId, userId: user.id, createdAt: t })
        .run();
    }
    revalidatePath(`/app/c/${community?.slug}`);
    revalidatePath(`/app/c/${community?.slug}/events/${event.id}`);
    return { ok: true };
  }

  if (status === "going" && event.maxPlayers != null) {
    const currentGoing = goingHeadcount(eventId);
    const alreadyGoing = db
      .select()
      .from(rsvps)
      .where(and(eq(rsvps.eventId, eventId), eq(rsvps.userId, user.id), eq(rsvps.status, "going")))
      .get();
    if (!alreadyGoing && currentGoing >= event.maxPlayers) {
      if (!existingWait) {
        db.insert(eventWaitlist)
          .values({ id: createId(), eventId, userId: user.id, createdAt: t })
          .run();
      }
      revalidatePath(`/app/c/${community?.slug}`);
      revalidatePath(`/app/c/${community?.slug}/events/${event.id}`);
      return { ok: true, waitlisted: true };
    }
  }

  if (existingWait) db.delete(eventWaitlist).where(eq(eventWaitlist.id, existingWait.id)).run();

  const existing = db
    .select()
    .from(rsvps)
    .where(and(eq(rsvps.eventId, eventId), eq(rsvps.userId, user.id)))
    .get();

  if (event.status === "booked" && existing?.status === "going" && status === "not_going") {
    const { guests } = attendanceShares(eventId);
    const myGuestCount = guests.filter((g) => g.hostUserId === user.id).length;
    const after = goingHeadcount(eventId) - 1 - myGuestCount;
    if (after < event.minPlayers && community) {
      const warning = `${user.name} want permission to cancel the presence that make the numbers less than the minimum member required`;
      postClubChat(community.id, user.id, warning);
      await notifyMany(
        listApprovedMembers(community.id).map((m) => m.userId),
        {
          communityId: community.id,
          type: "presence_min_warning",
          title: `Below minimum · ${event.title}`,
          body: warning,
          href: `/app/c/${community.slug}/events/${event.id}`,
        },
      );
      revalidatePath(`/app/c/${community.slug}`);
      revalidatePath(`/app/c/${community.slug}/events/${event.id}`);
      revalidatePath(`/app/c/${community.slug}/chat`);
      revalidatePath(`/app/c/${community.slug}`, "layout");
      return {
        error:
          "Cannot leave: that would drop below the minimum players. The club was notified.",
      };
    }
  }

  if (existing) {
    db.update(rsvps).set({ status, updatedAt: t }).where(eq(rsvps.id, existing.id)).run();
  } else {
    db.insert(rsvps)
      .values({ id: createId(), eventId, userId: user.id, status, updatedAt: t })
      .run();
  }

  if (status === "not_going" && event.maxPlayers != null) {
    await promoteFromWaitlist(eventId);
  }

  if (community) {
    await maybeReadyToBook(community, event.id);
    await syncWeeklyShares(event.id);

    if (event.status === "booked" && existing?.status !== status) {
      const label = status === "going" ? "going" : "not going";
      const staffIds = new Set(listAdmins(community.id).map((a) => a.userId));
      if (community.createdById) staffIds.add(community.createdById);
      staffIds.delete(user.id);
      if (staffIds.size > 0) {
        await notifyMany([...staffIds], {
          communityId: community.id,
          type: "presence_changed",
          title: `Presence update · ${event.title}`,
          body: `${user.name} changed to ${label}.`,
          href: `/app/c/${community.slug}/events/${event.id}`,
        });
      }
    }
  }

  revalidatePath(`/app/c/${community?.slug}`);
  revalidatePath(`/app/c/${community?.slug}/events/${event.id}`);
  return { ok: true };
}

async function promoteFromWaitlist(eventId: string) {
  const { eventWaitlist } = await import("@/lib/db/schema");
  const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, eventId)).get();
  if (!event?.maxPlayers) return;
  if (goingHeadcount(eventId) >= event.maxPlayers) return;
  const next = db
    .select()
    .from(eventWaitlist)
    .where(eq(eventWaitlist.eventId, eventId))
    .all()
    .sort((a, b) => a.createdAt - b.createdAt)[0];
  if (!next) return;
  const t = now();
  db.delete(eventWaitlist).where(eq(eventWaitlist.id, next.id)).run();
  const existing = db
    .select()
    .from(rsvps)
    .where(and(eq(rsvps.eventId, eventId), eq(rsvps.userId, next.userId)))
    .get();
  if (existing) {
    db.update(rsvps).set({ status: "going", updatedAt: t }).where(eq(rsvps.id, existing.id)).run();
  } else {
    db.insert(rsvps)
      .values({ id: createId(), eventId, userId: next.userId, status: "going", updatedAt: t })
      .run();
  }
  const community = db.select().from(communities).where(eq(communities.id, event.communityId)).get();
  if (community) {
    await notify({
      userId: next.userId,
      communityId: community.id,
      type: "waitlist_promoted",
      title: `You're in · ${event.title}`,
      body: `A spot opened. You are now marked Going.`,
      href: `/app/c/${community.slug}/events/${event.id}`,
    });
  }
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
      href: `/app/c/${community.slug}`,
    },
  );
  revalidatePath(`/app/c/${community.slug}`);
  revalidatePath(`/app/c/${community.slug}/events`);
  revalidatePath(`/app/c/${community.slug}/events/${event.id}`);
  return { ok: true, slug: community.slug };
}

export async function saveEventCostSettings(formData: FormData) {
  const user = await requireUser();
  const eventId = String(formData.get("eventId") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const collectorUserId = String(formData.get("collectorUserId") ?? "").trim();
  const paymentMode = String(formData.get("paymentMode") ?? "") === "prepaid" ? "prepaid" : "postpay";
  const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, eventId)).get();
  if (!event) return { error: "Event not found." };
  requireAdmin(event.communityId, user.id);
  if (event.paymentRequestedAt) return { error: "Payment requests were already sent. Close or revise after settle." };

  const members = listApprovedMembers(event.communityId);
  const collector = members.find((m) => m.userId === collectorUserId);
  if (!collector) return { error: "Pick a member to receive payments." };
  const paymentInfo = collector.paymentInfo?.trim() ?? "";
  if (!paymentInfo) {
    return { error: `${collector.name} needs payment details on their profile before you can save.` };
  }
  let totalCostCents = event.totalCostCents;
  if (amountRaw) {
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter a valid total cost." };
    totalCostCents = Math.round(amount * 100);
  }

  db.update(weeklyEvents)
    .set({
      totalCostCents,
      paymentInfo,
      collectorUserId,
      paymentMode: event.paymentRequestedAt ? event.paymentMode : paymentMode,
    })
    .where(eq(weeklyEvents.id, eventId))
    .run();

  const community = db.select().from(communities).where(eq(communities.id, event.communityId)).get();
  if (community) {
    audit({
      communityId: community.id,
      actorId: user.id,
      action: "weekly.cost_save",
      entityType: "weekly_event",
      entityId: event.id,
    });
    revalidatePath(`/app/c/${community.slug}/events/${event.id}`);
  }
  return { ok: true };
}

export async function sendWeeklyPaymentRequest(formData: FormData) {
  const user = await requireUser();
  const eventId = String(formData.get("eventId") ?? "");
  const amount = Number(formData.get("amount") ?? "");
  const collectorUserId = String(formData.get("collectorUserId") ?? "").trim();
  const attendeeIds = formData
    .getAll("attendeeId")
    .map((v) => String(v))
    .filter(Boolean);

  const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, eventId)).get();
  if (!event) return { error: "Event not found." };
  requireAdmin(event.communityId, user.id);
  if (event.paymentRequestedAt) return { error: "Payment requests were already sent." };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter the total cost." };

  const members = listApprovedMembers(event.communityId);
  const memberIds = new Set(members.map((m) => m.userId));
  const collector = members.find((m) => m.userId === collectorUserId);
  if (!collector || !memberIds.has(collectorUserId)) {
    return { error: "Pick a member to receive payments." };
  }
  const paymentInfo = collector.paymentInfo?.trim() ?? "";
  if (!paymentInfo) {
    return { error: `${collector.name} needs payment details on their profile before you send requests.` };
  }

  let payerIds = attendeeIds.filter((id) => memberIds.has(id) && id !== collectorUserId);
  if (payerIds.length === 0) {
    const { going } = attendanceShares(eventId);
    payerIds = going.map((g) => g.userId).filter((id) => id !== collectorUserId);
  }
  if (payerIds.length === 0) return { error: "Pick who should pay a share." };

  // Ensure RSVPs for manually added attendees
  const t = now();
  for (const userId of payerIds) {
    const existing = db
      .select()
      .from(rsvps)
      .where(and(eq(rsvps.eventId, eventId), eq(rsvps.userId, userId)))
      .get();
    if (!existing) {
      db.insert(rsvps)
        .values({ id: createId(), eventId, userId, status: "going", updatedAt: t })
        .run();
    } else if (existing.status !== "going") {
      db.update(rsvps).set({ status: "going", updatedAt: t }).where(eq(rsvps.id, existing.id)).run();
    }
  }

  const cents = Math.round(amount * 100);
  const shares = splitCents(cents, payerIds.length);
  const community = db.select().from(communities).where(eq(communities.id, event.communityId)).get();
  if (!community) return { error: "Community not found." };
  const collectorLabel = collector.name;

  db.update(weeklyEvents)
    .set({
      totalCostCents: cents,
      status: event.status === "polling" || event.status === "cancelled" ? event.status : event.status,
      paymentInfo,
      collectorUserId,
      paymentRequestedAt: t,
    })
    .where(eq(weeklyEvents.id, eventId))
    .run();

  for (let i = 0; i < payerIds.length; i += 1) {
    const amountCents = shares[i];
    db.insert(ledgerEntries)
      .values({
        id: createId(),
        communityId: community.id,
        fromUserId: payerIds[i],
        toUserId: collectorUserId,
        amountCents,
        reason: "weekly_share",
        status: "pending",
        weeklyEventId: event.id,
        createdAt: t,
      })
      .run();
    await notify({
      userId: payerIds[i],
      communityId: community.id,
      type: "cost_posted",
      title: `Payment due · ${event.title}`,
      body: `Pay ${formatMoney(amountCents, community.currency)} to ${collectorLabel}. ${paymentInfo}`,
      href: `/app/c/${community.slug}/ledger`,
    });
  }

  audit({
    communityId: community.id,
    actorId: user.id,
    action: "weekly.payment_request",
    entityType: "weekly_event",
    entityId: event.id,
    meta: { cents, attendees: payerIds.length },
  });

  await notify({
    userId: collectorUserId,
    communityId: community.id,
    type: "ledger_approval",
    title: `Payments incoming · ${event.title}`,
    body: `${payerIds.length} players were asked to pay. Verify each when you receive money.`,
    href: `/app/c/${community.slug}/ledger`,
  });

  revalidatePath(`/app/c/${community.slug}/events/${event.id}`);
  revalidatePath(`/app/c/${community.slug}/ledger`);
  revalidatePath(`/app/c/${community.slug}`);
  return { ok: true };
}

export async function closeWeeklyEvent(eventId: string) {
  const user = await requireUser();
  const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, eventId)).get();
  if (!event) return { error: "Event not found." };
  requireAdmin(event.communityId, user.id);
  if (event.status === "completed") return { error: "Already closed." };
  if (event.status === "cancelled") return { error: "This event was cancelled." };

  const { eventLedgerAllSettled } = await import("@/lib/ledger-status");
  if (event.paymentRequestedAt && !eventLedgerAllSettled(event.id)) {
    return { error: "Every share must be verified before you can close the event." };
  }

  db.update(weeklyEvents).set({ status: "completed" }).where(eq(weeklyEvents.id, eventId)).run();
  const community = db.select().from(communities).where(eq(communities.id, event.communityId)).get();
  if (!community) return { error: "Community not found." };
  audit({
    communityId: community.id,
    actorId: user.id,
    action: "weekly.close",
    entityType: "weekly_event",
    entityId: event.id,
  });
  revalidatePath(`/app/c/${community.slug}/events/${event.id}`);
  revalidatePath(`/app/c/${community.slug}`);
  return { ok: true };
}

/** @deprecated use sendWeeklyPaymentRequest */
export async function postWeeklyCost(formData: FormData) {
  return sendWeeklyPaymentRequest(formData);
}

function collectorNameSafe(userId: string) {
  return db.select().from(users).where(eq(users.id, userId)).get()?.name ?? "the collector";
}

export async function promoteWaitlistMember(formData: FormData) {
  const user = await requireUser();
  const eventId = String(formData.get("eventId") ?? "");
  const waitlistUserId = String(formData.get("userId") ?? "");
  const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, eventId)).get();
  if (!event) return { error: "Event not found." };
  requireAdmin(event.communityId, user.id);
  const { eventWaitlist } = await import("@/lib/db/schema");
  const row = db
    .select()
    .from(eventWaitlist)
    .where(and(eq(eventWaitlist.eventId, eventId), eq(eventWaitlist.userId, waitlistUserId)))
    .get();
  if (!row) return { error: "Not on the waitlist." };
  if (event.maxPlayers != null && goingHeadcount(eventId) >= event.maxPlayers) {
    return { error: "The session is full. Free a Going spot first." };
  }
  const t = now();
  db.delete(eventWaitlist).where(eq(eventWaitlist.id, row.id)).run();
  const existing = db
    .select()
    .from(rsvps)
    .where(and(eq(rsvps.eventId, eventId), eq(rsvps.userId, waitlistUserId)))
    .get();
  if (existing) {
    db.update(rsvps).set({ status: "going", updatedAt: t }).where(eq(rsvps.id, existing.id)).run();
  } else {
    db.insert(rsvps)
      .values({ id: createId(), eventId, userId: waitlistUserId, status: "going", updatedAt: t })
      .run();
  }
  const community = db.select().from(communities).where(eq(communities.id, event.communityId)).get();
  if (community) {
    await notify({
      userId: waitlistUserId,
      communityId: community.id,
      type: "waitlist_promoted",
      title: `You're in · ${event.title}`,
      body: `An admin moved you from the waitlist to Going.`,
      href: `/app/c/${community.slug}/events/${event.id}`,
    });
    await maybeReadyToBook(community, event.id);
    revalidatePath(`/app/c/${community.slug}/events/${event.id}`);
    revalidatePath(`/app/c/${community.slug}`);
  }
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
      return { error: "Guests can be added after this season's nights are created." };
    }
    if (row.status === "cancelled") return { error: "This night was cancelled." };
    const hostSlot = db
      .select()
      .from(sessionSlots)
      .where(and(eq(sessionSlots.sessionId, sessionId), eq(sessionSlots.userId, user.id)))
      .get();
    if (!hostSlot || !sessionSlotIsGoing(hostSlot.status)) {
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
