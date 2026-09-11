"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { updateProfile, updateProfilePhoto } from "@/lib/actions/community";
import { ActionMenu } from "@/components/action-menu";
import { Avatar } from "@/components/avatar";
import { PhotoPicker } from "@/components/photo-picker";
import { SubmitButton } from "@/components/submit-button";
import { Button, Field, Input, Textarea } from "@/components/ui";

export function ProfileForm({
  name,
  email,
  telegram,
  whatsapp,
  paymentInfo,
  imageUrl,
}: {
  name: string;
  email: string;
  telegram: string;
  whatsapp: string;
  paymentInfo: string;
  imageUrl?: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function closeEdit() {
    setEditing(false);
    setError(null);
    setSaved(false);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        {editing ? (
          <h2 className="font-display text-lg">Edit profile</h2>
        ) : (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar src={imageUrl} name={name} size="lg" />
            <div className="min-w-0">
              <p className="truncate font-display text-lg">{name}</p>
              <p className="truncate text-sm text-ink/60">{email}</p>
            </div>
          </div>
        )}
        <div className="relative shrink-0">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/60 hover:bg-muted hover:text-ink"
            aria-label="Profile actions"
            onClick={() => setMenu((v) => !v)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          <ActionMenu open={menu} onClose={() => setMenu(false)}>
            {editing ? (
              <button
                type="button"
                className="block w-full px-3 py-2.5 text-left hover:bg-muted"
                onClick={() => {
                  setMenu(false);
                  closeEdit();
                }}
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                className="block w-full px-3 py-2.5 text-left hover:bg-muted"
                onClick={() => {
                  setMenu(false);
                  setEditing(true);
                }}
              >
                Edit
              </button>
            )}
          </ActionMenu>
        </div>
      </div>

      {editing ? (
        <div className="mt-5 space-y-6">
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
                setEditing(false);
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
            <Field label="Payment details">
              <Textarea
                name="paymentInfo"
                rows={3}
                defaultValue={paymentInfo}
                placeholder="E-transfer to you@example.com"
              />
            </Field>
            {error && <p className="text-sm text-clay">{error}</p>}
            {saved && <p className="text-sm text-lime">Saved.</p>}
            <div className="flex flex-wrap gap-2">
              <SubmitButton>Save</SubmitButton>
              <Button type="button" variant="ghost" onClick={closeEdit}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <dl className="mt-5 space-y-3 text-sm">
          <InfoRow label="Telegram" value={telegram ? `@${telegram.replace(/^@/, "")}` : null} />
          <InfoRow label="WhatsApp" value={whatsapp || null} />
          <InfoRow label="Payment details" value={paymentInfo || null} />
        </dl>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-secondary">{label}</dt>
      <dd className={value ? "mt-0.5 text-ink" : "mt-0.5 text-ink/40"}>{value || "Not set"}</dd>
    </div>
  );
}
