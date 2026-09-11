import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin, isSuspended } from "@/lib/access";
import { PresenceVote } from "@/components/presence-vote";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { rsvps, weeklyEvents } from "@/lib/db/schema";
import { clubSafeReturnPath, formatEventWhen } from "@/lib/utils";

export default async function EventPresencePage({
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
  if (!userId) redirect(`/login?next=/app/c/${slug}/events/${id}/presence`);

  const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, id)).get();
  if (!event || event.communityId !== community.id) notFound();
  if (event.status === "cancelled") redirect(`/app/c/${slug}`);

  const admin = isAdmin(community.id, userId);
  const suspended = isSuspended(community.id, userId);
  const deadlinePassed = Boolean(event.rsvpDeadlineAt && Date.now() > event.rsvpDeadlineAt);
  const rsvpOpen = ["open", "ready_to_book", "booked"].includes(event.status);
  const canVote = Boolean(rsvpOpen && !suspended && (!deadlinePassed || admin));
  if (!canVote) redirect(`/app/c/${slug}/events/${id}`);

  const rsvpRows = db.select().from(rsvps).where(eq(rsvps.eventId, event.id)).all();
  const goingCount = rsvpRows.filter((r) => r.status === "going").length;
  const notGoingCount = rsvpRows.filter((r) => r.status === "not_going").length;
  const myStatus = rsvpRows.find((r) => r.userId === userId)?.status ?? null;

  const eventHref = `/app/c/${slug}/events/${id}`;
  const returnTo = clubSafeReturnPath(returnRaw, slug, eventHref);
  const backLabel = returnTo === eventHref || returnTo.startsWith(`${eventHref}/`) ? "Back to event" : "Back";

  return (
    <div className="max-w-lg">
      <Link href={returnTo} className="text-sm text-primary">
        ← {backLabel}
      </Link>
      <h2 className="mt-3 font-display text-2xl">Your presence</h2>
      <p className="mt-1 text-sm text-ink/55">
        {event.title} · {formatEventWhen(event.startsAt, community.timezone, event.hasTime, event.durationMinutes)}
      </p>
      <Card className="mt-6">
        <PresenceVote
          eventId={event.id}
          myStatus={myStatus}
          goingCount={goingCount}
          notGoingCount={notGoingCount}
          canVote
          forceEdit
          returnTo={returnTo}
        />
      </Card>
    </div>
  );
}
