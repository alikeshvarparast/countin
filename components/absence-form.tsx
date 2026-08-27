"use client";

import { useState } from "react";
import { markContractAbsent } from "@/lib/actions/season";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function AbsenceForm({ sessionId }: { sessionId: string }) {
  const [inviteType, setInviteType] = useState("none");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      action={async (formData) => {
        const result = await markContractAbsent(formData);
        setError(result?.error ?? null);
      }}
    >
      <input type="hidden" name="sessionId" value={sessionId} />
      <Field label="If you are out">
        <select
          name="inviteType"
          value={inviteType}
          onChange={(e) => setInviteType(e.target.value)}
          className="w-full rounded-xl border border-line bg-pitch-2 px-3 py-2.5"
        >
          <option value="none">Open the slot (occasionals pay 50% more, you get no credit)</option>
          <option value="open">Open invitation at regular rate (payment to you)</option>
          <option value="private">Private invitation at regular rate (payment to you)</option>
        </select>
      </Field>
      {inviteType === "private" && (
        <Field label="Invitee email">
          <Input name="inviteEmail" type="email" required />
        </Field>
      )}
      {error && <p className="text-sm text-clay">{error}</p>}
      <SubmitButton variant="ghost">Mark myself absent</SubmitButton>
    </form>
  );
}
