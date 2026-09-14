import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  communities,
  ledgerEntries,
  notifications,
  polls,
  rsvps,
  seasonSessions,
  seasons,
  sessionSlots,
  weeklyEvents,
} from "@/lib/db/schema";
import { notify, notifyMany } from "@/lib/notify";
import { listAdmins, listApprovedMembers } from "@/lib/access";
import { now } from "@/lib/id";
import { msToZonedDateAndTime, zonedDateTimeToUtcMs } from "@/lib/timezone";
import {
  eventWindowEnd,
  formatMoney,
  formatTime,
  hasClockTime,
  sessionSlotIsGoing,
} from "@/lib/utils";

const SIX_HOURS = 6 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

/** 9:00 PM club-local time on the calendar day before the event. */
function eveReminderAtMs(startsAt: number, timeZone: string) {
  const { date } = msToZonedDateAndTime(startsAt, timeZone);
  const [y, m, d] = date.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d));
  prev.setUTCDate(prev.getUTCDate() - 1);
  const py = prev.getUTCFullYear();
  const pm = String(prev.getUTCMonth() + 1).padStart(2, "0");
  const pd = String(prev.getUTCDate()).padStart(2, "0");
  return zonedDateTimeToUtcMs(`${py}-${pm}-${pd}`, "21:00", timeZone);
}

export async function sendDeadlineReminders() {
  const t = now();
  const windowEnd = t + SIX_HOURS;

  const openEvents = db.select().from(weeklyEvents).all();
  for (const event of openEvents) {
    if (event.status === "cancelled") continue;
    const community = db.select().from(communities).where(eq(communities.id, event.communityId)).get();
    if (!community) continue;

    if (event.status === "polling" && event.id) {
      const poll = db.select().from(polls).where(eq(polls.eventId, event.id)).get();
      if (poll?.closesAt && poll.closesAt > t && poll.closesAt <= windowEnd) {
        await remindOnce(
          event.id,
          "poll_closing",
          listApprovedMembers(community.id).map((m) => m.userId),
          {
            communityId: community.id,
            title: `Poll closing soon · ${event.title}`,
            body: `Vote before the poll closes for ${community.name}.`,
            href: `/app/c/${community.slug}/events/${event.id}`,
          },
        );
      }
    }

    if (
      ["open", "ready_to_book", "booked"].includes(event.status) &&
      event.rsvpDeadlineAt &&
      event.rsvpDeadlineAt > t &&
      event.rsvpDeadlineAt <= windowEnd
    ) {
      await remindOnce(
        event.id,
        "rsvp_deadline",
        listApprovedMembers(community.id).map((m) => m.userId),
        {
          communityId: community.id,
          title: `RSVP deadline soon · ${event.title}`,
          body: `Change your presence before the deadline.`,
          href: `/app/c/${community.slug}/events/${event.id}`,
        },
      );
    }

    if (
      ["open", "ready_to_book", "booked"].includes(event.status) &&
      hasClockTime(event.hasTime) &&
      event.startsAt &&
      event.startsAt > t &&
      event.startsAt <= windowEnd
    ) {
      await remindOnce(
        event.id,
        "session_reminder",
        listApprovedMembers(community.id).map((m) => m.userId),
        {
          communityId: community.id,
          title: `Kickoff soon · ${event.title}`,
          body: `Session for ${community.name} is coming up.`,
          href: `/app/c/${community.slug}/events/${event.id}`,
        },
      );
    }

    if (
      event.paymentMode === "postpay" &&
      !event.paymentRequestedAt &&
      event.startsAt &&
      (eventWindowEnd(event) ?? event.startsAt) < t &&
      event.status !== "cancelled" &&
      event.status !== "polling" &&
      event.status !== "completed"
    ) {
      await remindOnce(event.id, "postpay_cost_due", listAdmins(community.id).map((a) => a.userId), {
        communityId: community.id,
        title: `Close the event · ${event.title}`,
        body: `The session is over. Open Cost, confirm who played, and send payment requests.`,
        href: `/app/c/${community.slug}/events/${event.id}`,
      });
    }
  }

  for (const season of db.select().from(seasons).all()) {
    if (season.status !== "signup" || !season.signupClosesAt) continue;
    if (season.signupClosesAt <= t || season.signupClosesAt > windowEnd) continue;
    const community = db.select().from(communities).where(eq(communities.id, season.communityId)).get();
    if (!community) continue;
    await remindOnce(season.id, "season_signup_deadline", listApprovedMembers(community.id).map((m) => m.userId), {
      communityId: community.id,
      title: `Agreement deadline soon · ${season.name}`,
      body: `Say whether you want a contract place. Nights stay off the event list until an admin closes this vote.`,
      href: `/app/c/${community.slug}/seasons/${season.id}`,
    });
    await remindOnce(season.id, "season_signup_close_admin", listAdmins(community.id).map((a) => a.userId), {
      communityId: community.id,
      title: `Close the agreement · ${season.name}`,
      body: `The deadline is soon. Close the vote when ready, then create the nights.`,
      href: `/app/c/${community.slug}/seasons/${season.id}`,
    });
  }

  await sendEveGoingReminders();
  await sendUnpaidShareReminders();
}

