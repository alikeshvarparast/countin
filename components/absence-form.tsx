"use client";

import { useState } from "react";
import { markContractAbsent } from "@/lib/actions/season";
import { Field, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function AbsenceForm({
  sessionId,
  members,
}: {
  sessionId: string;
  members: { id: string; name: string }[];
}) {
  const [inviteType, setInviteType] = useState("open");
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
      <Field label="Exchange request">
        <Select name="inviteType" value={inviteType} onChange={(e) => setInviteType(e.target.value)}>
          <option value="open">Ask everyone</option>
          <option value="private" disabled={members.length === 0}>
            Ask one member
          </option>
          <option value="none">Open the slot on the waitlist (no credit)</option>
        </Select>
      </Field>
      {inviteType === "private" && (
        <Field label="Member">
          <Select name="inviteUserId" required defaultValue="">
            <option value="" disabled>
              Choose who to ask
            </option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <p className="text-sm text-ink/55">
        {inviteType === "none"
          ? "Occasional players can apply on the waitlist. You are not credited."
          : "They can cover this night only, or take over your remaining contract. Chat, inbox, and Telegram are notified."}
      </p>
      {members.length === 0 && inviteType !== "none" && (
        <p className="text-sm text-clay">There are no occasional members to invite right now.</p>
      )}
      {error && <p className="text-sm text-clay">{error}</p>}
      <SubmitButton variant="ghost">Send exchange request</SubmitButton>
    </form>
  );
}
