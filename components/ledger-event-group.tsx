"use client";

import { useState } from "react";
import Link from "next/link";
import { claimLedgerPayment, verifyLedgerPayment } from "@/lib/ledger-pay";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui";
import { formatMoney, formatWhen } from "@/lib/utils";

const PREVIEW = 3;

function statusLabel(status: string, offline?: boolean) {
  if (status === "settled") return "Settled";
  if (status === "claimed") return "Waiting for verify";
  if (offline) return "Outside · verify";
  return "Due";
}

export type LedgerEntryView = {
  id: string;
  fromName: string;
  toName: string;
  amountCents: number;
  reason: string;
  status: string;
  createdAt: number;
  offline?: boolean;
  canClaim: boolean;
  canVerify: boolean;
  verifyHint: boolean;
};

export function LedgerEventGroup({
  title,
  subtitle,
  href,
  currency,
  timeZone,
  entries,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  currency: string;
  timeZone: string;
  entries: LedgerEntryView[];
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = entries.length > PREVIEW;
  const shown = expanded || !hasMore ? entries : entries.slice(0, PREVIEW);

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2">
        <div className="min-w-0">
          {href ? (
            <Link href={href} className="font-medium text-ink hover:text-primary">
              {title}
            </Link>
          ) : (
            <p className="font-medium text-ink">{title}</p>
          )}
          {subtitle && <p className="text-xs text-ink/45">{subtitle}</p>}
        </div>
        <p className="text-xs text-ink/40">
          {entries.length} entr{entries.length === 1 ? "y" : "ies"}
        </p>
      </div>
      <ul className="space-y-3">
        {shown.map((row) => (
          <li key={row.id} className="flex items-center gap-3 border-b border-line py-2 last:border-b-0">
            <p className="min-w-0 flex-1 truncate text-sm">
              <span className="font-medium">
                {row.fromName} → {row.toName}
              </span>
              <span className="ml-2">{formatMoney(row.amountCents, currency)}</span>
              <span className="ml-2 text-ink/45">
                {row.reason.replaceAll("_", " ")} · {formatWhen(row.createdAt, timeZone)}
                {row.offline ? " · outside app" : ""}
                {row.canClaim ? " · your payment due" : ""}
                {row.verifyHint
                  ? row.offline && row.status === "pending"
                    ? " · verify directly"
                    : " · verify this payment"
                  : ""}
              </span>
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Badge tone={row.status === "settled" ? "lime" : row.status === "claimed" ? "line" : "clay"}>
                {statusLabel(row.status, row.offline)}
              </Badge>
              {row.canClaim && (
                <form
                  action={async () => {
                    await claimLedgerPayment(row.id);
                  }}
                >
                  <SubmitButton variant="ghost" size="sm">
                    I have paid
                  </SubmitButton>
                </form>
              )}
              {row.canVerify && (
                <form
                  action={async () => {
                    await verifyLedgerPayment(row.id);
                  }}
                >
                  <SubmitButton variant="ghost" size="sm">
                    {row.offline && row.status === "pending" ? "Mark received" : "Verified"}
                  </SubmitButton>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          className="mt-2 text-sm font-medium text-primary"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : `See more… (${entries.length - PREVIEW} more)`}
        </button>
      )}
    </section>
  );
}
