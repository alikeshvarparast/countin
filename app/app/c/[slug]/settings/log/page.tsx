import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getCommunityBySlug, isOwner } from "@/lib/access";
import { AdminLogFilter } from "@/components/admin-log-filter";
import { AdminLogList } from "@/components/admin-log-list";
import { Card } from "@/components/ui";
import { countCommunityLogs, listCommunityLogs, parseLogDate } from "@/lib/audit";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

export default async function AdminLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; from?: string; to?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const community = getCommunityBySlug(slug);
  if (!community) notFound();
  const session = await auth();
  if (!session?.user?.id || !isOwner(community.id, session.user.id)) notFound();

  const from = parseLogDate(query.from);
  const to = parseLogDate(query.to);
  const total = countCommunityLogs(community.id, from, to, community.timezone);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(query.page) || 1));
  const logs = listCommunityLogs(community.id, {
    from,
    to,
    timeZone: community.timezone,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const people = db.select().from(users).all();
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? id;

  function href(next: { page?: number; from?: string; to?: string }) {
    const params = new URLSearchParams();
    const nextFrom = next.from ?? from;
    const nextTo = next.to ?? to;
    if (nextFrom) params.set("from", nextFrom);
    if (nextTo) params.set("to", nextTo);
    const nextPage = next.page ?? page;
    if (nextPage > 1) params.set("page", String(nextPage));
    const q = params.toString();
    return q ? `/app/c/${slug}/settings/log?${q}` : `/app/c/${slug}/settings/log`;
  }

  const pageLinks = visiblePages(page, pages);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <Link href={`/app/c/${slug}/settings`} className="text-sm text-primary">
          ← Settings
        </Link>
        <h1 className="mt-2 font-display text-2xl">Admin log</h1>
        <p className="mt-1 text-sm text-ink/50">
          {total === 1 ? "1 action" : `${total} actions`}
          {from || to ? " in this range" : ""}.
        </p>
      </div>

      <Card>
        <AdminLogFilter slug={slug} from={from} to={to} />
      </Card>

      <Card>
        <AdminLogList logs={logs} timezone={community.timezone} nameOf={nameOf} />
        {pages > 1 && (
          <nav className="mt-5 flex flex-wrap items-center gap-1.5" aria-label="Log pages">
            {page > 1 && (
              <PageLink href={href({ page: page - 1 })}>Previous</PageLink>
            )}
            {pageLinks.map((n, i) =>
              n === "…" ? (
                <span key={`gap-${i}`} className="px-1 text-sm text-ink/40">
                  …
                </span>
              ) : (
                <PageLink key={n} href={href({ page: n })} current={n === page}>
                  {n}
                </PageLink>
              ),
            )}
            {page < pages && (
              <PageLink href={href({ page: page + 1 })}>Next</PageLink>
            )}
          </nav>
        )}
      </Card>
    </div>
  );
}

function PageLink({
  href,
  current,
  children,
}: {
  href: string;
  current?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "inline-flex min-h-8 min-w-8 items-center justify-center rounded-full px-2.5 text-sm",
        current ? "bg-primary font-medium text-ink" : "text-ink/70 hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}

function visiblePages(page: number, pages: number): (number | "…")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const marks = new Set([1, pages, page, page - 1, page + 1]);
  const nums = [...marks].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  for (const n of nums) {
    const prev = out[out.length - 1];
    if (typeof prev === "number" && n - prev > 1) out.push("…");
    out.push(n);
  }
  return out;
}
