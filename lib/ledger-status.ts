import { and, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { ledgerEntries, users } from "@/lib/db/schema";
import { isOfflinePayer } from "@/lib/offline-payer";

export function countLedgerActions(communityId: string, userId: string) {
  const rows = db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.communityId, communityId))
    .all();
  const payerIds = [...new Set(rows.map((r) => r.fromUserId))];
  const offlineIds = new Set(
    payerIds.filter((id) => {
      const payer = db.select().from(users).where(eq(users.id, id)).get();
      return isOfflinePayer(payer);
    }),
  );
  return rows.filter((r) => {
    if (r.status === "pending" && r.fromUserId === userId && !offlineIds.has(r.fromUserId)) {
      return true;
    }
    if (r.status === "claimed" && r.toUserId === userId) return true;
    // Outside-app shares never self-claim — collector verifies from pending.
    if (r.status === "pending" && r.toUserId === userId && offlineIds.has(r.fromUserId)) {
      return true;
    }
    return false;
  }).length;
}

export function ledgerStatusLabel(status: string) {
  if (status === "settled") return "Settled";
  if (status === "claimed") return "Waiting for verify";
  return "Due";
}

export function eventLedgerAllSettled(weeklyEventId: string) {
  const rows = db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.weeklyEventId, weeklyEventId))
    .all();
  if (rows.length === 0) return false;
  return rows.every((r) => r.status === "settled");
}

export function openLedgerForEvent(weeklyEventId: string) {
  return db
    .select()
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.weeklyEventId, weeklyEventId),
        or(eq(ledgerEntries.status, "pending"), eq(ledgerEntries.status, "claimed")),
      ),
    )
    .all();
}
