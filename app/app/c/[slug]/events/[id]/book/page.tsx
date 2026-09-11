import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin } from "@/lib/access";
import { BookFieldForm } from "@/components/book-field-form";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { weeklyEvents } from "@/lib/db/schema";
import { clubSafeReturnPath, formatEventWhen } from "@/lib/utils";
import { goingHeadcount } from "@/lib/ledger";

export default async function BookFieldPage({
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
  if (!session?.user?.id || !isAdmin(community.id, session.user.id)) {
    redirect(`/app/c/${slug}/events/${id}`);
  }

  const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, id)).get();
  if (!event || event.communityId !== community.id) notFound();
  if (!["open", "ready_to_book"].includes(event.status)) {
    redirect(`/app/c/${slug}/events/${id}`);
  }

  const headcount = goingHeadcount(event.id);
  const eventHref = `/app/c/${slug}/events/${id}`;
  const returnTo = clubSafeReturnPath(returnRaw, slug, eventHref);
  const backLabel = returnTo === eventHref || returnTo.startsWith(`${eventHref}/`) ? "Back to event" : "Back";

  return (
    <div className="max-w-lg">
      <Link href={returnTo} className="text-sm text-primary">
        ← {backLabel}
      </Link>
      <h2 className="mt-3 font-display text-2xl">Mark field booked</h2>
      <p className="mt-1 text-sm text-ink/55">Confirm the pitch is reserved for {event.title}.</p>
      <Card className="mt-6 space-y-4">
        <div className="text-sm text-ink/70">
          <p className="font-medium text-ink">{event.title}</p>
          <p className="mt-1">
            {formatEventWhen(event.startsAt, community.timezone, event.hasTime, event.durationMinutes)}
          </p>
          <p className="mt-1">{event.location || community.location || "Pitch TBD"}</p>
          <p className="mt-1">
            {headcount} going · minimum {event.minPlayers}
          </p>
        </div>
        <BookFieldForm eventId={event.id} slug={slug} returnTo={returnTo} />
      </Card>
    </div>
  );
}
