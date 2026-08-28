"use client";

import { useActionState } from "react";
import { createSupportTicket } from "@/lib/actions/support";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function SupportForm() {
  const [state, action] = useActionState(
    async (_prev: { error?: string } | undefined, formData: FormData) => createSupportTicket(formData),
    undefined,
  );

  return (
    <form action={action} className="space-y-4">
      <Field label="Type">
        <Select name="category" defaultValue="support">
          <option value="support">Support</option>
          <option value="feedback">Feedback</option>
        </Select>
      </Field>
      <Field label="Subject">
        <Input name="subject" required minLength={3} maxLength={120} placeholder="What is this about?" />
      </Field>
      <Field label="Message">
        <Textarea name="body" required minLength={10} maxLength={4000} rows={5} placeholder="What happened, or what should we change?" />
      </Field>
      {state?.error && (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger" role="alert">
          {state.error}
        </p>
      )}
      <SubmitButton>Send</SubmitButton>
    </form>
  );
}
