"use client";

import { useState } from "react";
import { addEventGuest } from "@/lib/actions/weekly";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function GuestForm({ eventId, sessionId }: { eventId?: string; sessionId?: string }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
      action={async (formData) => {
        const result = await addEventGuest(formData);
        setError(result?.error ?? null);
      }}
    >
      {eventId && <input type="hidden" name="eventId" value={eventId} />}
      {sessionId && <input type="hidden" name="sessionId" value={sessionId} />}
      <div className="flex-1">
        <Field label="Add a guest">
          <Input name="label" required placeholder="Ali's friend" />
        </Field>
        <p className="mt-1 text-xs text-ink/45">They go on the waitlist until an admin approves them.</p>
      </div>
      <SubmitButton>Add guest</SubmitButton>
      {error && <p className="text-sm text-clay sm:pb-2">{error}</p>}
    </form>
  );
}
