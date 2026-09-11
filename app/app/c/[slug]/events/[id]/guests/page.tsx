import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin, isSuspended } from "@/lib/access";
import { EventGuestsPanel } from "@/components/event-guests-panel";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { eventGuests, rsvps, users, weeklyEvents } from "@/lib/db/schema";
import { clubSafeReturnPath, formatEventWhen } from "@/lib/utils";

export default async function EventGuestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { slug, id } = await params;
  const { returnTo: returnRaw } = await searchParams;
  const community = getCommunityBySlug(slug);
  if (!community) notFound();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect(`/login?next=/app/c/${slug}/events/${id}/guests`);

  const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, id)).get();
  if (!event || event.communityId !== community.id) notFound();
  if (event.status === "cancelled") redirect(`/app/c/${slug}`);

  const admin = isAdmin(community.id, userId);
  const suspended = isSuspended(community.id, userId);
  const deadlinePassed = Boolean(event.rsvpDeadlineAt && Date.now() > event.rsvpDeadlineAt);
  const myRsvp = db
    .select()
    .from(rsvps)
    .where(eq(rsvps.eventId, event.id))
    .all()
    .find((r) => r.userId === userId);
  const canAddGuest = Boolean(myRsvp?.status === "going" && !deadlinePassed && !suspended);
  const guests = db.select().from(eventGuests).where(eq(eventGuests.weeklyEventId, event.id)).all();
  const people = db.select({ id: users.id, name: users.name }).from(users).all();
  const nameOf = (uid: string) => people.find((p) => p.id === uid)?.name ?? "Member";
  const guestItems = guests
    .filter((g) => g.status !== "rejected")
    .map((g) => ({
      id: g.id,
      label: g.label,
      hostName: nameOf(g.hostUserId),
      canRemove: Boolean(userId === g.hostUserId || admin),
      status: g.status,
    }));

  if (!canAddGuest && !admin && guestItems.length === 0) {
    redirect(`/app/c/${slug}/events/${id}`);
  }

  const eventHref = `/app/c/${slug}/events/${id}`;
  const returnTo = clubSafeReturnPath(returnRaw, slug, eventHref);
  const backLabel = returnTo === eventHref || returnTo.startsWith(`${eventHref}/`) ? "Back to event" : "Back";

  return (
    <div className="max-w-lg">
      <Link href={returnTo} className="text-sm text-primary">
        ← {backLabel}
      </Link>
      <h2 className="mt-3 font-display text-2xl">Guests</h2>
      <p className="mt-1 text-sm text-ink/55">
        {event.title} · {formatEventWhen(event.startsAt, community.timezone, event.hasTime, event.durationMinutes)}
      </p>
      <Card className="mt-6">
        <EventGuestsPanel eventId={event.id} canAddGuest={canAddGuest} guests={guestItems} />
      </Card>
    </div>
  );
}
