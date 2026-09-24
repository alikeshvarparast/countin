import Link from "next/link";
import { eq } from "drizzle-orm";
import { MapPin, Plus, Search } from "lucide-react";
import { auth } from "@/auth";
import { searchCommunities } from "@/lib/access";
import { AppHeader } from "@/components/header";
import { Avatar } from "@/components/avatar";
import { ItemGrid } from "@/components/page-frame";
import { Input } from "@/components/ui";
import { db } from "@/lib/db";
import { memberships, users } from "@/lib/db/schema";

/** Pick up to `count` members, preferring a mix of photos + initials in the stack. */
function pickRandomMembers<T extends { user: { imageUrl: string | null } }>(
  items: T[],
  count: number,
  seed: string,
): T[] {
  if (items.length <= count) return [...items];
  const withPic = items.filter((i) => i.user.imageUrl);
  const without = items.filter((i) => !i.user.imageUrl);
  const shuffle = <U,>(arr: U[], salt: string) => {
    const copy = [...arr];
    let h = 2166136261;
    for (let i = 0; i < seed.length + salt.length; i++) {
      h ^= (seed + salt).charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    for (let i = copy.length - 1; i > 0; i--) {
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      const j = Math.abs(h) % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  // Aim for ~3 photos + initials when available, so stacks don't look empty or all-photo.
  const wantPic = Math.min(withPic.length, Math.max(1, Math.min(3, count - 1)));
  const pickedPic = shuffle(withPic, "p").slice(0, wantPic);
  const pickedRest = shuffle(
    [...without, ...withPic.filter((p) => !pickedPic.includes(p))],
    "r",
  ).slice(0, count - pickedPic.length);
  return shuffle([...pickedPic, ...pickedRest], "m");
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const session = await auth();
  const clubs = searchCommunities(query, session?.user?.id);

  const memberCounts = new Map<string, number>();
  const faces = new Map<string, { name: string; imageUrl: string | null }[]>();
  const myIds = new Set<string>();
  const pendingIds = new Set<string>();

  for (const club of clubs) {
    const rows = db
      .select({
        membership: memberships,
        user: users,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.communityId, club.id))
      .all();
    const approved = rows.filter((r) => r.membership.status === "approved");
    memberCounts.set(club.id, approved.length);
    // Always show 5 members: photo when they have one, otherwise initials.
    faces.set(
      club.id,
      pickRandomMembers(approved, 5, club.id).map((r) => ({
        name: r.user.name,
        imageUrl: r.user.imageUrl,
      })),
    );
  }

  if (session?.user?.id) {
    const mine = db.select().from(memberships).where(eq(memberships.userId, session.user.id)).all();
    for (const row of mine) {
      if (row.status === "approved") myIds.add(row.communityId);
      if (row.status === "pending") pendingIds.add(row.communityId);
    }
  }

  const mine = clubs.filter((c) => myIds.has(c.id));
  const rest = clubs.filter((c) => !myIds.has(c.id));

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto w-full px-4 pb-16 pt-6 sm:px-6 sm:pt-10 lg:px-8">
        <div className="rounded-3xl border border-line bg-card px-5 py-8 text-ink sm:px-8 sm:py-10">
          <p className="text-[11px] uppercase tracking-[0.22em] text-ink/60">Find your club</p>
          <h1 className="mt-2 max-w-xl font-display text-4xl leading-none text-ink sm:text-5xl">Search communities. Join the squad.</h1>
          <p className="mt-3 max-w-lg text-sm text-ink/70 sm:text-base">
            Look up a club by name or UID. Public clubs can be requested; private clubs need an invite link.
          </p>
          <form action="/" method="get" className="mt-6 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
              <Input
                name="q"
                defaultValue={query}
                placeholder="Club name or UID"
                aria-label="Search clubs by name or UID"
                className="border-0 bg-muted pl-10 text-ink"
              />
            </div>
            <button
              type="submit"
              className="flex min-h-11 items-center justify-center rounded-full bg-pitch-3 px-5 font-medium text-ink"
            >
              Search
            </button>
          </form>
        </div>

        {session && (
          <div className="mt-5 flex justify-end">
            <Link
              href="/app/communities/new"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-ink"
            >
              <Plus className="h-4 w-4" />
              New community
            </Link>
          </div>
        )}

        {mine.length > 0 && !query && (
          <section className="mt-10">
            <h2 className="font-display text-2xl">Your clubs</h2>
            <ItemGrid className="mt-4">
              {mine.map((c) => (
                <ClubCard
                  key={c.id}
                  club={c}
                  href={`/app/c/${c.slug}`}
                  members={memberCounts.get(c.id) ?? 0}
                  faces={faces.get(c.id) ?? []}
                  badge="Member"
                />
              ))}
            </ItemGrid>
          </section>
        )}

        <section className="mt-10">
          <h2 className="font-display text-2xl">{query ? `Results for “${query}”` : "Public communities"}</h2>
          <ItemGrid className="mt-4">
            {(query ? clubs : rest).length === 0 && (
              <p className="col-span-full rounded-2xl border border-dashed border-line bg-card px-4 py-10 text-center text-ink/50">
                {query
                  ? "No club matches that search."
                  : "No public communities yet. Yours stay in Your clubs until you make them visible."}
              </p>
            )}
            {(query ? clubs : rest).map((c) => (
              <ClubCard
                key={c.id}
                club={c}
                href={myIds.has(c.id) ? `/app/c/${c.slug}` : `/communities/${c.slug}`}
                members={memberCounts.get(c.id) ?? 0}
                faces={faces.get(c.id) ?? []}
                badge={
                  pendingIds.has(c.id)
                    ? "Pending"
                    : myIds.has(c.id)
                      ? "Member"
                      : c.isPublic
                        ? undefined
                        : "Private"
                }
              />
            ))}
          </ItemGrid>
        </section>
      </main>
    </div>
  );
}

function ClubCard({
  club,
  href,
  members,
  faces,
  badge,
}: {
  club: {
    id: string;
    name: string;
    slug: string;
    uid: string;
    location: string | null;
    description: string | null;
    imageUrl: string | null;
    isPublic: boolean;
  };
  href: string;
  members: number;
  faces: { name: string; imageUrl: string | null }[];
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-[0_10px_30px_rgba(63,58,52,0.06)] transition hover:-translate-y-0.5 hover:border-primary/35"
    >
      <div className="pitch-banner pitch-lines h-20" />
      <div className="-mt-8 px-5 pb-5">
        <Avatar src={club.imageUrl} name={club.name} size="lg" />
        <div className="mt-3 flex items-start justify-between gap-2">
          <h3 className="font-display text-2xl leading-tight group-hover:text-primary">{club.name}</h3>
          {badge && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">{badge}</span>
          )}
        </div>
        <p className="mt-1 flex items-center gap-1 text-sm text-ink/55">
          <MapPin className="h-3.5 w-3.5" />
          {club.location || "Pitch TBD"}
        </p>
        <p className="mt-1 font-mono text-[11px] tracking-widest text-ink/60">UID {club.uid}</p>
        {club.description && <p className="mt-2 line-clamp-2 text-sm text-ink/65">{club.description}</p>}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex -space-x-2">
            {faces.map((f, i) => (
              <Avatar key={`${f.name}-${i}`} src={f.imageUrl} name={f.name} size="sm" />
            ))}
          </div>
          <span className="text-xs text-ink/45">
            {members} {members === 1 ? "player" : "players"}
          </span>
        </div>
      </div>
    </Link>
  );
}
