"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function CommunityUid({ uid, className }: { uid: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-xs font-medium text-ink",
        className,
      )}
      title="Copy club UID"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(uid);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard may be unavailable */
        }
      }}
    >
      <span className="uppercase tracking-[0.18em] opacity-60">UID</span>
      <span className="font-mono tracking-widest">{uid}</span>
      <span className="opacity-80">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
