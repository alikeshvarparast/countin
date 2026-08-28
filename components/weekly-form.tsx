"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createWeeklyEvent } from "@/lib/actions/weekly";
import { Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function WeeklyEventForm({
  slug,
  defaultLocation,
}: {
  slug: string;
  defaultLocation: string;
}) {
  const router = useRouter();
  const [usePoll, setUsePoll] = useState(false);
  const [options, setOptions] = useState(["", ""]);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      action={async (formData) => {
        const result = await createWeeklyEvent(formData);
        if (result?.error) setError(result.error);
        else if (result?.id) router.push(`/app/c/${slug}/events/${result.id}`);
      }}
    >
      <input type="hidden" name="slug" value={slug} />
      <Field label="Title">
        <Input name="title" required placeholder="Wednesday night 8v8" />
      </Field>
      <Field label="Pitch">
        <Input name="location" defaultValue={defaultLocation} />
      </Field>
      <Field label="Minimum players to book">
        <Input name="minPlayers" type="number" min={2} defaultValue={10} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink/70">
        <input
          type="checkbox"
          name="usePoll"
          checked={usePoll}
          onChange={(e) => setUsePoll(e.target.checked)}
        />
        Start with a time poll
      </label>
      {usePoll ? (
        <>
          {options.map((opt, i) => (
            <Field key={i} label={`Option ${i + 1}`}>
              <Input
                name="option"
                type="datetime-local"
                required
                value={opt}
                onChange={(e) => {
                  const next = [...options];
                  next[i] = e.target.value;
                  setOptions(next);
                }}
              />
            </Field>
          ))}
          <button type="button" className="text-sm text-primary" onClick={() => setOptions([...options, ""])}>
            Add another time
          </button>
          <Field label="Poll closes">
            <Input name="pollClosesAt" type="datetime-local" />
          </Field>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date">
              <Input name="startDate" type="date" required={!usePoll} />
            </Field>
            <Field label="Kickoff time">
              <Input name="startTime" type="time" />
            </Field>
          </div>
          <p className="-mt-2 text-xs text-ink/45">Leave time blank if only the day is fixed.</p>
          <Field label="Presence deadline">
            <Input name="rsvpDeadlineAt" type="datetime-local" />
          </Field>
        </>
      )}
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
        <p className="text-xs text-ink/45">How long you will play. Default is 1 hour 30 minutes.</p>
      </fieldset>
      <p className="text-xs text-ink/45">Costs can be posted later, after you know who showed up.</p>
      {error && <p className="text-sm text-clay">{error}</p>}
      <SubmitButton>Create session</SubmitButton>
    </form>
  );
}
