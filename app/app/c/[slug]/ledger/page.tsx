import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin } from "@/lib/access";
import { LedgerEventGroup, type LedgerEntryView } from "@/components/ledger-event-group";
import { LedgerTrackerNotice } from "@/components/ledger-tracker-notice";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { ledgerEntries, seasonSessions, seasons, users, weeklyEvents } from "@/lib/db/schema";
import { formatEventWhen, formatMoney } from "@/lib/utils";

type LedgerRow = typeof ledgerEntries.$inferSelect;

type EventGroup = {
  key: string;
  title: string;
  subtitle?: string;
  href?: string;
  sortAt: number;
  rows: LedgerRow[];
};

export default async function LedgerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const community = getCommunityBySlug(slug);
  if (!community) notFound();
  const session = await auth();
  const userId = session?.user?.id;
  const admin = userId ? isAdmin(community.id, userId) : false;
  const rows = db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.communityId, community.id))
    .orderBy(desc(ledgerEntries.createdAt))
    .all();
  const people = db.select().from(users).all();
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? id;

  const events = db
    .select()
    .from(weeklyEvents)
    .where(eq(weeklyEvents.communityId, community.id))
    .all();
  const eventOf = (id: string | null) => (id ? events.find((e) => e.id === id) : undefined);

  const seasonRows = db.select().from(seasons).where(eq(seasons.communityId, community.id)).all();
  const seasonOf = (id: string | null) => (id ? seasonRows.find((s) => s.id === id) : undefined);

  const sessions = db
    .select()
    .from(seasonSessions)
    .where(eq(seasonSessions.communityId, community.id))
    .all();
  const sessionOf = (id: string | null) => (id ? sessions.find((s) => s.id === id) : undefined);

  const mine = rows.filter((r) => r.fromUserId === userId || r.toUserId === userId);
  const visible = admin ? rows : mine;

  const owed = mine
    .filter((r) => (r.status === "pending" || r.status === "claimed") && r.fromUserId === userId)
    .reduce((s, r) => s + r.amountCents, 0);
  const dueToMe = mine
    .filter((r) => (r.status === "pending" || r.status === "claimed") && r.toUserId === userId)
    .reduce((s, r) => s + r.amountCents, 0);
  const needsAction = mine.some(
    (r) =>
      (r.status === "pending" && r.fromUserId === userId) ||
      (r.status === "claimed" && r.toUserId === userId),
  );

  const groups = new Map<string, EventGroup>();

  function ensureGroup(group: Omit<EventGroup, "rows">) {
    const existing = groups.get(group.key);
    if (existing) return existing;
    const created: EventGroup = { ...group, rows: [] };
    groups.set(group.key, created);
    return created;
  }

  for (const row of visible) {
    if (row.weeklyEventId) {
      const event = eventOf(row.weeklyEventId);
      const title = event?.title ?? "Weekly event";
      const when = event?.startsAt
        ? formatEventWhen(event.startsAt, community.timezone, event.hasTime, event.durationMinutes)
        : undefined;
      ensureGroup({
        key: `weekly:${row.weeklyEventId}`,
        title,
        subtitle: when,
        href: `/app/c/${slug}/events/${row.weeklyEventId}`,
        sortAt: event?.startsAt ?? row.createdAt,
      }).rows.push(row);
      continue;
    }

    if (row.sessionId) {
      const sess = sessionOf(row.sessionId);
      const season = sess ? seasonOf(sess.seasonId) : undefined;
      const title = season?.name ?? "Season night";
      const when = sess
        ? formatEventWhen(sess.startsAt, community.timezone, true, season?.durationMinutes)
        : undefined;
      ensureGroup({
        key: `session:${row.sessionId}`,
        title,
        subtitle: when ? `${when} · season session` : "Season session",
        href: `/app/c/${slug}/sessions/${row.sessionId}`,
        sortAt: sess?.startsAt ?? row.createdAt,
      }).rows.push(row);
      continue;
    }

    if (row.seasonId) {
      const season = seasonOf(row.seasonId);
      ensureGroup({
        key: `season:${row.seasonId}`,
        title: season?.name ?? "Season",
        subtitle: "Season payment",
        href: `/app/c/${slug}/seasons/${row.seasonId}`,
        sortAt: season?.createdAt ?? row.createdAt,
      }).rows.push(row);
      continue;
    }

    ensureGroup({
      key: "other",
      title: "Other",
      subtitle: "Not tied to an event",
      sortAt: 0,
    }).rows.push(row);
  }

  const grouped = [...groups.values()].sort((a, b) => {
    if (a.key === "other") return 1;
    if (b.key === "other") return -1;
    return b.sortAt - a.sortAt;
  });

  function toViews(list: LedgerRow[]): LedgerEntryView[] {
    return list.map((row) => ({
      id: row.id,
      fromName: nameOf(row.fromUserId),
      toName: nameOf(row.toUserId),
      amountCents: row.amountCents,
      reason: row.reason,
      status: row.status,
      createdAt: row.createdAt,
      canClaim: row.status === "pending" && row.fromUserId === userId,
      canVerify: row.status === "claimed" && row.toUserId === userId,
      verifyHint: row.status === "claimed" && row.toUserId === userId,
    }));
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <LedgerTrackerNotice />
      {needsAction && (
        <Card className="border-clay/40 bg-secondary/10">
          <p className="text-sm font-medium text-ink">You have payments to handle.</p>
          <p className="mt-1 text-sm text-ink/60">
            Mark payments you sent, or verify money that arrived for you.
          </p>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="overflow-hidden">
          <p className="text-xs uppercase tracking-wider text-cream/50">You owe</p>
          <p className="mt-1 font-display text-2xl text-clay">{formatMoney(owed, community.currency)}</p>
        </Card>
        <Card className="overflow-hidden">
          <p className="text-xs uppercase tracking-wider text-cream/50">Owed to you</p>
          <p className="mt-1 font-display text-2xl text-lime">{formatMoney(dueToMe, community.currency)}</p>
        </Card>
      </div>
      <Card>
        <h2 className="font-display text-lg">Entries by event</h2>
        <p className="text-sm text-ink/50">
          After you send money, tap I have paid. The collector then verifies they received it.
        </p>
        <div className="mt-4 space-y-6">
          {grouped.length === 0 && <p className="text-cream/50">Nothing on the ledger yet.</p>}
          {grouped.map((group) => (
            <LedgerEventGroup
              key={group.key}
              title={group.title}
              subtitle={group.subtitle}
              href={group.href}
              currency={community.currency}
              timeZone={community.timezone}
              entries={toViews(group.rows)}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
