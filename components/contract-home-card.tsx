"use client";

import Link from "next/link";
import { statusBadgeTone } from "@/components/event-card";
import { ContractAgreementVote } from "@/components/contract-agreement-vote";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

export function ContractHomeCard({
  slug,
  seasonId,
  title,
  location,
  agreeCount,
  declineCount,
  noReplyCount = 0,
  minPlayers,
  myIntent,
  canVote,
}: {
  slug: string;
  seasonId: string;
  title: string;
  location?: string | null;
  agreeCount: number;
  declineCount: number;
  noReplyCount?: number;
  minPlayers?: number | null;
  myIntent?: string | null;
  canVote: boolean;
}) {
  const href = `/app/c/${slug}/seasons/${seasonId}`;
  const needsReply = canVote && !myIntent;
  const statusLine = myIntent === "decline"
    ? "You said not this season"
    : myIntent === "agree"
      ? "You agreed"
      : "Do you want a contract place?";

  return (
    <div
      className={cn(
        "motion-press flex h-full flex-col rounded-2xl border bg-card px-3 py-3 shadow-[0_8px_24px_rgba(63,58,52,0.06)]",
        needsReply
          ? "vote-needs-reply border-warn/45 bg-[color:var(--color-warn-wash)] shadow-[0_10px_28px_rgba(180,83,9,0.14)]"
          : "border-line",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-warn">
            Contract agreement
          </p>
          <Link href={href} className="mt-0.5 block truncate text-sm font-medium leading-tight hover:text-primary">
            {title}
          </Link>
          <p className="mt-0.5 truncate text-xs text-ink/50">
            {location ? `${location} · ` : ""}
            {agreeCount} agreed
            {typeof minPlayers === "number" ? ` · min ${minPlayers}` : ""}
            {noReplyCount > 0 ? ` · ${noReplyCount} no reply` : ""}
            {` · ${statusLine}`}
          </p>
        </div>
        <Badge tone={statusBadgeTone("voting")}>voting</Badge>
      </div>

      <div className="mt-auto pt-3">
        <ContractAgreementVote
          seasonId={seasonId}
          myIntent={myIntent}
          agreeCount={agreeCount}
          declineCount={declineCount}
          noReplyCount={noReplyCount}
          canVote={canVote}
          compact
        />
      </div>
    </div>
  );
}
