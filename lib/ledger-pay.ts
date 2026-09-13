"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { communities, ledgerEntries, users, weeklyEvents } from "@/lib/db/schema";
import { now } from "@/lib/id";
import { notify } from "@/lib/notify";
import { formatMoney } from "@/lib/utils";
import { eventLedgerAllSettled } from "@/lib/ledger-status";

export async function claimLedgerPayment(entryId: string) {
  const user = await requireUser();
  const entry = db.select().from(ledgerEntries).where(eq(ledgerEntries.id, entryId)).get();
  if (!entry) return { error: "Entry not found." };
  if (entry.fromUserId !== user.id) return { error: "Only the payer can mark this paid." };
  if (entry.status !== "pending") return { error: "This payment is not waiting on you." };

  const t = now();
  db.update(ledgerEntries)
    .set({ status: "claimed", claimedAt: t })
    .where(eq(ledgerEntries.id, entryId))
    .run();

  const community = db.select().from(communities).where(eq(communities.id, entry.communityId)).get();
  if (!community) return { error: "Community not found." };

  audit({
    communityId: community.id,
    actorId: user.id,
    action: "ledger.claim",
    entityType: "ledger_entry",
    entityId: entry.id,
  });

  await notify({
    userId: entry.toUserId,
    communityId: community.id,
    type: "payment_claimed",
    title: `${user.name} marked paid`,
    body: `${user.name} says they sent ${formatMoney(entry.amountCents, community.currency)}. Verify it on the ledger.`,
    href: `/app/c/${community.slug}/ledger`,
  });

  revalidatePath(`/app/c/${community.slug}/ledger`);
  revalidatePath(`/app/c/${community.slug}`);
  if (entry.weeklyEventId) revalidatePath(`/app/c/${community.slug}/events/${entry.weeklyEventId}`);
  return { ok: true };
}

export async function verifyLedgerPayment(entryId: string) {
  const user = await requireUser();
  const entry = db.select().from(ledgerEntries).where(eq(ledgerEntries.id, entryId)).get();
  if (!entry) return { error: "Entry not found." };
  if (entry.toUserId !== user.id) return { error: "Only the collector can verify this payment." };
  if (entry.status !== "claimed") {
    return { error: "Wait until the payer marks I have paid." };
  }

  db.update(ledgerEntries)
    .set({ status: "settled", settledAt: now(), settledById: user.id })
    .where(eq(ledgerEntries.id, entryId))
    .run();

  const community = db.select().from(communities).where(eq(communities.id, entry.communityId)).get();
  if (!community) return { error: "Community not found." };
  const payer = db.select().from(users).where(eq(users.id, entry.fromUserId)).get();

  audit({
    communityId: community.id,
    actorId: user.id,
    action: "ledger.verify",
    entityType: "ledger_entry",
    entityId: entry.id,
  });

  await notify({
    userId: entry.fromUserId,
    communityId: community.id,
    type: "payment_settled",
    title: `Payment verified · ${community.name}`,
    body: `Your ${formatMoney(entry.amountCents, community.currency)} payment was verified.`,
    href: `/app/c/${community.slug}/ledger`,
  });

  if (entry.weeklyEventId && eventLedgerAllSettled(entry.weeklyEventId)) {
    const weekly = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, entry.weeklyEventId)).get();
    if (weekly && weekly.status !== "completed" && weekly.status !== "cancelled") {
      db.update(weeklyEvents).set({ status: "completed" }).where(eq(weeklyEvents.id, weekly.id)).run();
      audit({
        communityId: community.id,
        actorId: user.id,
        action: "weekly.close",
        entityType: "weekly_event",
        entityId: weekly.id,
        meta: { reason: "all_shares_verified" },
      });
    }
  }

  revalidatePath(`/app/c/${community.slug}/ledger`);
  revalidatePath(`/app/c/${community.slug}`);
  if (entry.weeklyEventId) revalidatePath(`/app/c/${community.slug}/events/${entry.weeklyEventId}`);
  if (entry.seasonId) revalidatePath(`/app/c/${community.slug}/seasons/${entry.seasonId}`);
  void payer;
  return { ok: true };
}

/** @deprecated use claimLedgerPayment / verifyLedgerPayment */
export async function settleLedgerEntry(entryId: string) {
  const entry = db.select().from(ledgerEntries).where(eq(ledgerEntries.id, entryId)).get();
  if (!entry) return { error: "Entry not found." };
  if (entry.status === "pending") return claimLedgerPayment(entryId);
  if (entry.status === "claimed") return verifyLedgerPayment(entryId);
  return { error: "Already settled." };
}
