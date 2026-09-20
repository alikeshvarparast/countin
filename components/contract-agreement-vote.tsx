"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setSeasonIntent } from "@/lib/actions/season";
import { SubmitButton } from "@/components/submit-button";
import { VoteNeedsFrame, VoteOptionButton } from "@/components/vote-choice";

export function ContractAgreementVote({
  seasonId,
  myIntent,
  agreeCount,
  declineCount,
  noReplyCount = 0,
  canVote,
  compact = false,
}: {
  seasonId: string;
  myIntent?: string | null;
  agreeCount: number;
  declineCount: number;
  noReplyCount?: number;
  canVote: boolean;
  /** Home / card layout — choice cards like presence */
  compact?: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(
    myIntent === "decline" ? "decline" : myIntent === "agree" ? "agree" : "",
  );
  const [changing, setChanging] = useState(!myIntent);
  const needsReply = canVote && !myIntent;
  const canSubmit = canVote && (changing || !myIntent);
  const tallyLine =
    noReplyCount > 0
      ? `${agreeCount} agreed · ${declineCount} out · ${noReplyCount} no reply`
      : `${agreeCount} agreed · ${declineCount} out`;

  if (!canVote && !myIntent) {
    return (
      <p className={compact ? "text-xs text-ink/50" : "mt-4 text-sm text-ink/50"}>
        {tallyLine}
      </p>
    );
  }

  return (
    <VoteNeedsFrame needsReply={needsReply} className={compact ? undefined : "mt-4"}>
      <div
        className={
          needsReply
            ? compact
              ? "rounded-2xl border border-warn/30 bg-[color:var(--color-warn-wash)] p-2"
              : "rounded-2xl border border-warn/30 bg-[color:var(--color-warn-wash)] p-3"
            : undefined
        }
      >
        {needsReply && (
          <p
            className={
              compact
                ? "mb-2 px-1 text-xs font-medium text-warn"
                : "mb-3 text-sm font-medium text-warn"
            }
          >
            Contract place — your reply is needed
          </p>
        )}

        {compact ? (
          <div className="grid grid-cols-2 gap-1.5">
            <VoteOptionButton
              active={selected === "agree"}
              disabled={!canSubmit}
              onClick={() => setSelected("agree")}
              label="Agree"
              detail={`${agreeCount}`}
              className="px-2.5 py-2.5"
            />
            <VoteOptionButton
              active={selected === "decline"}
              disabled={!canSubmit}
              onClick={() => setSelected("decline")}
              label="Not this season"
              detail={`${declineCount}`}
              className="px-2.5 py-2.5"
            />
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <VoteOptionButton
              active={selected === "agree"}
              disabled={!canSubmit}
              onClick={() => setSelected("agree")}
              label="I agree to the contract"
              detail={`${agreeCount} agreed`}
            />
            <VoteOptionButton
              active={selected === "decline"}
              disabled={!canSubmit}
              onClick={() => setSelected("decline")}
              label="Not this season"
              detail={`${declineCount} out`}
            />
          </div>
        )}

        {myIntent && !changing && (
          <p className={compact ? "mt-2 text-xs text-ink/55" : "mt-3 text-sm text-ink/55"}>{tallyLine}</p>
        )}

        {canSubmit && (
          <form
            className="mt-3"
            action={async () => {
              if (selected !== "agree" && selected !== "decline") return;
              await setSeasonIntent(seasonId, selected);
              setChanging(false);
              router.refresh();
            }}
          >
            <SubmitButton size={compact ? "sm" : "md"} className="w-full" disabled={!selected}>
              Submit reply
            </SubmitButton>
          </form>
        )}
        {canVote && myIntent && !changing && (
          <button
            type="button"
            className={compact ? "mt-2 text-sm text-primary" : "mt-3 text-sm text-primary"}
            onClick={() => setChanging(true)}
          >
            Change reply
          </button>
        )}
        {!compact && myIntent === "agree" && !changing && (
          <p className="mt-3 text-sm text-ink/70">You agreed to the contract.</p>
        )}
        {!compact && myIntent === "decline" && !changing && (
          <p className="mt-3 text-sm text-ink/70">You said you will not take a contract.</p>
        )}
      </div>
    </VoteNeedsFrame>
  );
}
