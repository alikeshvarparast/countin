import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin } from "@/lib/access";
import { EditWeeklyEventForm } from "@/components/edit-weekly-form";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { weeklyEvents } from "@/lib/db/schema";
import { clubSafeReturnPath, weeklyEventEditDefaults } from "@/lib/utils";

export default async function EditEventPage({
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
  if (event.status === "cancelled" || event.status === "completed") {
    redirect(`/app/c/${slug}/events/${id}`);
  }

  const eventHref = `/app/c/${slug}/events/${id}`;
  const returnTo = clubSafeReturnPath(returnRaw, slug, eventHref);
  const defaults = weeklyEventEditDefaults(event, community.timezone, community.location ?? "");
  const backLabel = returnTo === eventHref || returnTo.startsWith(`${eventHref}/`) ? "Back to event" : "Back";

  return (
    <div className="mx-auto w-full min-w-0 max-w-lg px-1 sm:px-0">
      <Link href={returnTo} className="text-sm text-primary">
        ← {backLabel}
      </Link>
      <h2 className="mt-3 font-display text-2xl">Edit event</h2>
      <p className="mt-1 text-sm text-ink/55">Update the session details. Members keep their RSVPs.</p>
      <Card className="mt-6">
        <EditWeeklyEventForm slug={slug} eventId={event.id} defaults={defaults} returnTo={returnTo} />
      </Card>
    </div>
  );
}
