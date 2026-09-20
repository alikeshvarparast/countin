"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setRsvp } from "@/lib/actions/weekly";
import { SubmitButton } from "@/components/submit-button";
import { VoteNeedsFrame, VoteOptionButton } from "@/components/vote-choice";

function presenceTallyLine({
  goingCount,
  notGoingCount,
  guestCount,
  pendingGuests,
  waitlistCount,
  noReplyCount,
}: {
  goingCount: number;
  notGoingCount: number;
  guestCount: number;
  pendingGuests: number;
  waitlistCount: number;
  noReplyCount: number;
}) {
  const parts = [
    `${goingCount} going`,
    `${notGoingCount} out`,
    `${guestCount} guest${guestCount === 1 ? "" : "s"}`,
  ];
  if (pendingGuests > 0) {
    parts.push(
      `${pendingGuests} waiting for approve guest${pendingGuests === 1 ? "" : "s"}`,
    );
  }
  if (waitlistCount > 0) {
    parts.push(`${waitlistCount} waitlist`);
  }
  parts.push(`${noReplyCount} no reply`);
  return parts.join(" · ");
}

export function PresenceVote({
  eventId,
  myStatus,
  goingCount,
  notGoingCount,
  guestCount = 0,
  pendingGuests = 0,
  waitlistCount = 0,
  noReplyCount = 0,
  canVote,
  onDone,
  forceEdit,
  returnTo,
  /** Upcoming: hide Going/Not going until Change presence. */
  collapseChoices,
  pendingCancel,
}: {
  eventId: string;
  myStatus?: string | null;
  goingCount: number;
  notGoingCount: number;
  guestCount?: number;
  pendingGuests?: number;
  waitlistCount?: number;
  noReplyCount?: number;
  canVote: boolean;
  onDone?: () => void;
  forceEdit?: boolean;
  returnTo?: string;
  collapseChoices?: boolean;
  pendingCancel?: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(myStatus ?? "");
  const [changing, setChanging] = useState(() => {
    if (forceEdit) return true;
    if (collapseChoices) return false;
    return !myStatus;
  });
  const [error, setError] = useState<string | null>(null);
  const canSubmit = canVote && (changing || (!myStatus && !collapseChoices));
  const needsReply = canVote && !myStatus && !collapseChoices;
  const showChoices = canSubmit;
  const showReport = Boolean(myStatus) && !changing;
  const showChangeLink = canVote && !changing && (Boolean(myStatus) || Boolean(collapseChoices));
  const tally = presenceTallyLine({
    goingCount,
    notGoingCount,
    guestCount,
    pendingGuests,
    waitlistCount,
    noReplyCount,
  });

  if (!canVote && !myStatus) {
    return <p className="text-xs text-ink/50">{tally}</p>;
  }

  return (
    <VoteNeedsFrame needsReply={needsReply}>
      <div
        className={
          needsReply
            ? "rounded-2xl border border-warn/30 bg-[color:var(--color-warn-wash)] p-2"
            : undefined
        }
      >
        {needsReply && (
          <p className="mb-2 px-1 text-xs font-medium text-warn">Presence — your reply is needed</p>
        )}
        {pendingCancel && (
          <p className="mb-2 px-1 text-xs font-medium text-warn">
            Leave request pending admin approve or decline.
          </p>
        )}
        {showReport && <p className="text-xs text-ink/55">{tally}</p>}
        {showChoices && (
          <div className="grid grid-cols-2 gap-1.5">
            <VoteOptionButton
              active={selected === "going"}
              disabled={!canSubmit}
              onClick={() => setSelected("going")}
              label="Going"
              detail={String(goingCount)}
              className="px-2.5 py-2.5"
            />
            <VoteOptionButton
              active={selected === "not_going"}
              disabled={!canSubmit}
              onClick={() => setSelected("not_going")}
              label="Not going"
              detail={String(notGoingCount)}
              className="px-2.5 py-2.5"
            />
          </div>
        )}
        {canSubmit && (
          <form
            className="mt-3"
            action={async (formData) => {
              setError(null);
              const result = await setRsvp(formData);
              if (result?.error) {
                setError(result.error);
                if ("pendingCancel" in result && result.pendingCancel) {
                  router.refresh();
                }
                return;
              }
              setChanging(false);
              onDone?.();
              if (returnTo) router.push(returnTo);
              router.refresh();
            }}
          >
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="status" value={selected} />
            <SubmitButton
              size={returnTo ? "md" : "sm"}
              disabled={!selected}
              className={returnTo ? "w-full" : undefined}
            >
              Submit
            </SubmitButton>
            {error && <p className="mt-2 text-xs text-warn">{error}</p>}
          </form>
        )}
        {showChangeLink && (
          <button type="button" className="mt-2 text-sm text-primary" onClick={() => setChanging(true)}>
            Change presence
          </button>
        )}
      </div>
    </VoteNeedsFrame>
  );
}
