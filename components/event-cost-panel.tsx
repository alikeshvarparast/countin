"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  closeWeeklyEvent,
  saveEventCostSettings,
  sendWeeklyPaymentRequest,
} from "@/lib/actions/weekly";
import { claimLedgerPayment, verifyLedgerPayment } from "@/lib/ledger-pay";
import { Button, Field, Input, Select, Badge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { formatMoney } from "@/lib/utils";

type Member = { userId: string; name: string; paymentInfo: string | null };

export type CostShareEntry = {
  id: string;
  fromUserId: string;
  fromName: string;
  amountCents: number;
  status: string;
  /** Outside the app — share only; receiver verifies directly. */
  offline?: boolean;
};

type OutsidePayer = { key: string; name: string };

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
  shares,
  currentUserId,
  isAdmin,
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
  shares: CostShareEntry[];
  currentUserId: string | null;
  isAdmin: boolean;
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
  const [outside, setOutside] = useState<OutsidePayer[]>([]);
  const [outsideDraft, setOutsideDraft] = useState("");
  const [editingPayers, setEditingPayers] = useState(false);
  const [query, setQuery] = useState("");

  const requested = Boolean(paymentRequestedAt);
  const completed = status === "completed" || (requested && allSettled);
  const canSend = isAdmin && !requested && (mode === "prepaid" ? canSendPrepaid : canSendPostpaid);
  const collectorMember = members.find((m) => m.userId === collector);
  const collectorPayment = collectorMember?.paymentInfo?.trim() || "";
  const displayCollectorId = requested ? (collectorUserId ?? collector) : collector;
  const displayCollector = members.find((m) => m.userId === displayCollectorId);
  const displayPayment =
    displayCollector?.paymentInfo?.trim() ||
    (requested ? collectorPayment : collectorPayment);

  const payerIds = selected.filter((id) => id !== collector);
  const shareCount = payerIds.length + outside.length;
  const sharePreview = useMemo(() => {
    const n = shareCount;
    const cents = Math.round(Number(amount) * 100);
    if (!n || !Number.isFinite(cents) || cents <= 0) return null;
    return Math.floor(cents / n) / 100;
  }, [amount, shareCount]);

  const selectedMembers = useMemo(
    () =>
      selected
        .map((id) => members.find((m) => m.userId === id))
        .filter((m): m is Member => Boolean(m))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [selected, members],
  );

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...members].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return list;
    return list.filter((m) => m.name.toLowerCase().includes(q));
  }, [members, query]);

  const unpaid = shares.filter((s) => s.status === "pending");
  const awaiting = shares.filter((s) => s.status === "claimed");
  const verified = shares.filter((s) => s.status === "settled");

  function toggle(id: string, on: boolean) {
    setSelected((prev) => (on ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)));
  }

  function stopEditingPayers() {
    setEditingPayers(false);
    setQuery("");
    setOutsideDraft("");
  }

  function addOutside() {
    const name = outsideDraft.trim();
    if (name.length < 1) return;
    setOutside((prev) => [...prev, { key: `${Date.now()}-${prev.length}`, name }]);
    setOutsideDraft("");
  }

  const phaseLabel = completed
    ? "Completed"
    : requested
      ? "Collecting payments"
      : mode === "prepaid"
        ? "Pre-paid setup"
        : "Post-paid setup";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg">Cost</h3>
        <Badge tone={completed ? "lime" : requested ? "line" : "clay"}>{phaseLabel}</Badge>
      </div>

      {/* Total */}
      {isAdmin && !requested ? (
        <Field label={`Total (${currency})`}>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </Field>
      ) : (
        <div>
          <p className="text-xs uppercase tracking-wider text-secondary">Total</p>
          <p className="mt-1 text-sm text-ink">
            {totalCostCents != null ? formatMoney(totalCostCents, currency) : "Not set yet"}
          </p>
        </div>
      )}

      {/* Payment receiver */}
      {isAdmin && !requested ? (
        <Field label="Payment receiver">
          <Select value={collector} onChange={(e) => setCollector(e.target.value)}>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
                {m.paymentInfo ? "" : " (no payment info)"}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <div>
          <p className="text-xs uppercase tracking-wider text-secondary">Payment receiver</p>
          <p className="mt-1 text-sm text-ink">{displayCollector?.name ?? "Not set"}</p>
        </div>
      )}

      {(displayPayment || (!requested && collectorPayment)) && (
        <div className="rounded-xl border border-line bg-muted/40 px-3 py-2 text-sm">
          <p className="text-xs uppercase tracking-wider text-secondary">Pay them via</p>
          {displayPayment ? (
            <p className="mt-1 whitespace-pre-wrap text-ink">{displayPayment}</p>
          ) : (
            <p className="mt-1 text-clay">
              {displayCollector?.name ?? "Receiver"} has no payment details on their profile yet.
            </p>
          )}
        </div>
      )}

      {!requested && isAdmin && !completed && (
        <Field label="Payment timing">
          <Select name="paymentMode" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="postpay">Post-paid — request after the session</option>
            <option value="prepaid">Pre-paid — request after the field is booked</option>
          </Select>
        </Field>
      )}

      {/* Share list — before requests, while setting up */}
      {!requested && !completed && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-secondary">
                Who shares · {shareCount}
              </p>
              <p className="mt-0.5 text-xs text-ink/50">
                Default is everyone going
                {collector ? " · receiver does not pay a share" : ""}
                {" · "}you can add people who are not on the app
              </p>
            </div>
            {isAdmin && !editingPayers && (
              <button type="button" className="text-sm text-primary" onClick={() => setEditingPayers(true)}>
                Change who pays
              </button>
            )}
          </div>

          {!editingPayers ? (
            <ul className="max-h-56 overflow-y-auto rounded-xl border border-line bg-muted/30 p-2 text-sm">
              {selectedMembers.length === 0 && outside.length === 0 && (
                <li className="px-1 py-2 text-ink/45">No one on the share list yet.</li>
              )}
              {selectedMembers.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5">
                  <span className="truncate">{m.name}</span>
                  {m.userId === collector ? (
                    <span className="shrink-0 text-xs text-ink/40">receiver</span>
                  ) : null}
                </li>
              ))}
              {outside.map((p) => (
                <li key={p.key} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5">
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 text-xs text-ink/40">outside app</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-3 rounded-xl border border-line p-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full border border-line px-3 py-1 text-xs text-ink/70 hover:border-primary/40"
                  onClick={() => setSelected(initialAttendeeIds)}
                >
                  Reset to going
                </button>
                <button
                  type="button"
                  className="rounded-full border border-line px-3 py-1 text-xs text-ink/70 hover:border-primary/40"
                  onClick={() =>
                    setSelected((prev) => {
                      const ids = new Set(prev);
                      for (const m of filteredMembers) ids.add(m.userId);
                      return [...ids];
                    })
                  }
                >
                  Select all shown
                </button>
                <button
                  type="button"
                  className="rounded-full border border-line px-3 py-1 text-xs text-ink/70 hover:border-primary/40"
                  onClick={() => {
                    const remove = new Set(filteredMembers.map((m) => m.userId));
                    setSelected((prev) => prev.filter((id) => !remove.has(id)));
                  }}
                >
                  Clear shown
                </button>
              </div>
              <Field label="Search members">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type a name…"
                  autoComplete="off"
                />
              </Field>
              <ul className="max-h-72 overflow-y-auto rounded-xl border border-line bg-card text-sm">
                {filteredMembers.length === 0 && (
                  <li className="px-3 py-3 text-ink/45">No matching members.</li>
                )}
                {filteredMembers.map((m) => {
                  const on = selected.includes(m.userId);
                  return (
                    <li key={m.userId} className="border-b border-line last:border-0">
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-line"
                          checked={on}
                          onChange={(e) => toggle(m.userId, e.target.checked)}
                        />
                        <span className="min-w-0 flex-1 truncate">{m.name}</span>
                        {m.userId === collector ? (
                          <span className="shrink-0 text-xs text-ink/40">receiver</span>
                        ) : null}
                      </label>
                    </li>
                  );
                })}
              </ul>

              <div className="space-y-2 rounded-xl border border-dashed border-line bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wider text-secondary">Not on the app</p>
                <p className="text-xs text-ink/50">
                  Add a name to include their share. No invite or reminder — the receiver marks them paid.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Input
                    value={outsideDraft}
                    onChange={(e) => setOutsideDraft(e.target.value)}
                    placeholder="Name"
                    className="min-w-[10rem] flex-1"
                    autoComplete="off"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addOutside();
                      }
                    }}
                  />
                  <Button type="button" variant="ghost" onClick={addOutside}>
                    Add
                  </Button>
                </div>
                {outside.length > 0 && (
                  <ul className="space-y-1 text-sm">
                    {outside.map((p) => (
                      <li key={p.key} className="flex items-center justify-between gap-2">
                        <span className="truncate">{p.name}</span>
                        <button
                          type="button"
                          className="text-xs text-primary"
                          onClick={() => setOutside((prev) => prev.filter((x) => x.key !== p.key))}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="text-sm text-primary" onClick={stopEditingPayers}>
                  Done
                </button>
                <p className="text-xs text-ink/45">
                  {selected.length} members · {outside.length} outside · {filteredMembers.length} shown
                </p>
              </div>
            </div>
          )}

          {sharePreview != null && (
            <p className="text-xs text-ink/55">
              About {formatMoney(Math.round(sharePreview * 100), currency)} each (before remainder cents).
            </p>
          )}
        </div>
      )}

      {/* Payment progress — after requests, until complete */}
      {requested && !completed && (
        <div className="space-y-4">
          {unpaid.length > 0 && (
            <div className="rounded-xl border border-warn/35 bg-[color:var(--color-warn-wash)] px-3 py-2 text-sm text-ink">
              <p className="font-medium text-warn">
                {unpaid.length} unpaid share{unpaid.length === 1 ? "" : "s"}
              </p>
              <p className="mt-0.5 text-xs text-ink/60">
                Members who have not paid get a reminder every 24 hours. Outside-app shares have no I
                have paid step — mark them received when you collect in person.
              </p>
            </div>
          )}
          <PaymentGroup
            title="Not paid yet"
            empty="Everyone has marked paid or been verified."
            entries={unpaid}
            currency={currency}
            currentUserId={currentUserId}
            collectorUserId={displayCollectorId}
            onClaim={async (id) => {
              setError(null);
              const result = await claimLedgerPayment(id);
              if (result?.error) setError(result.error);
              else router.refresh();
            }}
            onVerify={async (id) => {
              setError(null);
              const result = await verifyLedgerPayment(id);
              if (result?.error) setError(result.error);
              else router.refresh();
            }}
          />
          <PaymentGroup
            title="Marked paid · awaiting verify"
            empty="No payments waiting for verify."
            entries={awaiting}
            currency={currency}
            currentUserId={currentUserId}
            collectorUserId={displayCollectorId}
            onVerify={async (id) => {
              setError(null);
              const result = await verifyLedgerPayment(id);
              if (result?.error) setError(result.error);
              else router.refresh();
            }}
          />
          <PaymentGroup
            title="Verified"
            empty="No verified payments yet."
            entries={verified}
            currency={currency}
            currentUserId={currentUserId}
            collectorUserId={displayCollectorId}
          />
        </div>
      )}

      {completed && (
        <p className="text-sm text-ink/60">
          All shares are verified
          {totalCostCents != null ? ` · ${formatMoney(totalCostCents, currency)} collected` : ""}.
        </p>
      )}

      {error && <p className="text-sm text-clay">{error}</p>}

      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          {!requested && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setError(null);
                stopEditingPayers();
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
                stopEditingPayers();
                const fd = new FormData();
                fd.set("eventId", eventId);
                fd.set("amount", amount);
                fd.set("collectorUserId", collector);
                for (const id of selected) fd.append("attendeeId", id);
                for (const p of outside) fd.append("offlineName", p.name);
                void sendWeeklyPaymentRequest(fd).then((result) => {
                  if (result?.error) setError(result.error);
                  else router.refresh();
                });
              }}
            >
              Send payment request
            </Button>
          )}
          {requested && status !== "completed" && allSettled && (
            <Button
              type="button"
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
      )}

      {isAdmin && requested && !allSettled && status !== "completed" && (
        <p className="text-xs text-ink/50">Close unlocks after every share is verified.</p>
      )}
      {isAdmin && mode === "prepaid" && !canSendPrepaid && !requested && (
        <p className="text-xs text-ink/50">Book the field first, then send the payment request.</p>
      )}
      {isAdmin && mode === "postpay" && !canSendPostpaid && !requested && (
        <p className="text-xs text-ink/50">After the session ends you can send payment requests.</p>
      )}
    </div>
  );
}

