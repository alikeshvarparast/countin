"use client";

import { acceptLedgerDisclaimer } from "@/lib/actions/community";
import { LEDGER_DISCLAIMER } from "@/lib/ledger-copy";
import { SubmitButton } from "@/components/submit-button";

export function LedgerDisclaimer({
  slug,
  communityName,
  accepted,
}: {
  slug: string;
  communityName: string;
  accepted: boolean;
}) {
  if (accepted) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
      <div className="w-full max-w-md rounded-3xl border border-line bg-card p-6 text-ink shadow-[0_20px_50px_rgba(63,58,52,0.2)]">
        <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">Before you play</p>
        <h2 className="mt-2 font-display text-lg">Credit tracker only</h2>
        <p className="mt-3 text-sm text-ink/75">
          Welcome to {communityName}. {LEDGER_DISCLAIMER}
        </p>
        <form
          className="mt-6"
          action={async (formData) => {
            await acceptLedgerDisclaimer(formData);
          }}
        >
          <input type="hidden" name="slug" value={slug} />
          <SubmitButton className="w-full">I have read and agree</SubmitButton>
        </form>
      </div>
    </div>
  );
}
