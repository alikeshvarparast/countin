"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setRsvp } from "@/lib/actions/weekly";
import { SubmitButton } from "@/components/submit-button";
import { VoteNeedsFrame, VoteOptionButton } from "@/components/vote-choice";

export function PresenceVote({
  eventId,
  myStatus,
  goingCount,
  notGoingCount,
  canVote,
  onDone,
  forceEdit,
  returnTo,
}: {
  eventId: string;
  myStatus?: string | null;
  goingCount: number;
  notGoingCount: number;
  canVote: boolean;
  onDone?: () => void;
  forceEdit?: boolean;
  returnTo?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(myStatus ?? "");
  const [changing, setChanging] = useState(!myStatus || Boolean(forceEdit));
  const [error, setError] = useState<string | null>(null);
  const canSubmit = canVote && (changing || !myStatus);
  const needsReply = canVote && !myStatus;

  if (!canVote && !myStatus) {
    return (
      <p className="text-xs text-ink/50">
        Going {goingCount} · Not going {notGoingCount}
      </p>
    );
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
        {canSubmit && (
          <form
            className="mt-3"
            action={async (formData) => {
              setError(null);
              const result = await setRsvp(formData);
              if (result?.error) {
                setError(result.error);
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
        {canVote && myStatus && !changing && (
          <button type="button" className="mt-2 text-sm text-primary" onClick={() => setChanging(true)}>
            Change presence
          </button>
        )}
      </div>
    </VoteNeedsFrame>
  );
}
