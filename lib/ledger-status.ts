import { and, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { ledgerEntries } from "@/lib/db/schema";

export function countLedgerActions(communityId: string, userId: string) {
  const rows = db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.communityId, communityId))
    .all();
  return rows.filter(
    (r) =>
      (r.status === "pending" && r.fromUserId === userId) ||
      (r.status === "claimed" && r.toUserId === userId),
  ).length;
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
