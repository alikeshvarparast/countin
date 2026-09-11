"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateWeeklyEvent } from "@/lib/actions/weekly";
import { Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export type EventEditDefaults = {
  title: string;
  location: string;
  minPlayers: number;
  maxPlayers: number | null;
  paymentMode: "postpay" | "prepaid";
  status: string;
  startDate: string;
  startTime: string;
  hasTime: boolean;
  durationHours: string;
  durationMinutes: string;
  rsvpDeadlineAt: string;
  paymentLocked?: boolean;
};

export function EditWeeklyEventForm({
  slug,
  eventId,
  defaults,
  returnTo,
}: {
  slug: string;
  eventId: string;
  defaults: EventEditDefaults;
  returnTo?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const backHref = returnTo || `/app/c/${slug}/events/${eventId}`;

  return (
    <form
      className="space-y-4"
      action={async (formData) => {
        const result = await updateWeeklyEvent(formData);
        if (result?.error) setError(result.error);
        else router.push(backHref);
      }}
    >
      <input type="hidden" name="eventId" value={eventId} />
      <Field label="Title">
        <Input name="title" required defaultValue={defaults.title} placeholder="Wednesday night 8v8" />
      </Field>
      <Field label="Pitch">
        <Input name="location" defaultValue={defaults.location} />
      </Field>
      <Field label="Minimum players to book">
        <Input name="minPlayers" type="number" min={2} defaultValue={defaults.minPlayers} />
      </Field>
      <Field label="Maximum players (waitlist after this)">
        <Input
          name="maxPlayers"
          type="number"
          min={2}
          defaultValue={defaults.maxPlayers ?? ""}
          placeholder="Optional"
        />
      </Field>
      {!defaults.paymentLocked && (
        <Field label="Payment timing">
          <Select name="paymentMode" defaultValue={defaults.paymentMode}>
            <option value="postpay">Post-paid — split after the session</option>
            <option value="prepaid">Pre-paid — request payment after booking</option>
          </Select>
        </Field>
      )}
      {defaults.status === "polling" ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-ink/55">
          Kickoff is still in a time poll. Lock a time from the event menu when you are ready.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date">
              <Input name="startDate" type="date" required defaultValue={defaults.startDate} />
            </Field>
            <Field label="Kickoff time">
              <Input name="startTime" type="time" defaultValue={defaults.hasTime ? defaults.startTime : ""} />
            </Field>
          </div>
          <p className="-mt-2 text-xs text-ink/45">Leave time blank if only the day is fixed.</p>
          <Field label="Presence deadline">
            <Input name="rsvpDeadlineAt" type="datetime-local" defaultValue={defaults.rsvpDeadlineAt} />
          </Field>
        </>
      )}
      <fieldset className="space-y-3 rounded-2xl border border-line p-3">
        <legend className="px-1 text-xs uppercase tracking-wider text-ink/50">Duration (optional)</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hours">
            <Input
              name="durationHours"
              type="number"
              min={0}
              max={12}
              defaultValue={defaults.durationHours}
              placeholder="—"
            />
          </Field>
          <Field label="Minutes">
            <Select name="durationMinutes" defaultValue={defaults.durationMinutes || "0"}>
              <option value="0">0</option>
              <option value="15">15</option>
              <option value="30">30</option>
              <option value="45">45</option>
            </Select>
          </Field>
        </div>
        <p className="text-xs text-ink/45">Optional. Leave blank if you only know the date for now.</p>
      </fieldset>
      {error && <p className="text-sm text-clay">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <SubmitButton>Save changes</SubmitButton>
        <button type="button" className="text-sm text-ink/55 hover:text-ink" onClick={() => router.push(backHref)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
