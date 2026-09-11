import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin } from "@/lib/access";
import { ItemList } from "@/components/page-frame";
import { Badge } from "@/components/ui";
import { db } from "@/lib/db";
import { seasonSessions, seasons, weeklyEvents } from "@/lib/db/schema";
import { eventWindowEnd, formatEventWhen, formatWhen } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function EventsListPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ scope?: string }>;
}) {
  const { slug } = await params;
  const { scope } = await searchParams;
  const community = getCommunityBySlug(slug);
  if (!community) notFound();
  const session = await auth();
  const admin = session?.user?.id ? isAdmin(community.id, session.user.id) : false;
  const now = Date.now();
  const pastOnly = scope === "past";

  const events = db
    .select()
    .from(weeklyEvents)
    .where(eq(weeklyEvents.communityId, community.id))
    .orderBy(desc(weeklyEvents.createdAt))
    .all()
    .filter((e) => e.status !== "cancelled");

  const seasonRows = db.select().from(seasons).where(eq(seasons.communityId, community.id)).all();
  const seasonName = (id: string) => seasonRows.find((s) => s.id === id)?.name ?? "Season";
  const sessions = db
    .select()
    .from(seasonSessions)
    .where(eq(seasonSessions.communityId, community.id))
    .orderBy(desc(seasonSessions.startsAt))
    .all()
    .filter((s) => s.status !== "cancelled");

  const pastWeekly = events
    .filter((e) => {
      if (e.status === "completed") return true;
      if (!e.startsAt) return false;
      return (eventWindowEnd(e) ?? e.startsAt) < now;
    })
    .sort((a, b) => (b.startsAt ?? b.createdAt) - (a.startsAt ?? a.createdAt));

  const pastSessions = sessions.filter((s) => {
    const duration = seasonRows.find((row) => row.id === s.seasonId)?.durationMinutes ?? 120;
    return s.startsAt + duration * 60_000 < now;
  });

  const listItems = pastOnly
    ? [
        ...pastWeekly.map((e) => ({
          key: e.id,
          href: `/app/c/${slug}/events/${e.id}`,
          title: e.title,
          when: formatEventWhen(e.startsAt, community.timezone, e.hasTime, e.durationMinutes),
          location: e.location || community.location || "Pitch TBD",
          status: e.status,
          at: e.startsAt ?? e.createdAt,
        })),
        ...pastSessions.map((s) => ({
          key: s.id,
          href: `/app/c/${slug}/sessions/${s.id}`,
          title: seasonName(s.seasonId),
          when: formatWhen(s.startsAt, community.timezone),
          location: seasonRows.find((row) => row.id === s.seasonId)?.location || community.location || "Pitch TBD",
          status: s.status,
          at: s.startsAt,
        })),
      ].sort((a, b) => b.at - a.at)
    : events.map((e) => ({
        key: e.id,
        href: `/app/c/${slug}/events/${e.id}`,
        title: e.title,
        when: formatEventWhen(e.startsAt, community.timezone, e.hasTime, e.durationMinutes),
        location: e.location || community.location || "Pitch TBD",
        status: e.status,
        at: e.startsAt ?? e.createdAt,
      }));

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-2xl">{pastOnly ? "Past events" : "Weekly arrangement"}</h2>
        <div className="flex flex-wrap items-center gap-3">
          {pastOnly ? (
            <Link href={`/app/c/${slug}/events`} className="text-sm text-primary">
              All events
            </Link>
          ) : (
            <Link href={`/app/c/${slug}/events?scope=past`} className="text-sm text-primary">
              Past events
            </Link>
          )}
          {admin && (
            <Link
              href={`/app/c/${slug}/events/new`}
              className="flex min-h-11 items-center justify-center rounded-full bg-primary px-4 py-2 text-sm text-ink"
            >
              New event
            </Link>
          )}
        </div>
      </div>
      <ItemList className="mt-6">
        {listItems.length === 0 && (
          <li className="px-3 py-6 text-sm text-ink/45">{pastOnly ? "No past events yet." : "No weekly events yet."}</li>
        )}
        {listItems.map((item) => (
          <li key={item.key} className="border-b border-line last:border-b-0">
            <Link href={item.href} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/60">
              <p className="min-w-0 flex-1 truncate text-sm">
                <span className="font-medium">{item.title}</span>
                <span className="ml-2 text-ink/45">
                  {item.when} · {item.location}
                </span>
              </p>
              <Badge>{item.status.replaceAll("_", " ")}</Badge>
            </Link>
          </li>
        ))}
      </ItemList>
    </div>
  );
}
