"use client";

import { useState } from "react";
import { regenerateInviteLink } from "@/lib/actions/community";
import { SubmitButton } from "@/components/submit-button";

export function InviteShare({
  url,
  canRegenerate,
  slug,
}: {
  url: string;
  canRegenerate: boolean;
  slug: string;
}) {
  const [copied, setCopied] = useState(false);
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink/60">
        Anyone with this link can register (if needed) and join the club immediately — no waitlist.
      </p>
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="Invite QR code" width={180} height={180} className="rounded-xl border border-line bg-white p-2" />
        <div className="min-w-0 flex-1 space-y-3">
          <p className="break-all rounded-xl border border-line bg-muted px-3 py-2 font-mono text-xs text-ink">{url}</p>
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm text-ink"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              } catch {
                /* clipboard may be unavailable */
              }
            }}
          >
            {copied ? "Copied" : "Copy invite link"}
          </button>
          {canRegenerate && (
            <form
              action={async (formData) => {
                await regenerateInviteLink(formData);
              }}
            >
              <input type="hidden" name="slug" value={slug} />
              <SubmitButton variant="ghost">Regenerate link</SubmitButton>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
