"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { ActionMenu } from "@/components/action-menu";

export function PollVoters({ voters }: { voters: { name: string; vote: string }[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/60 hover:bg-muted hover:text-ink"
        aria-label="See who voted"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      <ActionMenu open={open} onClose={() => setOpen(false)} className="sm:w-64">
            <div className="px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-secondary">Votes</p>
            {voters.length === 0 ? (
              <p className="mt-2 text-sm text-ink/50">No votes yet.</p>
            ) : (
              <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto text-sm">
                {voters.map((v, i) => (
                  <li key={`${v.name}-${v.vote}-${i}`} className="flex items-start justify-between gap-2">
                    <span className="min-w-0 break-words font-medium">{v.name}</span>
                    <span className="shrink-0 text-right text-ink/55">{v.vote}</span>
                  </li>
                ))}
              </ul>
            )}
            </div>
      </ActionMenu>
    </div>
  );
}
