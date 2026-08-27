"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCommunity, updateCommunitySettings, addMemberByEmail } from "@/lib/actions/community";
import { CURRENCIES, TIMEZONES } from "@/lib/utils";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function CreateCommunityForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      action={async (formData) => {
        const result = await createCommunity(formData);
        if (result?.error) setError(result.error);
        else if (result?.slug) router.push(`/app/c/${result.slug}`);
      }}
    >
      <Field label="Community name">
        <Input name="name" required placeholder="Tuesday Night FC" />
      </Field>
      <Field label="Usual pitch / area">
        <Input name="location" placeholder="Riverside turf" />
      </Field>
      <Field label="About">
        <Textarea name="description" rows={3} placeholder="Who plays, how you run sessions…" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Timezone">
          <Select name="timezone" defaultValue="America/Toronto">
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Currency">
          <Select name="currency" defaultValue="CAD">
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {error && <p className="text-sm text-clay">{error}</p>}
      <SubmitButton>Create community</SubmitButton>
    </form>
  );
}

export function CommunitySettingsForm({
  slug,
  name,
  description,
  location,
  timezone,
  currency,
}: {
  slug: string;
  name: string;
  description: string;
  location: string;
  timezone: string;
  currency: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="space-y-4"
      action={async (formData) => {
        setSaved(false);
        const result = await updateCommunitySettings(formData);
        if (result?.error) setError(result.error);
        else {
          setError(null);
          setSaved(true);
        }
      }}
    >
      <input type="hidden" name="slug" value={slug} />
      <Field label="Name">
        <Input name="name" defaultValue={name} required />
      </Field>
      <Field label="Pitch / area">
        <Input name="location" defaultValue={location} />
      </Field>
      <Field label="About">
        <Textarea name="description" rows={3} defaultValue={description} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Timezone">
          <Select name="timezone" defaultValue={timezone}>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Currency">
          <Select name="currency" defaultValue={currency}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {error && <p className="text-sm text-clay">{error}</p>}
      {saved && <p className="text-sm text-lime">Saved.</p>}
      <SubmitButton>Save settings</SubmitButton>
    </form>
  );
}

export function AddMemberForm({ slug }: { slug: string }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      action={async (formData) => {
        const result = await addMemberByEmail(formData);
        setError(result?.error ?? null);
      }}
    >
      <input type="hidden" name="slug" value={slug} />
      <div className="flex-1">
        <Field label="Add member by email">
          <Input name="email" type="email" required placeholder="player@email.com" />
        </Field>
      </div>
      <SubmitButton>Add</SubmitButton>
      {error && <p className="text-sm text-clay sm:pb-2">{error}</p>}
    </form>
  );
}