function PaymentGroup({
  title,
  empty,
  entries,
  currency,
  currentUserId,
  collectorUserId,
  onClaim,
  onVerify,
}: {
  title: string;
  empty: string;
  entries: CostShareEntry[];
  currency: string;
  currentUserId: string | null;
  collectorUserId: string | null | undefined;
  onClaim?: (id: string) => Promise<void>;
  onVerify?: (id: string) => Promise<void>;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-secondary">
        {title} · {entries.length}
      </p>
      {entries.length === 0 ? (
        <p className="mt-1 text-sm text-ink/45">{empty}</p>
      ) : (
        <ul className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-line bg-muted/30 text-sm">
          {entries
            .slice()
            .sort((a, b) => a.fromName.localeCompare(b.fromName))
            .map((row) => {
              const canClaim = Boolean(
                onClaim && currentUserId && row.fromUserId === currentUserId && !row.offline,
              );
              const canVerifyClaimed = Boolean(
                onVerify && currentUserId && collectorUserId === currentUserId && row.status === "claimed",
              );
              const canVerifyOffline = Boolean(
                onVerify &&
                  currentUserId &&
                  collectorUserId === currentUserId &&
                  row.offline &&
                  row.status === "pending",
              );
              return (
                <li
                  key={row.id}
                  className="flex items-center gap-2 border-b border-line px-3 py-2 last:border-0"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {row.fromName}
                    {row.offline ? <span className="text-ink/40"> · outside</span> : null}
                  </span>
                  <span className="shrink-0 text-ink/55">{formatMoney(row.amountCents, currency)}</span>
                  {canClaim && (
                    <form
                      action={async () => {
                        await onClaim?.(row.id);
                      }}
                    >
                      <SubmitButton variant="ghost" size="sm">
                        I have paid
                      </SubmitButton>
                    </form>
                  )}
                  {(canVerifyClaimed || canVerifyOffline) && (
                    <form
                      action={async () => {
                        await onVerify?.(row.id);
                      }}
                    >
                      <SubmitButton variant="ghost" size="sm">
                        {canVerifyOffline ? "Mark received" : "Verified"}
                      </SubmitButton>
                    </form>
                  )}
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
