import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { communities, memberships } from "@/lib/db/schema";

export default async function AppHomePage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const rows = db
    .select({
      community: communities,
      role: memberships.role,
      status: memberships.status,
    })
    .from(memberships)
    .innerJoin(communities, eq(communities.id, memberships.communityId))
    .where(eq(memberships.userId, session.user.id))
    .orderBy(desc(memberships.updatedAt))
    .all();

  const mine = rows.filter((r) => r.status === "approved");
  const pending = rows.filter((r) => r.status === "pending");

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Your clubs</h1>
          <p className="mt-1 text-cream/60">Admin one, play in others.</p>
        </div>
        <Link href="/app/communities/new" className="rounded-full bg-lime px-4 py-2 text-sm font-medium text-pitch">
          New community
        </Link>
      </div>
      <div className="mt-8 space-y-4">
        {mine.length === 0 && (
          <Card>
            <p className="text-cream/70">You are not in a community yet.</p>
            <div className="mt-3 flex gap-4 text-sm">
              <Link href="/communities" className="text-lime">
                Browse
              </Link>
              <Link href="/app/communities/new" className="text-lime">
                Create one
              </Link>
            </div>
          </Card>
        )}
        {mine.map(({ community, role }) => (
          <Link key={community.id} href={`/app/c/${community.slug}`}>
            <Card className="flex items-center justify-between hover:border-lime/40">
              <div>
                <h2 className="font-display text-2xl text-lime">{community.name}</h2>
                <p className="text-sm text-cream/50">
                  {community.location || "Pitch TBD"} · {role}
                </p>
              </div>
              <span className="text-cream/40">→</span>
            </Card>
          </Link>
        ))}
      </div>
      {pending.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm uppercase tracking-wider text-cream/50">Waiting on approval</h2>
          <ul className="mt-3 space-y-2 text-cream/80">
            {pending.map(({ community }) => (
              <li key={community.id}>{community.name}</li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
