import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin } from "@/lib/access";
import { Badge, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { seasonSessions, weeklyEvents } from "@/lib/db/schema";
import { formatWhen } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function CommunityOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
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
    .slice(0, 5);
  const sessions = db
    .select()
    .from(seasonSessions)
    .where(eq(seasonSessions.communityId, community.id))
    .orderBy(desc(seasonSessions.startsAt))
    .all()
    .filter((s) => s.startsAt >= Date.now() - 12 * 60 * 60 * 1000)
    .slice(0, 6);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-lime">Weekly</h2>
          {admin && (
            <Link href={`/app/c/${slug}/events/new`} className="text-sm text-lime">
              New event
            </Link>
          )}
        </div>
        <ul className="mt-4 space-y-3">
          {events.length === 0 && <li className="text-cream/50">No weekly events yet.</li>}
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/app/c/${slug}/events/${e.id}`} className="flex items-center justify-between">
                <span>{e.title}</span>
                <Badge>{e.status.replaceAll("_", " ")}</Badge>
              </Link>
              <p className="text-xs text-cream/40">{formatWhen(e.startsAt, community.timezone)}</p>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-lime">Season sessions</h2>
          {admin && (
            <Link href={`/app/c/${slug}/seasons/new`} className="text-sm text-lime">
              New season
            </Link>
          )}
        </div>
        <ul className="mt-4 space-y-3">
          {sessions.length === 0 && <li className="text-cream/50">No upcoming season sessions.</li>}
          {sessions.map((s) => (
            <li key={s.id}>
              <Link href={`/app/c/${slug}/sessions/${s.id}`} className="flex items-center justify-between">
                <span>{formatWhen(s.startsAt, community.timezone)}</span>
                <Badge>{s.status}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
