import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, polls, weeklyEvents } from "@/lib/db/schema";
import { notifyMany } from "@/lib/notify";
import { listApprovedMembers } from "@/lib/access";
import { communities } from "@/lib/db/schema";
import { now } from "@/lib/id";

const SIX_HOURS = 6 * 60 * 60 * 1000;

export async function sendDeadlineReminders() {
  const t = now();
  const windowEnd = t + SIX_HOURS;

  const openEvents = db.select().from(weeklyEvents).all();
  for (const event of openEvents) {
    const community = db.select().from(communities).where(eq(communities.id, event.communityId)).get();
    if (!community) continue;

    if (
      event.status === "polling" &&
      event.id
    ) {
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
