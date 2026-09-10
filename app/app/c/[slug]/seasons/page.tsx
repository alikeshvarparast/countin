import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin } from "@/lib/access";
import { ItemList } from "@/components/page-frame";
import { Badge } from "@/components/ui";
import { db } from "@/lib/db";
import { seasons } from "@/lib/db/schema";
import { formatDuration, WEEKDAY_LABELS } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function SeasonsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const community = getCommunityBySlug(slug);
  if (!community) notFound();
  const session = await auth();
  const admin = session?.user?.id ? isAdmin(community.id, session.user.id) : false;
  const rows = db
    .select()
    .from(seasons)
    .where(eq(seasons.communityId, community.id))
    .orderBy(desc(seasons.createdAt))
    .all()
    .filter((s) => s.status !== "cancelled");

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-2xl">Long-term seasons</h2>
        {admin && (
          <Link href={`/app/c/${slug}/seasons/new`} className="flex min-h-11 items-center justify-center rounded-full bg-primary px-4 py-2 text-sm text-ink">
            New season
          </Link>
        )}
      </div>
      <ItemList className="mt-6">
        {rows.length === 0 && <li className="px-3 py-6 text-sm text-ink/45">No seasons yet.</li>}
        {rows.map((s) => {
          const days = (JSON.parse(s.weekdays) as number[]).map((d) => WEEKDAY_LABELS[d].slice(0, 3)).join(", ");
          const badge =
            s.status === "signup"
              ? "voting"
              : s.status === "agreed"
                ? "agreement closed"
                : s.status === "cancelled"
                  ? "cancelled"
                  : `${s.timeLocal}${s.durationMinutes ? ` · ${formatDuration(s.durationMinutes)}` : ""}`;
          const summary =
            s.status === "signup"
              ? "Contract vote — nights not created yet"
              : s.status === "agreed"
                ? "Agreement closed — waiting for nights"
                : s.status === "cancelled"
                  ? "Cancelled — hidden from the event list"
                  : `${s.startDate} → ${s.endDate} · ${days}`;
          return (
            <li key={s.id} className="border-b border-line last:border-b-0">
              <Link href={`/app/c/${slug}/seasons/${s.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/60">
                <p className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-medium">{s.name}</span>
                  <span className="ml-2 text-ink/45">{summary}</span>
                </p>
                <Badge>{badge}</Badge>
              </Link>
            </li>
          );
        })}
      </ItemList>
    </div>
  );
}
