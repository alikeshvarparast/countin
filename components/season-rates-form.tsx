"use client";

import { useState } from "react";
import { updateSeasonRates } from "@/lib/actions/season";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function SeasonRatesForm({
  seasonId,
  currency,
  regularPriceCents,
  occasionalPriceCents,
}: {
  seasonId: string;
  currency: string;
  regularPriceCents: number;
  occasionalPriceCents: number | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const regularDefault = regularPriceCents > 0 ? (regularPriceCents / 100).toString() : "";
  const occasionalDefault = occasionalPriceCents && occasionalPriceCents > 0 ? (occasionalPriceCents / 100).toString() : "";
  return (
    <form
      className="mt-4 space-y-3"
      action={async (formData) => {
        const result = await updateSeasonRates(formData);
        setError(result?.error ?? null);
      }}
    >
      <input type="hidden" name="seasonId" value={seasonId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`Contract rate (${currency})`}>
          <Input name="regularPrice" type="number" step="0.01" min="0.01" required defaultValue={regularDefault} />
        </Field>
        <Field label={`Occasional rate (${currency})`}>
          <Input name="occasionalPrice" type="number" step="0.01" min="0.01" required defaultValue={occasionalDefault} />
        </Field>
      </div>
      {error && <p className="text-sm text-clay">{error}</p>}
      <SubmitButton>{regularPriceCents > 0 ? "Update rates" : "Save rates"}</SubmitButton>
    </form>
  );
}