/** 9pm club-local on the day before: remind people who are going. */
export async function sendEveGoingReminders() {
  const t = now();

  for (const event of db.select().from(weeklyEvents).all()) {
    if (event.status === "cancelled" || event.status === "completed" || event.status === "polling") continue;
    if (!event.startsAt || event.startsAt <= t) continue;
    const community = db.select().from(communities).where(eq(communities.id, event.communityId)).get();
    if (!community) continue;
    const eveAt = eveReminderAtMs(event.startsAt, community.timezone);
    if (t < eveAt) continue;

    const goingIds = db
      .select()
      .from(rsvps)
      .where(eq(rsvps.eventId, event.id))
      .all()
      .filter((r) => r.status === "going")
      .map((r) => r.userId);
    if (goingIds.length === 0) continue;

    const when = hasClockTime(event.hasTime)
      ? formatTime(event.startsAt, community.timezone)
      : "time TBD";
    await remindOnce(event.id, "eve_going", goingIds, {
      communityId: community.id,
      title: `Tomorrow · ${event.title}`,
      body: `You're going. The session is tomorrow at ${when}.`,
      href: `/app/c/${community.slug}/events/${event.id}`,
    });
  }

  for (const session of db.select().from(seasonSessions).all()) {
    if (session.status === "cancelled" || session.startsAt <= t) continue;
    const community = db.select().from(communities).where(eq(communities.id, session.communityId)).get();
    if (!community) continue;
    const season = db.select().from(seasons).where(eq(seasons.id, session.seasonId)).get();
    if (!season || season.status === "cancelled") continue;
    const eveAt = eveReminderAtMs(session.startsAt, community.timezone);
    if (t < eveAt) continue;

    const goingIds = db
      .select()
      .from(sessionSlots)
      .where(eq(sessionSlots.sessionId, session.id))
      .all()
      .filter((s) => sessionSlotIsGoing(s.status))
      .map((s) => s.userId);
    if (goingIds.length === 0) continue;

    const when = formatTime(session.startsAt, community.timezone);
    await remindOnce(session.id, "eve_going", goingIds, {
      communityId: community.id,
      title: `Tomorrow · ${season.name}`,
      body: `You're going. Kickoff is tomorrow at ${when}.`,
      href: `/app/c/${community.slug}/sessions/${session.id}`,
    });
  }
}

