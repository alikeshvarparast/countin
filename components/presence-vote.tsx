"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setRsvp } from "@/lib/actions/weekly";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";

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
  const options = [
    { id: "going", label: "Going", votes: goingCount },
    { id: "not_going", label: "Not going", votes: notGoingCount },
  ];
  const canSubmit = canVote && (changing || !myStatus);

  if (!canVote && !myStatus) {
    return (
      <p className="text-xs text-ink/50">
        Going {goingCount} · Not going {notGoingCount}
      </p>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
        {options.map((opt) => {
          const active = selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={!canSubmit}
              onClick={() => setSelected(opt.id)}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-medium transition",
                active ? "bg-card text-ink shadow-sm" : "text-ink/55 hover:text-ink",
                !canSubmit && "opacity-70",
              )}
            >
              {opt.label} · {opt.votes}
            </button>
          );
        })}
      </div>
      {canSubmit && (
        <form
          className="mt-3"
          action={async (formData) => {
            await setRsvp(formData);
            setChanging(false);
            onDone?.();
            if (returnTo) router.push(returnTo);
            router.refresh();
          }}
        >
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="status" value={selected} />
          <SubmitButton size={returnTo ? "md" : "sm"} disabled={!selected} className={returnTo ? "w-full" : undefined}>
            Submit
          </SubmitButton>
        </form>
      )}
      {canVote && myStatus && !changing && (
        <button type="button" className="mt-2 text-sm text-primary" onClick={() => setChanging(true)}>
          Change presence
        </button>
      )}
    </div>
  );
}
