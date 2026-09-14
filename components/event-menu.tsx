"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cancelWeeklyEvent, closePresenceVoting, lockPollTime } from "@/lib/actions/weekly";
import { ActionMenu } from "@/components/action-menu";
import { Field, Input, Modal } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

type Panel = "cancel" | "lock" | null;

export function EventMenu({
  slug,
  eventId,
  canVote,
  canAddGuest,
  isAdmin,
  canBook,
  canCancel,
  canEdit,
  canClosePresence,
  lockOptions,
  showDetails = true,
}: {
  slug: string;
  eventId: string;
  canVote?: boolean;
  canAddGuest: boolean;
  isAdmin?: boolean;
  canBook: boolean;
  canCancel: boolean;
  canEdit?: boolean;
  canClosePresence?: boolean;
  lockOptions?: { id: string; label: string }[];
  showDetails?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const href = `/app/c/${slug}/events/${eventId}`;
  const canLock = Boolean(isAdmin && lockOptions && lockOptions.length > 0);
  const showGuests = Boolean(canAddGuest || isAdmin);
  const hasItems =
    showDetails ||
    canVote ||
    showGuests ||
    canLock ||
    canBook ||
    canCancel ||
    canEdit ||
    canClosePresence;
  if (!hasItems) return null;

  function withReturn(path: string) {
    if (!pathname) return path;
    return `${path}?returnTo=${encodeURIComponent(pathname)}`;
  }

  function go(path: string) {
    setMenu(false);
    router.push(withReturn(path));
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
          <button type="button" className="block w-full px-3 py-2.5 text-left hover:bg-muted" onClick={() => go(`${href}/presence`)}>
            Change presence
          </button>
        )}
        {showGuests && (
          <button type="button" className="block w-full px-3 py-2.5 text-left hover:bg-muted" onClick={() => go(`${href}/guests`)}>
            {canAddGuest ? "Add guest" : "Guests"}
          </button>
        )}
        {canEdit && (
          <button type="button" className="block w-full px-3 py-2.5 text-left hover:bg-muted" onClick={() => go(`${href}/edit`)}>
            Edit event
          </button>
        )}
        {canLock && (
          <button
            type="button"
            className="block w-full px-3 py-2.5 text-left hover:bg-muted"
            onClick={() => {
              setPanel("lock");
              setMenu(false);
            }}
          >
            Lock a time
          </button>
        )}
        {canBook && (
          <button type="button" className="block w-full px-3 py-2.5 text-left hover:bg-muted" onClick={() => go(`${href}/book`)}>
            Mark field booked
          </button>
        )}
        {canClosePresence && (
          <button
            type="button"
            className="block w-full px-3 py-2.5 text-left hover:bg-muted"
            onClick={async () => {
              setMenu(false);
              await closePresenceVoting(eventId);
              router.refresh();
            }}
          >
            Close presence voting
          </button>
        )}
        {canCancel && (
          <button
            type="button"
            className="block w-full px-3 py-2.5 text-left text-clay hover:bg-muted"
            onClick={() => {
              setPanel("cancel");
              setMenu(false);
            }}
          >
            Cancel event
          </button>
        )}
      </ActionMenu>

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

      {panel === "cancel" && canCancel && (
        <Modal eyebrow="Cancel" title="Cancel this event?" onClose={() => setPanel(null)}>
          <form
            className="space-y-3"
            action={async () => {
              const result = await cancelWeeklyEvent(eventId);
              setPanel(null);
              if (result && "slug" in result && result.slug) {
                router.push(`/app/c/${result.slug}`);
              }
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
