"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSeason } from "@/lib/actions/season";
import { WEEKDAY_LABELS } from "@/lib/utils";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function SeasonForm({ slug, defaultLocation }: { slug: string; defaultLocation: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      action={async (formData) => {
        const result = await createSeason(formData);
        if (result?.error) setError(result.error);
        else if (result?.id) router.push(`/app/c/${slug}/seasons/${result.id}`);
      }}
    >
      <input type="hidden" name="slug" value={slug} />
      <Field label="Season name">
        <Input name="name" required placeholder="Autumn 2026 turf" />
      </Field>
      <Field label="Pitch">
        <Input name="location" defaultValue={defaultLocation} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First session date">
          <Input name="startDate" type="date" required />
        </Field>
        <Field label="Last session date">
          <Input name="endDate" type="date" required />
        </Field>
      </div>
      <Field label="Kickoff time">
        <Input name="timeLocal" type="time" required defaultValue="20:00" />
      </Field>
      <fieldset>
        <legend className="mb-2 text-xs uppercase tracking-wider text-cream/60">Weekdays</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_LABELS.map((label, i) => (
            <label key={label} className="flex items-center gap-2 rounded-full border border-line px-3 py-1 text-sm">
              <input type="checkbox" name="weekday" value={i} defaultChecked={i === 2 || i === 4} />
              {label.slice(0, 3)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Regular session price">
          <Input name="regularPrice" type="number" step="0.01" min="1" required placeholder="12" />
        </Field>
        <Field label="Minimum players">
          <Input name="minPlayers" type="number" min={2} defaultValue={10} />
        </Field>
      </div>
      <p className="text-sm text-cream/50">
        Occasional players pay 50% more. Invited replacements pay the regular rate to the absent contract player.
      </p>
      {error && <p className="text-sm text-clay">{error}</p>}
      <SubmitButton>Create season</SubmitButton>
    </form>
  );
}
