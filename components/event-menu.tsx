"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cancelWeeklyEvent, confirmFieldBooked, lockPollTime, postWeeklyCost, removeEventGuest } from "@/lib/actions/weekly";
import { GuestForm } from "@/components/guest-form";
import { PresenceVote } from "@/components/presence-vote";
import { Field, Input, Modal, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { formatMoney } from "@/lib/utils";

type Panel = "presence" | "costs" | "guest" | "book" | "cancel" | "lock" | null;

export function EventMenu({
  slug,
  eventId,
  title,
  currency,
  canVote,
  myStatus,
  canAddGuest,
  isAdmin,
  canPostCost,
  canBook,
  canCancel,
  lockOptions,
  collectorName,
  totalCostCents,
  paymentInfo,
  goingCount,
  notGoingCount,
  guestCount,
  guests,
  showDetails = true,
}: {
  slug: string;
  eventId: string;
  title: string;
  currency: string;
  canVote?: boolean;
  myStatus?: string | null;
  canAddGuest: boolean;
  isAdmin?: boolean;
  canPostCost: boolean;
  canBook: boolean;
  canCancel: boolean;
  lockOptions?: { id: string; label: string }[];
  collectorName?: string;
  totalCostCents?: number | null;
  paymentInfo?: string | null;
  goingCount?: number;
  notGoingCount?: number;
  guestCount?: number;
  guests?: { id: string; label: string; hostName: string; canRemove: boolean; status?: string }[];
  showDetails?: boolean;
}) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const href = `/app/c/${slug}/events/${eventId}`;
  const canLock = Boolean(isAdmin && lockOptions && lockOptions.length > 0);
  const showGuests = canAddGuest || Boolean(isAdmin && guests && guests.length > 0);
  const hasItems =
    showDetails || canVote || showGuests || isAdmin || canLock || canBook || canCancel;
  if (!hasItems) return null;

  function open(next: Panel) {
    setPanel(next);
    setMenu(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/60 hover:bg-muted hover:text-ink"
        aria-label="Event actions"
        onClick={() => setMenu((v) => !v)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {menu && (
        <div className="absolute right-0 z-30 mt-1 w-52 rounded-2xl border border-line bg-card py-1 text-sm shadow-[0_12px_32px_rgba(63,58,52,0.12)]">
          {showDetails && (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left hover:bg-muted"
              onClick={() => {
                setMenu(false);
                router.push(href);
              }}
            >
              See details
            </button>
          )}
          {canVote && (
            <button type="button" className="block w-full px-3 py-2 text-left hover:bg-muted" onClick={() => open("presence")}>
              Change presence
            </button>
          )}
          {showGuests && (
            <button type="button" className="block w-full px-3 py-2 text-left hover:bg-muted" onClick={() => open("guest")}>
              {canAddGuest ? "Add guest" : "Guests"}
            </button>
          )}
          {isAdmin && (
            <button type="button" className="block w-full px-3 py-2 text-left hover:bg-muted" onClick={() => open("costs")}>
              Costs
            </button>
          )}
          {canLock && (
            <button type="button" className="block w-full px-3 py-2 text-left hover:bg-muted" onClick={() => open("lock")}>
              Lock a time
            </button>
          )}
          {canBook && (
            <button type="button" className="block w-full px-3 py-2 text-left hover:bg-muted" onClick={() => open("book")}>
              Mark field booked
            </button>
          )}
          {canCancel && (
            <button type="button" className="block w-full px-3 py-2 text-left text-clay hover:bg-muted" onClick={() => open("cancel")}>
              Cancel event
            </button>
          )}
        </div>
      )}

      {panel === "presence" && canVote && (
        <Modal eyebrow="Presence" title="Are you going?" onClose={() => setPanel(null)}>
          <PresenceVote
            eventId={eventId}
            myStatus={myStatus}
            goingCount={goingCount ?? 0}
            notGoingCount={notGoingCount ?? 0}
            canVote
            forceEdit
            onDone={() => setPanel(null)}
          />
        </Modal>
      )}

      {panel === "costs" && isAdmin && (
        <Modal eyebrow="Costs" title={title} onClose={() => setPanel(null)}>
          <div className="space-y-3 text-sm">
            <p>
              Collector: <strong>{collectorName || "the collector"}</strong>
              {totalCostCents != null && ` · total ${formatMoney(totalCostCents, currency)}`}
            </p>
            {paymentInfo && <p className="whitespace-pre-wrap text-ink/70">{paymentInfo}</p>}
            {totalCostCents == null && <p className="text-ink/50">Cost will be posted after the session.</p>}
            {totalCostCents != null && (
              <p className="text-ink/55">
                Posted among {goingCount ?? 0} players
                {guestCount ? ` and ${guestCount} guest${guestCount === 1 ? "" : "s"}` : ""}. See the ledger.
              </p>
            )}
            {canPostCost && (
              <form
                className="space-y-3 border-t border-line pt-3"
                action={async (formData) => {
                  await postWeeklyCost(formData);
                  setPanel(null);
                  router.refresh();
                }}
              >
                <input type="hidden" name="eventId" value={eventId} />
                <Field label={`Total (${currency})`}>
                  <Input name="amount" type="number" step="0.01" min="0.01" required />
                </Field>
                <Field label="Payment details">
                  <Textarea name="paymentInfo" rows={2} placeholder="E-transfer to…" />
                </Field>
                <SubmitButton>Split & notify</SubmitButton>
              </form>
            )}
          </div>
        </Modal>
      )}

      {panel === "guest" && showGuests && (
        <Modal eyebrow="Guests" title={canAddGuest ? "Add a guest" : "Guests"} onClose={() => setPanel(null)}>
          <ul className="space-y-2 text-sm">
            {(!guests || guests.length === 0) && <li className="text-ink/45">No guests yet.</li>}
            {guests?.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2">
                <span>
                  {g.label}{" "}
                  <span className="text-ink/45">
                    (guest of {g.hostName}
                    {g.status === "pending" ? " · waiting" : ""})
                  </span>
                </span>
                {g.canRemove && (
                  <form
                    action={async () => {
                      await removeEventGuest(g.id);
                      router.refresh();
                    }}
                  >
                    <SubmitButton size="sm" variant="ghost">
                      Remove
                    </SubmitButton>
                  </form>
                )}
              </li>
            ))}
          </ul>
          {canAddGuest && (
            <div className="mt-3 border-t border-line pt-3">
              <GuestForm eventId={eventId} />
            </div>
          )}
        </Modal>
      )}

      {panel === "lock" && canLock && (
        <Modal eyebrow="Time poll" title="Lock a time" onClose={() => setPanel(null)}>
          <ul className="space-y-3">
            {lockOptions?.map((opt) => (
              <li key={opt.id}>
                <form
                  action={async (formData) => {
                    await lockPollTime(formData);
                    setPanel(null);
                    router.refresh();
                  }}
                  className="space-y-2 rounded-xl border border-line p-3"
                >
                  <input type="hidden" name="optionId" value={opt.id} />
                  <p className="text-sm">{opt.label}</p>
                  <Field label="Presence deadline">
                    <Input name="rsvpDeadlineAt" type="datetime-local" />
                  </Field>
                  <SubmitButton>Lock this time</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {panel === "book" && canBook && (
        <Modal eyebrow="Field" title="Mark this session booked?" onClose={() => setPanel(null)}>
          <form
            action={async () => {
              await confirmFieldBooked(eventId);
              setPanel(null);
              router.refresh();
            }}
          >
            <SubmitButton>Mark field booked</SubmitButton>
          </form>
        </Modal>
      )}

      {panel === "cancel" && canCancel && (
        <Modal eyebrow="Danger" title="Cancel this event?" onClose={() => setPanel(null)}>
          <p className="mb-3 text-sm text-ink/60">Members will be notified. This cannot be undone.</p>
          <form
            action={async () => {
              await cancelWeeklyEvent(eventId);
              setPanel(null);
              router.refresh();
            }}
          >
            <SubmitButton variant="danger">Cancel event</SubmitButton>
          </form>
        </Modal>
      )}
    </div>
  );
}
