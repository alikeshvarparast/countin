"use client";

import { useState } from "react";
import { CommunitySettingsForm } from "@/components/community-forms";
import { deleteCommunity } from "@/lib/actions/community";
import { SubmitButton } from "@/components/submit-button";
import { Card } from "@/components/ui";
import { useRouter } from "next/navigation";

export function SettingsEditor({
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
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const router = useRouter();

  if (editing) {
    return (
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg">Edit community</h2>
          <button type="button" className="text-sm text-ink/50" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
        <CommunitySettingsForm
          slug={slug}
          name={name}
          description={description}
          location={location}
          timezone={timezone}
          currency={currency}
          imageUrl={imageUrl}
          isPublic={isPublic}
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm text-ink"
        onClick={() => setEditing(true)}
      >
        Edit
      </button>
      {confirmDelete ? (
        <form
          action={async (formData) => {
            const result = await deleteCommunity(formData);
            if (result?.ok) router.push("/");
          }}
        >
          <input type="hidden" name="slug" value={slug} />
          <SubmitButton variant="danger">Delete community forever</SubmitButton>
        </form>
      ) : (
        <button
          type="button"
          className="inline-flex h-10 items-center rounded-full border border-line px-4 text-sm text-ink"
          onClick={() => setConfirmDelete(true)}
        >
          Delete
        </button>
      )}
    </div>
  );
}
