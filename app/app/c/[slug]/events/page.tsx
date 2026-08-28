import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin } from "@/lib/access";
import { Badge, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { weeklyEvents } from "@/lib/db/schema";
import { formatEventWhen } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function EventsListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const community = getCommunityBySlug(slug);
  if (!community) notFound();
  const session = await auth();
  const admin = session?.user?.id ? isAdmin(community.id, session.user.id) : false;
  const events = db
    .select()
    .from(weeklyEvents)
    .where(eq(weeklyEvents.communityId, community.id))
    .orderBy(desc(weeklyEvents.createdAt))
    .all();

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-2xl">Weekly arrangement</h2>
        {admin && (
          <Link href={`/app/c/${slug}/events/new`} className="flex min-h-11 items-center justify-center rounded-full bg-primary px-4 py-2 text-sm text-ink">
            New event
          </Link>
        )}
      </div>
      <div className="mt-6 space-y-3">
        {events.length === 0 && <Card>No weekly events yet.</Card>}
        {events.map((e) => (
          <Link key={e.id} href={`/app/c/${slug}/events/${e.id}`}>
            <Card className="flex items-center justify-between hover:border-lime/40">
              <div>
                <h3 className="font-medium">{e.title}</h3>
                <p className="text-sm text-cream/50">
                  {formatEventWhen(e.startsAt, community.timezone, e.hasTime, e.durationMinutes)} · {e.location || community.location || "Pitch TBD"}
                </p>
              </div>
              <Badge>{e.status.replaceAll("_", " ")}</Badge>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
