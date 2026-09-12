"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  sendSeasonInstallmentPayment,
  setInstallmentDueAt,
  updateSeasonRates,
} from "@/lib/actions/season";
import { Field, Input, Select, Textarea, Button } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  buildSeasonPaymentSchedule,
  seasonContractWeeks,
  seasonNightsPerWeek,
  seasonPaymentPeriodWeeks,
} from "@/lib/season-billing";
import { formatMoney, msToLocalInput } from "@/lib/utils";

export type SeasonInstallmentRow = {
  id: string;
  installmentIndex: number;
  label: string;
  amountCents: number;
  dueAt: number | null;
  status: string;
  requestedAt: number | null;
};

function dueDateValue(ms: number | null) {
  if (!ms) return "";
  return msToLocalInput(ms).slice(0, 10);
}

export function SeasonRatesForm({
  seasonId,
  currency,
  startDate,
  endDate,
  weekdays,
  regularPriceCents,
  occasionalPriceCents,
  occasionalPremiumPercent,
  paymentPeriodWeeks,
  prepaidSessionCount,
  firstPaymentLastWeeks,
  paymentInfo,
  collectorUserId,
  homeVisibleWeeks,
  members,
  canRequestPayment,
  installments,
}: {
  seasonId: string;
  currency: string;
  startDate: string;
  endDate: string;
  weekdays: string;
  regularPriceCents: number;
  occasionalPriceCents: number | null;
  occasionalPremiumPercent: number | null;
  paymentPeriodWeeks: number | null;
  prepaidSessionCount: number | null;
  firstPaymentLastWeeks: number;
  paymentInfo: string | null;
  collectorUserId: string | null;
  homeVisibleWeeks: number;
  members: { userId: string; name: string }[];
  canRequestPayment: boolean;
  installments: SeasonInstallmentRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const saved = regularPriceCents > 0;
  const [editing, setEditing] = useState(!saved);
  const [error, setError] = useState<string | null>(null);
  const [collector, setCollector] = useState(collectorUserId ?? members[0]?.userId ?? "");
  const [info, setInfo] = useState(paymentInfo ?? "");
  const resolvedPeriod =
    paymentPeriodWeeks ??
    seasonPaymentPeriodWeeks({
      startDate,
      endDate,
      weekdays,
      regularPriceCents,
      paymentPeriodWeeks,
      prepaidSessionCount,
      firstPaymentLastWeeks,
    });
  const [periodDraft, setPeriodDraft] = useState(resolvedPeriod != null ? String(resolvedPeriod) : "");
  const [lastWeeksDraft, setLastWeeksDraft] = useState(String(firstPaymentLastWeeks || 0));
  const [rateDraft, setRateDraft] = useState(
    regularPriceCents > 0 ? (regularPriceCents / 100).toString() : "",
  );
  const premiumDefault =
    occasionalPremiumPercent != null
      ? String(occasionalPremiumPercent)
      : occasionalPriceCents && regularPriceCents
        ? String(Math.round((occasionalPriceCents / regularPriceCents - 1) * 100))
        : "50";
  const collectorName = members.find((m) => m.userId === (collectorUserId ?? collector))?.name ?? "—";
  const nightsPerWeek = seasonNightsPerWeek(weekdays);
  const contractWeeks = seasonContractWeeks({ startDate, endDate, weekdays });
  const nextPlannedId = installments.find((row) => row.status === "planned")?.id ?? null;

  const scheduleInput = useMemo(() => {
    const rate = Math.round(Number(rateDraft || 0) * 100);
    const period = periodDraft.trim() ? Number(periodDraft) : null;
    const lastWeeks = Number(lastWeeksDraft || 0);
    return {
      startDate,
      endDate,
      weekdays,
      regularPriceCents: Number.isFinite(rate) && rate > 0 ? rate : regularPriceCents,
      paymentPeriodWeeks: period != null && Number.isFinite(period) ? period : resolvedPeriod,
      firstPaymentLastWeeks: Number.isFinite(lastWeeks) ? Math.max(0, lastWeeks) : firstPaymentLastWeeks,
      prepaidSessionCount,
    };
  }, [
    rateDraft,
    periodDraft,
    lastWeeksDraft,
    startDate,
    endDate,
    weekdays,
    regularPriceCents,
    resolvedPeriod,
    firstPaymentLastWeeks,
    prepaidSessionCount,
  ]);

  const liveSchedule = useMemo(() => buildSeasonPaymentSchedule(scheduleInput), [scheduleInput]);

  function runSend(installmentId: string) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("seasonId", seasonId);
      fd.set("installmentId", installmentId);
      const result = await sendSeasonInstallmentPayment(fd);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  function runDueAt(installmentId: string, dueAt: string) {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("installmentId", installmentId);
      fd.set("dueAt", dueAt);
      const result = await setInstallmentDueAt(fd);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="mt-4 space-y-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink/45">Contract / night</dt>
            <dd className="mt-0.5 font-medium">{formatMoney(regularPriceCents, currency)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink/45">Occasional premium</dt>
            <dd className="mt-0.5 font-medium">
              {occasionalPremiumPercent != null ? `+${occasionalPremiumPercent}%` : "—"}
              {occasionalPriceCents != null ? ` · ${formatMoney(occasionalPriceCents, currency)}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink/45">Contract length</dt>
            <dd className="mt-0.5 font-medium">{contractWeeks != null ? `${contractWeeks} weeks` : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink/45">Pay every</dt>
            <dd className="mt-0.5 font-medium">
              {resolvedPeriod != null ? `${resolvedPeriod} weeks` : "—"}
              {nightsPerWeek > 1 ? ` · ${nightsPerWeek} nights/week` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink/45">Last weeks on 1st payment</dt>
            <dd className="mt-0.5 font-medium">
              {firstPaymentLastWeeks > 0 ? firstPaymentLastWeeks : "None"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink/45">Payment receiver</dt>
            <dd className="mt-0.5 font-medium">{collectorName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink/45">Home weeks ahead</dt>
            <dd className="mt-0.5 font-medium">{homeVisibleWeeks || 4}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wider text-ink/45">Payment details</dt>
            <dd className="mt-0.5 whitespace-pre-wrap font-medium">{paymentInfo || "—"}</dd>
          </div>
        </dl>

        {installments.length > 0 && (
          <div className="rounded-2xl border border-line bg-card px-3 py-3">
            <p className="text-xs uppercase tracking-wider text-ink/45">Payment plan</p>
            <ul className="mt-3 space-y-3">
              {installments.map((row) => {
                const isNext = row.id === nextPlannedId;
                const requested = row.status === "requested";
                return (
                  <li
                    key={row.id}
                    className="rounded-xl border border-line/80 bg-muted/40 px-3 py-3 text-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">
                          #{row.installmentIndex}
                          <span className="font-normal text-ink/70"> · {row.label}</span>
                        </p>
                        <p className="mt-0.5 text-ink/55">
                          {requested ? "Requested" : "Planned"}
                          {row.installmentIndex === 1 && firstPaymentLastWeeks > 0
                            ? " · includes last weeks"
                            : ""}
                        </p>
                      </div>
                      <p className="font-medium text-ink">{formatMoney(row.amountCents, currency)}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <label className="min-w-[10rem] flex-1 text-xs text-ink/55">
                        Due date
                        <Input
                          type="date"
                          className="mt-1"
                          defaultValue={dueDateValue(row.dueAt)}
                          disabled={pending}
                          onBlur={(event) => {
                            const next = event.target.value;
                            if (next === dueDateValue(row.dueAt)) return;
                            runDueAt(row.id, next);
                          }}
                        />
                      </label>
                      {canRequestPayment && isNext && (
                        <Button type="button" disabled={pending} onClick={() => runSend(row.id)}>
                          Send payment #{row.installmentIndex}
                        </Button>
                      )}
                      {requested && (
                        <span className="pb-2 text-xs text-ink/45">On the ledger</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
        {error && <p className="text-sm text-clay">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <form
        className="space-y-3"
        action={async (formData) => {
          formData.set("collectorUserId", collector);
          formData.set("paymentInfo", info);
          const result = await updateSeasonRates(formData);
          setError(result?.error ?? null);
          if (!result?.error) {
            setEditing(false);
            router.refresh();
          }
        }}
      >
        <input type="hidden" name="seasonId" value={seasonId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`Contract rate / night (${currency})`}>
            <Input
              name="regularPrice"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={rateDraft}
              onChange={(e) => setRateDraft(e.target.value)}
            />
          </Field>
          <Field label="Occasional premium %">
            <Input
              name="occasionalPremiumPercent"
              type="number"
              min={0}
              step="1"
              required
              defaultValue={premiumDefault}
            />
          </Field>
          <Field
            label="Pay every (weeks)"
            hint={
              contractWeeks != null
                ? `This contract spans ${contractWeeks} weeks · ${nightsPerWeek} night${nightsPerWeek === 1 ? "" : "s"}/week.`
                : undefined
            }
          >
            <Input
              name="paymentPeriodWeeks"
              type="number"
              min={1}
              step="1"
              value={periodDraft}
              onChange={(e) => setPeriodDraft(e.target.value)}
              placeholder="e.g. 4"
            />
          </Field>
          <Field
            label="Last weeks on first payment"
            hint="Manager collects the final weeks up front. Those weeks are skipped at the end of the schedule."
          >
            <Input
              name="firstPaymentExtraWeeks"
              type="number"
              min={0}
              max={52}
              step="1"
              value={lastWeeksDraft}
              onChange={(e) => setLastWeeksDraft(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Show nights on Home (weeks)">
            <Input
              name="homeVisibleWeeks"
              type="number"
              min={1}
              max={52}
              required
              defaultValue={String(homeVisibleWeeks || 4)}
            />
          </Field>
          <Field label="Payment receiver">
            <Select value={collector} onChange={(e) => setCollector(e.target.value)}>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {liveSchedule && liveSchedule.length > 0 ? (
          <div className="rounded-2xl border border-line bg-card px-3 py-3 text-sm text-ink/70">
            <p className="text-xs uppercase tracking-wider text-ink/45">Payment schedule preview</p>
            <ol className="mt-2 space-y-1.5">
              {liveSchedule.map((row) => (
                <li key={row.index} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>
                    <span className="font-medium text-ink">#{row.index}</span>
                    <span> · {row.label}</span>
                  </span>
                  <span className="font-medium text-ink">{formatMoney(row.amountCents, currency)}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : periodDraft.trim() ? (
          <p className="text-sm text-clay">
            Check the period and last-weeks values — they must fit inside the contract length.
          </p>
        ) : null}
        <Field label="Payment details">
          <Textarea rows={2} value={info} onChange={(e) => setInfo(e.target.value)} placeholder="E-transfer to…" />
        </Field>
        {error && <p className="text-sm text-clay">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <SubmitButton>{saved ? "Save changes" : "Save"}</SubmitButton>
          {saved && (
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
