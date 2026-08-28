"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile, updateProfilePhoto } from "@/lib/actions/community";
import { PhotoPicker } from "@/components/photo-picker";
import { SubmitButton } from "@/components/submit-button";
import { Field, Input } from "@/components/ui";

export function ProfileForm({
  name,
  email,
  telegram,
  whatsapp,
  imageUrl,
}: {
  name: string;
  email: string;
  telegram: string;
  whatsapp: string;
  imageUrl?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-6">
      <PhotoPicker name={name} imageUrl={imageUrl} label="Change profile picture" action={updateProfilePhoto} />
      <form
        className="space-y-4"
        action={async (formData) => {
          setSaved(false);
          const result = await updateProfile(formData);
          if (result?.error) setError(result.error);
          else {
            setError(null);
            setSaved(true);
            router.refresh();
          }
        }}
      >
        <Field label="Name">
          <Input name="name" defaultValue={name} required />
        </Field>
        <Field label="Email">
          <Input value={email} disabled />
        </Field>
        <Field label="Telegram username or ID">
          <Input name="telegram" defaultValue={telegram} required />
        </Field>
        <Field label="WhatsApp (later)">
          <Input name="whatsapp" defaultValue={whatsapp} placeholder="+1…" />
        </Field>
        {error && <p className="text-sm text-clay">{error}</p>}
        {saved && <p className="text-sm text-lime">Saved.</p>}
        <SubmitButton>Save</SubmitButton>
      </form>
    </div>
  );
}
