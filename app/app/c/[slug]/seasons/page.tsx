import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin } from "@/lib/access";
import { Badge, Card } from "@/components/ui";
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
    .all();

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
      <div className="mt-6 space-y-3">
        {rows.length === 0 && <Card>No seasons yet.</Card>}
        {rows.map((s) => {
          const days = (JSON.parse(s.weekdays) as number[]).map((d) => WEEKDAY_LABELS[d].slice(0, 3)).join(", ");
          return (
            <Link key={s.id} href={`/app/c/${slug}/seasons/${s.id}`}>
              <Card className="hover:border-lime/40">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{s.name}</h3>
                  <Badge>
                    {s.status === "signup" ? "voting" : s.timeLocal}
                    {s.status !== "signup" && s.durationMinutes ? ` · ${formatDuration(s.durationMinutes)}` : ""}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-cream/50">
                  {s.status === "signup"
                    ? "Contract vote — nights not created yet"
                    : `${s.startDate} → ${s.endDate} · ${days}`}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
