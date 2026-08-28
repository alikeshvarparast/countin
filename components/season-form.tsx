"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSeason } from "@/lib/actions/season";
import { WEEKDAY_LABELS } from "@/lib/utils";
import { Field, Input, Select } from "@/components/ui";
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
      <fieldset className="space-y-3 rounded-2xl border border-line p-3">
        <legend className="px-1 text-xs uppercase tracking-wider text-ink/50">Duration</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hours">
            <Input name="durationHours" type="number" min={0} max={12} defaultValue={1} required />
          </Field>
          <Field label="Minutes">
            <Select name="durationMinutes" defaultValue="30">
              <option value="0">0</option>
              <option value="15">15</option>
              <option value="30">30</option>
              <option value="45">45</option>
            </Select>
          </Field>
        </div>
        <p className="text-xs text-ink/45">How long you will play each session. Default is 1 hour 30 minutes.</p>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-xs uppercase tracking-wider text-ink/50">Weekdays</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_LABELS.map((label, i) => (
            <label key={label} className="flex items-center gap-2 rounded-full border border-line px-3 py-1 text-sm">
              <input type="checkbox" name="weekday" value={i} defaultChecked={i === 2 || i === 4} />
              {label.slice(0, 3)}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Minimum players">
        <Input name="minPlayers" type="number" min={2} defaultValue={10} />
      </Field>
      <Field label="Contract agreement deadline">
        <Input name="signupClosesAt" type="datetime-local" required />
      </Field>
      <p className="text-sm text-ink/50">
        Members who agree before this deadline become the contract list. Everyone else can play as an occasional.
        Session rates for contract players and occasionals can be set later.
      </p>
      {error && <p className="text-sm text-clay">{error}</p>}
      <SubmitButton>Create season</SubmitButton>
    </form>
  );
}
