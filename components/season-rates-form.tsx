"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendSeasonPaymentRequest, updateSeasonRates } from "@/lib/actions/season";
import { Field, Input, Select, Textarea, Button } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { formatMoney } from "@/lib/utils";

export function SeasonRatesForm({
  seasonId,
  currency,
  regularPriceCents,
  occasionalPriceCents,
  occasionalPremiumPercent,
  prepaidSessionCount,
  paymentInfo,
  collectorUserId,
  paymentRequestedAt,
  homeVisibleWeeks,
  members,
  canRequestPayment,
}: {
  seasonId: string;
  currency: string;
  regularPriceCents: number;
  occasionalPriceCents: number | null;
  occasionalPremiumPercent: number | null;
  prepaidSessionCount: number | null;
  paymentInfo: string | null;
  collectorUserId: string | null;
  paymentRequestedAt: number | null;
  homeVisibleWeeks: number;
  members: { userId: string; name: string }[];
  canRequestPayment: boolean;
}) {
  const router = useRouter();
  const saved = regularPriceCents > 0;
  const [editing, setEditing] = useState(!saved);
  const [error, setError] = useState<string | null>(null);
  const [collector, setCollector] = useState(collectorUserId ?? members[0]?.userId ?? "");
  const [info, setInfo] = useState(paymentInfo ?? "");
  const regularDefault = regularPriceCents > 0 ? (regularPriceCents / 100).toString() : "";
  const premiumDefault =
    occasionalPremiumPercent != null
      ? String(occasionalPremiumPercent)
      : occasionalPriceCents && regularPriceCents
        ? String(Math.round((occasionalPriceCents / regularPriceCents - 1) * 100))
        : "50";
  const prepaidDefault = prepaidSessionCount != null ? String(prepaidSessionCount) : "";
  const collectorName = members.find((m) => m.userId === (collectorUserId ?? collector))?.name ?? "—";
  const amount =
    regularPriceCents > 0 && prepaidSessionCount
      ? formatMoney(regularPriceCents * prepaidSessionCount, currency)
      : null;

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
            <dt className="text-xs uppercase tracking-wider text-ink/45">Sessions in advance</dt>
            <dd className="mt-0.5 font-medium">{prepaidSessionCount ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ink/45">Season dues / player</dt>
            <dd className="mt-0.5 font-medium">{amount ?? "—"}</dd>
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
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
          {canRequestPayment && !paymentRequestedAt && (
            <Button
              type="button"
              onClick={() => {
                setError(null);
                const fd = new FormData();
                fd.set("seasonId", seasonId);
                void sendSeasonPaymentRequest(fd).then((result) => {
                  if (result?.error) setError(result.error);
                  else router.refresh();
                });
              }}
            >
              Send payment request to contract players
            </Button>
          )}
        </div>
        {paymentRequestedAt && (
          <p className="text-sm text-ink/55">Advance payment requests were sent. Track them on the ledger.</p>
        )}
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
            <Input name="regularPrice" type="number" step="0.01" min="0.01" required defaultValue={regularDefault} />
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
          <Field label="Sessions paid in advance">
            <Input
              name="prepaidSessionCount"
              type="number"
              min={1}
              step="1"
              defaultValue={prepaidDefault}
              placeholder="e.g. 8"
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
