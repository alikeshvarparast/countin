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
  const [startTime, setStartTime] = useState("");
  const [rsvpDeadlineAt, setRsvpDeadlineAt] = useState("");

  return (
    <form
      className="min-w-0 space-y-4"
      action={async (formData) => {
        formData.set("startTime", startTime);
        formData.set("rsvpDeadlineAt", rsvpDeadlineAt);
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
      <Field label="Maximum players (waitlist after this)">
        <Input name="maxPlayers" type="number" min={2} placeholder="Optional" />
      </Field>
      <Field label="Payment timing">
        <Select name="paymentMode" defaultValue="postpay">
          <option value="postpay">Post-paid — split after the session</option>
          <option value="prepaid">Pre-paid — request payment after booking</option>
        </Select>
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
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Date">
              <Input name="startDate" type="date" required={!usePoll} />
            </Field>
            <Field label="Kickoff time">
              <div className="flex min-w-0 items-center gap-2">
                <Input
                  name="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="min-w-0 flex-1"
                />
                {startTime ? (
                  <button type="button" className="shrink-0 text-sm text-primary" onClick={() => setStartTime("")}>
                    Clear
                  </button>
                ) : null}
              </div>
            </Field>
          </div>
          <p className="-mt-2 text-xs text-ink/45">Tap Clear for date-only — iPhone cannot empty the clock by itself.</p>
          <Field label="Presence deadline">
            <div className="flex min-w-0 items-center gap-2">
              <Input
                name="rsvpDeadlineAt"
                type="datetime-local"
                value={rsvpDeadlineAt}
                onChange={(e) => setRsvpDeadlineAt(e.target.value)}
                className="min-w-0 flex-1"
              />
              {rsvpDeadlineAt ? (
                <button type="button" className="shrink-0 text-sm text-primary" onClick={() => setRsvpDeadlineAt("")}>
                  Clear
                </button>
              ) : null}
            </div>
          </Field>
        </>
      )}
      <fieldset className="min-w-0 space-y-3 rounded-2xl border border-line p-3">
        <legend className="px-1 text-xs uppercase tracking-wider text-ink/50">Duration (optional)</legend>
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Hours">
            <Input name="durationHours" type="number" min={0} max={12} placeholder="—" />
          </Field>
          <Field label="Minutes">
            <Select name="durationMinutes" defaultValue="0">
              <option value="0">0</option>
              <option value="15">15</option>
              <option value="30">30</option>
              <option value="45">45</option>
            </Select>
          </Field>
        </div>
        <p className="text-xs text-ink/45">Optional. Leave blank if you only know the date for now.</p>
      </fieldset>
      <p className="text-xs text-ink/45">Costs can be posted later, after you know who showed up.</p>
      {error && <p className="text-sm text-clay">{error}</p>}
      <SubmitButton>Create session</SubmitButton>
    </form>
  );
}
