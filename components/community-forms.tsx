"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCommunity, updateCommunitySettings, addMemberByEmail } from "@/lib/actions/community";
import { CURRENCIES, TIMEZONES } from "@/lib/utils";
import { Avatar } from "@/components/avatar";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function CreateCommunityForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      encType="multipart/form-data"
      action={async (formData) => {
        const result = await createCommunity(formData);
        if (result?.error) setError(result.error);
        else if (result?.slug) router.push(`/app/c/${result.slug}`);
      }}
    >
      <Field label="Community name">
        <Input name="name" required placeholder="Tuesday Night FC" />
      </Field>
      <Field label="Club crest">
        <Input name="avatar" type="file" accept="image/jpeg,image/png,image/webp" />
        <p className="mt-1 text-xs text-ink/50">JPG, PNG, or WebP · under 2MB</p>
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
      <label className="flex items-start gap-3 rounded-xl border border-line bg-muted px-3 py-3 text-sm text-ink">
        <input type="checkbox" name="isPublic" className="mt-0.5" />
        <span>
          <span className="font-medium">Show in the public directory</span>
          <span className="mt-0.5 block text-xs text-ink/55">
            Private clubs can still be found by UID, but people cannot request to join. Share the invite link instead.
          </span>
        </span>
      </label>
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
  imageUrl,
  isPublic,
}: {
  slug: string;
  name: string;
  description: string;
  location: string;
  timezone: string;
  currency: string;
  imageUrl?: string | null;
  isPublic: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      encType="multipart/form-data"
      action={async (formData) => {
        setSaved(false);
        const result = await updateCommunitySettings(formData);
        if (result?.error) setError(result.error);
        else {
          setError(null);
          setSaved(true);
          router.refresh();
        }
      }}
    >
      <input type="hidden" name="slug" value={slug} />
      <div className="flex items-center gap-4">
        <Avatar src={preview || imageUrl} name={name} size="lg" />
        <Field label="Club crest">
          <Input
            name="avatar"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
          />
          <p className="mt-1 text-xs text-ink/50">JPG, PNG, or WebP · under 2MB</p>
        </Field>
      </div>
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
      <label className="flex items-start gap-3 rounded-xl border border-line bg-muted px-3 py-3 text-sm text-ink">
        <input type="checkbox" name="isPublic" defaultChecked={isPublic} className="mt-0.5" />
        <span>
          <span className="font-medium">Show in the public directory</span>
          <span className="mt-0.5 block text-xs text-ink/55">
            Private clubs can still be found by UID, but people cannot request to join. Share the invite link instead.
          </span>
        </span>
      </label>
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
