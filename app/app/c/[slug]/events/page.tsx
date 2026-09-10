import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin } from "@/lib/access";
import { ItemList } from "@/components/page-frame";
import { Badge } from "@/components/ui";
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
    .all()
    .filter((e) => e.status !== "cancelled");

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
      <ItemList className="mt-6">
        {events.length === 0 && <li className="px-3 py-6 text-sm text-ink/45">No weekly events yet.</li>}
        {events.map((e) => (
          <li key={e.id} className="border-b border-line last:border-b-0">
            <Link href={`/app/c/${slug}/events/${e.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/60">
              <p className="min-w-0 flex-1 truncate text-sm">
                <span className="font-medium">{e.title}</span>
                <span className="ml-2 text-ink/45">
                  {formatEventWhen(e.startsAt, community.timezone, e.hasTime, e.durationMinutes)} · {e.location || community.location || "Pitch TBD"}
                </span>
              </p>
              <Badge>{e.status.replaceAll("_", " ")}</Badge>
            </Link>
          </li>
        ))}
      </ItemList>
    </div>
  );
}
