import { and, eq } from "drizzle-orm";
import { primaryAdminId } from "@/lib/access";
import { db } from "@/lib/db";
import { contracts, ledgerEntries, seasonPaymentInstallments, seasons } from "@/lib/db/schema";
import { createId, now } from "@/lib/id";
import { buildSeasonPaymentSchedule } from "@/lib/season-billing";

/** Upsert planned installments from the schedule; leave requested rows' structure stable. */
export function syncSeasonPaymentInstallments(season: typeof seasons.$inferSelect) {
  const schedule = buildSeasonPaymentSchedule({
    ...season,
    firstPaymentLastWeeks: season.firstPaymentExtraWeeks,
  });
  const existing = db
    .select()
    .from(seasonPaymentInstallments)
    .where(eq(seasonPaymentInstallments.seasonId, season.id))
    .all();
  const byIndex = new Map(existing.map((row) => [row.installmentIndex, row]));
  const t = now();

  if (!schedule) {
    for (const row of existing) {
      if (row.status === "planned") {
        db.delete(seasonPaymentInstallments).where(eq(seasonPaymentInstallments.id, row.id)).run();
      }
    }
    return db
      .select()
      .from(seasonPaymentInstallments)
      .where(eq(seasonPaymentInstallments.seasonId, season.id))
      .all()
      .sort((a, b) => a.installmentIndex - b.installmentIndex);
  }

  const scheduleIndexes = new Set(schedule.map((item) => item.index));
  for (const item of schedule) {
    const row = byIndex.get(item.index);
    const weeksJson = JSON.stringify(item.weeks);
    if (!row) {
      db.insert(seasonPaymentInstallments)
        .values({
          id: createId(),
          seasonId: season.id,
          installmentIndex: item.index,
          weeksJson,
          label: item.label,
          amountCents: item.amountCents,
          dueAt: null,
          status: "planned",
          requestedAt: null,
          createdAt: t,
          updatedAt: t,
        })
        .run();
      continue;
    }
    if (row.status === "planned") {
      db.update(seasonPaymentInstallments)
        .set({
          weeksJson,
          label: item.label,
          amountCents: item.amountCents,
          updatedAt: t,
        })
        .where(eq(seasonPaymentInstallments.id, row.id))
        .run();
    } else if (row.status === "requested") {
      db.update(seasonPaymentInstallments)
        .set({ amountCents: item.amountCents, label: item.label, weeksJson, updatedAt: t })
        .where(eq(seasonPaymentInstallments.id, row.id))
        .run();
    }
  }

  for (const row of existing) {
    if (row.status === "planned" && !scheduleIndexes.has(row.installmentIndex)) {
      db.delete(seasonPaymentInstallments).where(eq(seasonPaymentInstallments.id, row.id)).run();
    }
  }

  // Legacy: first payment already sent before installments table existed.
  if (season.paymentRequestedAt) {
    const first = db
      .select()
      .from(seasonPaymentInstallments)
      .where(
        and(
          eq(seasonPaymentInstallments.seasonId, season.id),
          eq(seasonPaymentInstallments.installmentIndex, 1),
        ),
      )
      .get();
    if (first && first.status === "planned") {
      db.update(seasonPaymentInstallments)
        .set({
          status: "requested",
          requestedAt: season.paymentRequestedAt,
          updatedAt: t,
        })
        .where(eq(seasonPaymentInstallments.id, first.id))
        .run();
      for (const ledger of db
        .select()
        .from(ledgerEntries)
        .where(and(eq(ledgerEntries.seasonId, season.id), eq(ledgerEntries.reason, "contract_prepay")))
        .all()) {
        if (ledger.seasonPaymentInstallmentId) continue;
        db.update(ledgerEntries)
          .set({
            seasonPaymentInstallmentId: first.id,
            installmentIndex: 1,
          })
          .where(eq(ledgerEntries.id, ledger.id))
          .run();
      }
    }
  }

  return db
    .select()
    .from(seasonPaymentInstallments)
    .where(eq(seasonPaymentInstallments.seasonId, season.id))
    .all()
    .sort((a, b) => a.installmentIndex - b.installmentIndex);
}

function syncInstallmentLedger(
  season: typeof seasons.$inferSelect,
  installment: typeof seasonPaymentInstallments.$inferSelect,
) {
  if (installment.status !== "requested") return;
  const amountCents = installment.amountCents;
  const collectorId = season.collectorUserId ?? primaryAdminId(season.communityId);
  const contractPlayers = db.select().from(contracts).where(eq(contracts.seasonId, season.id)).all();
  const contractIds = new Set(contractPlayers.map((c) => c.userId));
  const existing = db
    .select()
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.seasonId, season.id),
        eq(ledgerEntries.reason, "contract_prepay"),
        eq(ledgerEntries.seasonPaymentInstallmentId, installment.id),
      ),
    )
    .all();

  const legacy =
    installment.installmentIndex === 1
      ? db
          .select()
          .from(ledgerEntries)
          .where(
            and(eq(ledgerEntries.seasonId, season.id), eq(ledgerEntries.reason, "contract_prepay")),
          )
          .all()
          .filter((row) => !row.seasonPaymentInstallmentId)
      : [];

  for (const row of [...existing, ...legacy]) {
    if (row.status === "settled") {
      if (!row.seasonPaymentInstallmentId) {
        db.update(ledgerEntries)
          .set({
            seasonPaymentInstallmentId: installment.id,
            installmentIndex: installment.installmentIndex,
          })
          .where(eq(ledgerEntries.id, row.id))
          .run();
      }
      continue;
    }
    if (!contractIds.has(row.fromUserId) || row.fromUserId === collectorId) {
      db.delete(ledgerEntries).where(eq(ledgerEntries.id, row.id)).run();
      continue;
    }
    db.update(ledgerEntries)
      .set({
        amountCents,
        toUserId: collectorId,
        seasonPaymentInstallmentId: installment.id,
        installmentIndex: installment.installmentIndex,
      })
      .where(eq(ledgerEntries.id, row.id))
      .run();
  }

  const linked = db
    .select()
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.seasonId, season.id),
        eq(ledgerEntries.reason, "contract_prepay"),
        eq(ledgerEntries.seasonPaymentInstallmentId, installment.id),
      ),
    )
    .all();
  const openFrom = new Set(
    linked.filter((r) => r.status !== "settled" && contractIds.has(r.fromUserId)).map((r) => r.fromUserId),
  );
  const settledFrom = new Set(linked.filter((r) => r.status === "settled").map((r) => r.fromUserId));
  const t = now();
  for (const row of contractPlayers) {
    if (row.userId === collectorId) continue;
    if (openFrom.has(row.userId) || settledFrom.has(row.userId)) continue;
    db.insert(ledgerEntries)
      .values({
        id: createId(),
        communityId: season.communityId,
        fromUserId: row.userId,
        toUserId: collectorId,
        amountCents,
        reason: "contract_prepay",
        status: "pending",
        seasonId: season.id,
        seasonPaymentInstallmentId: installment.id,
        installmentIndex: installment.installmentIndex,
        createdAt: t,
      })
      .run();
  }
}

/** Keep pending/claimed season prepay rows aligned with requested installments and roster. */
export function syncSeasonPrepayLedger(season: typeof seasons.$inferSelect) {
  const rows = syncSeasonPaymentInstallments(season).filter((row) => row.status === "requested");
  for (const row of rows) syncInstallmentLedger(season, row);
}
