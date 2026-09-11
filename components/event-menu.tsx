"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cancelWeeklyEvent, confirmFieldBooked, lockPollTime, removeEventGuest } from "@/lib/actions/weekly";
import { ActionMenu } from "@/components/action-menu";
import { GuestForm } from "@/components/guest-form";
import { PresenceVote } from "@/components/presence-vote";
import { Field, Input, Modal } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

type Panel = "presence" | "guest" | "book" | "cancel" | "lock" | null;

export function EventMenu({
  slug,
  eventId,
  canVote,
  myStatus,
  canAddGuest,
  isAdmin,
  canBook,
  canCancel,
  lockOptions,
  goingCount,
  notGoingCount,
  guests,
  showDetails = true,
}: {
  slug: string;
  eventId: string;
  canVote?: boolean;
  myStatus?: string | null;
  canAddGuest: boolean;
  isAdmin?: boolean;
  canBook: boolean;
  canCancel: boolean;
  lockOptions?: { id: string; label: string }[];
  goingCount?: number;
  notGoingCount?: number;
  guests?: { id: string; label: string; hostName: string; canRemove: boolean; status?: string }[];
  showDetails?: boolean;
}) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const href = `/app/c/${slug}/events/${eventId}`;
  const canLock = Boolean(isAdmin && lockOptions && lockOptions.length > 0);
  const showGuests = canAddGuest || Boolean(isAdmin && guests && guests.length > 0);
  const hasItems = showDetails || canVote || showGuests || canLock || canBook || canCancel;
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
      <ActionMenu open={menu} onClose={() => setMenu(false)}>
        {showDetails && (
          <button
            type="button"
            className="block w-full px-3 py-2.5 text-left hover:bg-muted"
            onClick={() => {
              setMenu(false);
              router.push(href);
            }}
          >
            See details
          </button>
        )}
        {canVote && (
          <button type="button" className="block w-full px-3 py-2.5 text-left hover:bg-muted" onClick={() => open("presence")}>
            Change presence
          </button>
        )}
        {showGuests && (
          <button type="button" className="block w-full px-3 py-2.5 text-left hover:bg-muted" onClick={() => open("guest")}>
            {canAddGuest ? "Add guest" : "Guests"}
          </button>
        )}
        {canLock && (
          <button type="button" className="block w-full px-3 py-2.5 text-left hover:bg-muted" onClick={() => open("lock")}>
            Lock a time
          </button>
        )}
        {canBook && (
          <button type="button" className="block w-full px-3 py-2.5 text-left hover:bg-muted" onClick={() => open("book")}>
            Mark field booked
          </button>
        )}
        {canCancel && (
          <button type="button" className="block w-full px-3 py-2.5 text-left text-clay hover:bg-muted" onClick={() => open("cancel")}>
            Cancel event
          </button>
        )}
      </ActionMenu>

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

      {panel === "guest" && showGuests && (
        <Modal eyebrow="Guests" title="Guest list" onClose={() => setPanel(null)}>
          {canAddGuest && <GuestForm eventId={eventId} />}
          {guests && guests.length > 0 && (
            <ul className="mt-3 space-y-2 text-sm">
              {guests.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2">
                  <span>
                    {g.label} <span className="text-ink/45">· {g.hostName}</span>
                  </span>
                  {g.canRemove && (
                    <form
                      action={async () => {
                        await removeEventGuest(g.id);
                        router.refresh();
                      }}
                    >
                      <SubmitButton variant="ghost" className="h-8 px-2 text-xs">
                        Remove
                      </SubmitButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {panel === "lock" && canLock && lockOptions && (
        <Modal eyebrow="Time" title="Lock a kickoff" onClose={() => setPanel(null)}>
          <form
            className="space-y-3"
            action={async (formData) => {
              await lockPollTime(formData);
              setPanel(null);
              router.refresh();
            }}
          >
            <input type="hidden" name="eventId" value={eventId} />
            <Field label="Option">
              <select name="optionId" required className="h-11 w-full rounded-xl border border-line bg-card px-3 text-sm">
                {lockOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <SubmitButton>Lock time</SubmitButton>
          </form>
        </Modal>
      )}

      {panel === "book" && canBook && (
        <Modal eyebrow="Field" title="Mark field booked?" onClose={() => setPanel(null)}>
          <form
            action={async () => {
              await confirmFieldBooked(eventId);
              setPanel(null);
              router.refresh();
            }}
          >
            <SubmitButton>Confirm booked</SubmitButton>
          </form>
        </Modal>
      )}

      {panel === "cancel" && canCancel && (
        <Modal eyebrow="Cancel" title="Cancel this event?" onClose={() => setPanel(null)}>
          <form
            className="space-y-3"
            action={async (formData) => {
              await cancelWeeklyEvent(eventId);
              setPanel(null);
              router.refresh();
            }}
          >
            <Field label="Optional note">
              <Input name="note" placeholder="Weather / pitch closed…" />
            </Field>
            <SubmitButton variant="danger">Cancel event</SubmitButton>
          </form>
        </Modal>
      )}
    </div>
  );
}
