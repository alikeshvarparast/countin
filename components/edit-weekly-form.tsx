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
  const [startTime, setStartTime] = useState(defaults.hasTime ? defaults.startTime : "");
  const [rsvpDeadlineAt, setRsvpDeadlineAt] = useState(defaults.rsvpDeadlineAt);
  const backHref = returnTo || `/app/c/${slug}/events/${eventId}`;

  return (
    <form
      className="min-w-0 space-y-4"
      action={async (formData) => {
        // Controlled fields: ensure cleared values reach the server on iOS.
        formData.set("startTime", startTime);
        formData.set("rsvpDeadlineAt", rsvpDeadlineAt);
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
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Date">
              <Input name="startDate" type="date" required defaultValue={defaults.startDate} />
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
                  <button
                    type="button"
                    className="shrink-0 text-sm text-primary"
                    onClick={() => setStartTime("")}
                  >
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
                <button
                  type="button"
                  className="shrink-0 text-sm text-primary"
                  onClick={() => setRsvpDeadlineAt("")}
                >
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
