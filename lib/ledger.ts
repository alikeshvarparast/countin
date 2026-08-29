import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { eventGuests, ledgerEntries, rsvps, users, weeklyEvents } from "@/lib/db/schema";
import { createId, now } from "@/lib/id";
import { notify, notifyMany } from "@/lib/notify";

function splitCents(total: number, n: number) {
  const base = Math.floor(total / n);
  const rem = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

export function attendanceShares(eventId: string) {
  const going = db
    .select({ userId: rsvps.userId })
    .from(rsvps)
    .where(and(eq(rsvps.eventId, eventId), eq(rsvps.status, "going")))
    .all();
  const guests = db
    .select()
    .from(eventGuests)
    .where(eq(eventGuests.weeklyEventId, eventId))
    .all()
    .filter((g) => g.status === "approved");
  const counts = new Map<string, number>();
  for (const row of going) counts.set(row.userId, (counts.get(row.userId) ?? 0) + 1);
  for (const guest of guests) {
    if (!counts.has(guest.hostUserId)) continue;
    counts.set(guest.hostUserId, (counts.get(guest.hostUserId) ?? 0) + 1);
  }
  return { going, guests, counts, units: [...counts.values()].reduce((s, n) => s + n, 0) };
}

export function goingHeadcount(eventId: string) {
  const { going, guests } = attendanceShares(eventId);
  return going.length + guests.length;
}

export async function syncWeeklyShares(eventId: string) {
  const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, eventId)).get();
  if (!event || event.paymentMode !== "prepaid" || event.totalCostCents == null) return;
  if (event.status === "cancelled" || event.status === "polling") return;
  const collectorId = event.collectorUserId;
  if (!collectorId) return;

  const { counts, units } = attendanceShares(eventId);
  if (units === 0) return;

  const pending = db
    .select()
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.weeklyEventId, eventId), eq(ledgerEntries.status, "pending")))
    .all();
  const settled = db
    .select()
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.weeklyEventId, eventId), eq(ledgerEntries.status, "settled")))
    .all();
  const settledByUser = new Map<string, number>();
  for (const row of settled) {
    settledByUser.set(row.fromUserId, (settledByUser.get(row.fromUserId) ?? 0) + row.amountCents);
  }

  for (const row of pending) {
    db.delete(ledgerEntries).where(eq(ledgerEntries.id, row.id)).run();
  }

  const unitAmounts = splitCents(event.totalCostCents, units);
  let cursor = 0;
  const t = now();
  const billed: string[] = [];
  for (const [userId, shareCount] of counts) {
    const amount = unitAmounts.slice(cursor, cursor + shareCount).reduce((s, n) => s + n, 0);
    cursor += shareCount;
    const alreadyPaid = settledByUser.get(userId) ?? 0;
    const remaining = amount - alreadyPaid;
    if (remaining <= 0) continue;
    db.insert(ledgerEntries)
      .values({
        id: createId(),
        communityId: event.communityId,
        fromUserId: userId,
        toUserId: collectorId,
        amountCents: remaining,
        reason: "weekly_share",
        status: "pending",
        weeklyEventId: event.id,
        createdAt: t,
      })
      .run();
    billed.push(userId);
  }

  return { collectorId, billed };
}

export async function notifyCollector(community: { id: string; slug: string; name: string }, collectorId: string, title: string, body: string) {
  await notify({
    userId: collectorId,
    communityId: community.id,
    type: "ledger_approval",
    title,
    body,
    href: `/app/c/${community.slug}/ledger`,
  });
}

export function collectorName(userId: string | null | undefined) {
  if (!userId) return "the collector";
  return db.select().from(users).where(eq(users.id, userId)).get()?.name ?? "the collector";
}

export { notifyMany, splitCents };
