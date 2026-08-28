"use client";

import { useState } from "react";
import { AddMemberForm } from "@/components/community-forms";

export function AddMemberButton({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        className="inline-flex h-10 items-center rounded-full bg-primary px-4 text-sm text-ink"
        onClick={() => setOpen(true)}
      >
        Add member
      </button>
    );
  }
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-medium">Add by email</p>
        <button type="button" className="text-sm text-ink/50" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      <AddMemberForm slug={slug} />
    </div>
  );
}
