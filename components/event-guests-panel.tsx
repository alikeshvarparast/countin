"use client";

import { useRouter } from "next/navigation";
import { removeEventGuest } from "@/lib/actions/weekly";
import { GuestForm } from "@/components/guest-form";
import { SubmitButton } from "@/components/submit-button";

export function EventGuestsPanel({
  eventId,
  canAddGuest,
  guests,
}: {
  eventId: string;
  canAddGuest: boolean;
  guests: { id: string; label: string; hostName: string; canRemove: boolean; status?: string }[];
}) {
  const router = useRouter();
  return (
    <div className="space-y-4">
      {canAddGuest && <GuestForm eventId={eventId} />}
      {guests.length === 0 ? (
        <p className="text-sm text-ink/50">No guests yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {guests.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2">
              <span>
                {g.label} <span className="text-ink/45">· {g.hostName}</span>
                {g.status === "pending" ? <span className="text-ink/45"> · pending</span> : null}
              </span>
              {g.canRemove && (
                <form
                  action={async () => {
                    await removeEventGuest(g.id);
                    router.refresh();
                  }}
                >
                  <SubmitButton variant="ghost" className="h-8 px-2 text-xs">
                    Remove
                  </SubmitButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
