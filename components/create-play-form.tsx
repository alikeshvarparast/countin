"use client";

import { useState } from "react";
import { WeeklyEventForm } from "@/components/weekly-form";
import { SeasonForm } from "@/components/season-form";

export function CreatePlayForm({
  slug,
  defaultLocation,
  canCreateSeason,
}: {
  slug: string;
  defaultLocation: string;
  canCreateSeason: boolean;
}) {
  const [kind, setKind] = useState<"single" | "season" | null>(null);

  if (!kind) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setKind("single")}
          className="w-full rounded-2xl border border-line bg-card p-5 text-left shadow-[0_8px_24px_rgba(63,58,52,0.06)] hover:border-primary/40"
        >
          <p className="text-xs uppercase tracking-[0.18em] text-primary">Single session</p>
          <h3 className="mt-1 font-display text-lg">One night</h3>
          <p className="mt-1 text-sm text-ink/55">A one-off kickabout. Pick a date, or start with a time poll.</p>
        </button>
        {canCreateSeason ? (
          <button
            type="button"
            onClick={() => setKind("season")}
            className="w-full rounded-2xl border border-line bg-card p-5 text-left shadow-[0_8px_24px_rgba(63,58,52,0.06)] hover:border-primary/40"
          >
            <p className="text-xs uppercase tracking-[0.18em] text-primary">Season</p>
            <h3 className="mt-1 font-display text-lg">Repeating nights</h3>
            <p className="mt-1 text-sm text-ink/55">
              A block of sessions with a contract list. Rates can be added later.
            </p>
          </button>
        ) : (
          <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-ink/50">
            Only admins can start a repeating season.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button type="button" className="text-sm text-primary" onClick={() => setKind(null)}>
        ← Change type
      </button>
      {kind === "single" ? (
        <WeeklyEventForm slug={slug} defaultLocation={defaultLocation} />
      ) : (
        <SeasonForm slug={slug} defaultLocation={defaultLocation} />
      )}
    </div>
  );
}