/** Notify payers with open dues every 24h; warn admins/collector too. */
export async function sendUnpaidShareReminders() {
  const pending = db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.status, "pending"))
    .all()
    .filter((row) => row.reason === "weekly_share" || row.reason === "contract_prepay");

  if (pending.length === 0) return;

  const byEvent = new Map<string, typeof pending>();
  const bySeason = new Map<string, typeof pending>();

  for (const entry of pending) {
    const community = db.select().from(communities).where(eq(communities.id, entry.communityId)).get();
    if (!community) continue;

    let label = "your share";
    let href = `/app/c/${community.slug}/ledger?due=${entry.id}`;
    if (entry.weeklyEventId) {
      const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, entry.weeklyEventId)).get();
      if (!event || event.status === "cancelled") continue;
      label = event.title;
      href = `/app/c/${community.slug}/events/${event.id}?due=${entry.id}`;
      const list = byEvent.get(event.id) ?? [];
      list.push(entry);
      byEvent.set(event.id, list);
    } else if (entry.seasonId) {
      const season = db.select().from(seasons).where(eq(seasons.id, entry.seasonId)).get();
      if (!season || season.status === "cancelled") continue;
      label = season.name;
      href = `/app/c/${community.slug}/ledger?due=${entry.id}`;
      const list = bySeason.get(season.id) ?? [];
      list.push(entry);
      bySeason.set(season.id, list);
    } else {
      continue;
    }

    await remindEvery(entry.fromUserId, entry.id, "share_unpaid", DAY, {
      communityId: community.id,
      title: `Payment still due · ${label}`,
      body: `Please pay ${formatMoney(entry.amountCents, community.currency)} and mark I have paid on the ledger.`,
      href,
    });
  }

  for (const [eventId, rows] of byEvent) {
    const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, eventId)).get();
    if (!event) continue;
    const community = db.select().from(communities).where(eq(communities.id, event.communityId)).get();
    if (!community) continue;
    const recipients = new Set(listAdmins(community.id).map((a) => a.userId));
    if (event.collectorUserId) recipients.add(event.collectorUserId);
    await remindEveryMany([...recipients], eventId, "share_unpaid_warning", DAY, {
      communityId: community.id,
      title: `Unpaid shares · ${event.title}`,
      body: `${rows.length} player${rows.length === 1 ? "" : "s"} still have not paid. Open Cost or the ledger to follow up.`,
      href: `/app/c/${community.slug}/events/${event.id}`,
    });
  }

  for (const [seasonId, rows] of bySeason) {
    const season = db.select().from(seasons).where(eq(seasons.id, seasonId)).get();
    if (!season) continue;
    const community = db.select().from(communities).where(eq(communities.id, season.communityId)).get();
    if (!community) continue;
    const recipients = new Set(listAdmins(community.id).map((a) => a.userId));
    if (season.collectorUserId) recipients.add(season.collectorUserId);
    await remindEveryMany([...recipients], seasonId, "share_unpaid_warning", DAY, {
      communityId: community.id,
      title: `Unpaid season dues · ${season.name}`,
      body: `${rows.length} member${rows.length === 1 ? "" : "s"} still have not paid. Check the ledger.`,
      href: `/app/c/${community.slug}/ledger`,
    });
  }
}

async function remindOnce(
  entityId: string,
  type: string,
  userIds: string[],
  payload: { communityId: string; title: string; body: string; href: string },
) {
  const already = db
    .select()
    .from(notifications)
    .where(eq(notifications.type, type))
    .all()
    .some((n) => n.href?.includes(entityId));
  if (already) return;
  await notifyMany(userIds, { ...payload, type });
}

async function remindEvery(
  userId: string,
  entityKey: string,
  type: string,
  intervalMs: number,
  payload: { communityId: string; title: string; body: string; href: string },
) {
  const cutoff = now() - intervalMs;
  const recent = db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .all()
    .some((n) => n.type === type && n.href?.includes(entityKey) && n.createdAt > cutoff);
  if (recent) return;
  await notify({ userId, ...payload, type });
}

async function remindEveryMany(
  userIds: string[],
  entityKey: string,
  type: string,
  intervalMs: number,
  payload: { communityId: string; title: string; body: string; href: string },
) {
  for (const userId of userIds) {
    await remindEvery(userId, entityKey, type, intervalMs, payload);
  }
}
