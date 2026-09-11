"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  closeWeeklyEvent,
  saveEventCostSettings,
  sendWeeklyPaymentRequest,
} from "@/lib/actions/weekly";
import { Button, Field, Input, Select } from "@/components/ui";
import { formatMoney } from "@/lib/utils";

type Member = { userId: string; name: string; paymentInfo: string | null };

export function EventCostPanel({
  eventId,
  currency,
  paymentMode,
  totalCostCents,
  collectorUserId,
  paymentRequestedAt,
  status,
  members,
  initialAttendeeIds,
  allSettled,
  canSendPrepaid,
  canSendPostpaid,
}: {
  eventId: string;
  currency: string;
  paymentMode: string;
  totalCostCents: number | null;
  collectorUserId: string | null;
  paymentRequestedAt: number | null;
  status: string;
  members: Member[];
  initialAttendeeIds: string[];
  allSettled: boolean;
  canSendPrepaid: boolean;
  canSendPostpaid: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState(paymentMode === "prepaid" ? "prepaid" : "postpay");
  const [collector, setCollector] = useState(collectorUserId ?? members[0]?.userId ?? "");
  const [amount, setAmount] = useState(totalCostCents != null ? String(totalCostCents / 100) : "");
  const [selected, setSelected] = useState<string[]>(initialAttendeeIds);
  const [query, setQuery] = useState("");
  const requested = Boolean(paymentRequestedAt);
  const canSend = !requested && (mode === "prepaid" ? canSendPrepaid : canSendPostpaid);

  const collectorMember = members.find((m) => m.userId === collector);
  const collectorPayment = collectorMember?.paymentInfo?.trim() || "";

  const sharePreview = useMemo(() => {
    const n = selected.filter((id) => id !== collector).length;
    const cents = Math.round(Number(amount) * 100);
    if (!n || !Number.isFinite(cents) || cents <= 0) return null;
    return Math.floor(cents / n) / 100;
  }, [amount, selected, collector]);

  const selectedMembers = useMemo(
    () =>
      selected
        .map((id) => members.find((m) => m.userId === id))
        .filter((m): m is Member => Boolean(m))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [selected, members],
  );

  const searchHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return members
      .filter((m) => !selected.includes(m.userId) && m.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [members, query, selected]);

  function toggle(id: string, on: boolean) {
    setSelected((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg">Cost</h3>
        <p className="text-xs uppercase tracking-wider text-secondary">
          {mode === "prepaid" ? "Pre-paid" : "Post-paid"}
          {requested ? " · requests sent" : ""}
          {status === "completed" ? " · closed" : ""}
        </p>
      </div>

      {!requested && (
        <Field label="Payment timing">
          <Select name="paymentMode" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="postpay">Post-paid — request after the session</option>
            <option value="prepaid">Pre-paid — request after the field is booked</option>
          </Select>
        </Field>
      )}

      <Field label={`Total (${currency})`}>
        <Input
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={requested}
          required
        />
      </Field>

      <Field label="Payment receiver">
        <Select
          value={collector}
          onChange={(e) => setCollector(e.target.value)}
          disabled={requested}
        >
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
              {m.paymentInfo ? "" : " (no payment info)"}
            </option>
          ))}
        </Select>
      </Field>

      <div className="rounded-xl border border-line bg-muted/40 px-3 py-2 text-sm">
        <p className="text-xs uppercase tracking-wider text-secondary">Pay them via</p>
        {collectorPayment ? (
          <p className="mt-1 whitespace-pre-wrap text-ink">{collectorPayment}</p>
        ) : (
          <p className="mt-1 text-clay">
            {collectorMember?.name ?? "Receiver"} has no payment details on their profile yet.
          </p>
        )}
      </div>

      {!requested && (
        <div className="space-y-3 rounded-xl border border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wider text-secondary">
              Who pays a share · {selected.filter((id) => id !== collector).length}
            </p>
            <button
              type="button"
              className="text-xs text-primary"
              onClick={() => setSelected(initialAttendeeIds)}
            >
              Reset to going
            </button>
          </div>

          {selectedMembers.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {selectedMembers.map((m) => (
                <li key={m.userId}>
                  <button
                    type="button"
                    onClick={() => toggle(m.userId, false)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-2.5 py-1 text-sm"
                    title="Remove"
                  >
                    {m.name}
                    {m.userId === collector ? <span className="text-ink/40">receiver</span> : null}
                    <span className="text-ink/40">×</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/50">No one selected yet. Search to add payers.</p>
          )}

          <Field label="Add member">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name…"
              autoComplete="off"
            />
          </Field>
          {searchHits.length > 0 && (
            <ul className="max-h-40 overflow-y-auto rounded-xl border border-line bg-card text-sm">
              {searchHits.map((m) => (
                <li key={m.userId}>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left hover:bg-muted"
                    onClick={() => {
                      toggle(m.userId, true);
                      setQuery("");
                    }}
                  >
                    {m.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query.trim() && searchHits.length === 0 && (
            <p className="text-xs text-ink/45">No matching members.</p>
          )}

          {sharePreview != null && (
            <p className="text-xs text-ink/55">
              About {formatMoney(Math.round(sharePreview * 100), currency)} each (before remainder
              cents).
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-clay">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {!requested && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setError(null);
              const fd = new FormData();
              fd.set("eventId", eventId);
              fd.set("amount", amount);
              fd.set("collectorUserId", collector);
              fd.set("paymentMode", mode);
              void saveEventCostSettings(fd).then((result) => {
                if (result?.error) setError(result.error);
                else router.refresh();
              });
            }}
          >
            Save cost
          </Button>
        )}
        {canSend && (
          <Button
            type="button"
            onClick={() => {
              setError(null);
              const fd = new FormData();
              fd.set("eventId", eventId);
              fd.set("amount", amount);
              fd.set("collectorUserId", collector);
              for (const id of selected) fd.append("attendeeId", id);
              void sendWeeklyPaymentRequest(fd).then((result) => {
                if (result?.error) setError(result.error);
                else router.refresh();
              });
            }}
          >
            Send payment request
          </Button>
        )}
        {requested && status !== "completed" && (
          <Button
            type="button"
            disabled={!allSettled}
            onClick={() => {
              setError(null);
              void closeWeeklyEvent(eventId).then((result) => {
                if (result?.error) setError(result.error);
                else router.refresh();
              });
            }}
          >
            Close event
          </Button>
        )}
      </div>
      {requested && !allSettled && (
        <p className="text-xs text-ink/50">
          Close unlocks after every share is verified on the ledger.
        </p>
      )}
      {mode === "prepaid" && !canSendPrepaid && !requested && (
        <p className="text-xs text-ink/50">Book the field first, then send the payment request.</p>
      )}
      {mode === "postpay" && !canSendPostpaid && !requested && (
        <p className="text-xs text-ink/50">After the session ends you can send payment requests.</p>
      )}
    </div>
  );
}
