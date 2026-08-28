"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClubPoll } from "@/lib/actions/club";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function ClubPollForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [options, setOptions] = useState(["", ""]);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      action={async (formData) => {
        const result = await createClubPoll(formData);
        if (result?.error) setError(result.error);
        else router.push(`/app/c/${slug}`);
      }}
    >
      <input type="hidden" name="slug" value={slug} />
      <Field label="Question">
        <Input name="question" required placeholder="Who can play Thursday?" />
      </Field>
      {options.map((opt, i) => (
        <Field key={i} label={`Option ${i + 1}`}>
          <Input
            name="option"
            required
            value={opt}
            placeholder={i === 0 ? "Yes" : i === 1 ? "No" : "Another option"}
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
        className="text-sm text-primary"
        onClick={() => setOptions([...options, ""])}
      >
        Add option
      </button>
      <Field label="Closes (optional)">
        <Input name="closesAt" type="datetime-local" />
      </Field>
      {error && <p className="text-sm text-clay">{error}</p>}
      <SubmitButton>Post poll</SubmitButton>
    </form>
  );
}
