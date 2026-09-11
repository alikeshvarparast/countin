"use client";

import { useEffect, useState } from "react";
import { LEDGER_DISCLAIMER } from "@/lib/ledger-copy";
import { Card } from "@/components/ui";

const HIDE_MS = 60_000;

/** Shows the credit-tracker notice, then hides it after one minute. */
export function LedgerTrackerNotice() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), HIDE_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <Card className="border-primary/30 bg-primary/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-secondary">Credit tracker</p>
          <p className="mt-2 text-sm text-ink/80">{LEDGER_DISCLAIMER}</p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-full px-2 py-1 text-xs text-ink/50 hover:bg-card hover:text-ink"
          aria-label="Dismiss"
          onClick={() => setVisible(false)}
        >
          Close
        </button>
      </div>
    </Card>
  );
}
