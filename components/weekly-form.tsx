"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createWeeklyEvent } from "@/lib/actions/weekly";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function WeeklyEventForm({ slug, defaultLocation }: { slug: string; defaultLocation: string }) {
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
      <label className="flex items-center gap-2 text-sm text-cream/80">
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
          <button
            type="button"
            className="text-sm text-lime"
            onClick={() => setOptions([...options, ""])}
          >
            Add another time
          </button>
          <Field label="Poll closes">
            <Input name="pollClosesAt" type="datetime-local" />
          </Field>
        </>
      ) : (
        <>
          <Field label="Kickoff">
            <Input name="startsAt" type="datetime-local" required={!usePoll} />
          </Field>
          <Field label="Presence deadline">
            <Input name="rsvpDeadlineAt" type="datetime-local" />
          </Field>
        </>
      )}
      {error && <p className="text-sm text-clay">{error}</p>}
      <SubmitButton>Create</SubmitButton>
    </form>
  );
}
