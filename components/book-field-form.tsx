"use client";

import { useRouter } from "next/navigation";
import { confirmFieldBooked } from "@/lib/actions/weekly";
import { SubmitButton } from "@/components/submit-button";

export function BookFieldForm({
  eventId,
  slug,
  returnTo,
}: {
  eventId: string;
  slug: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const backHref = returnTo || `/app/c/${slug}/events/${eventId}`;
  return (
    <form
      className="space-y-3"
      action={async () => {
        const result = await confirmFieldBooked(eventId);
        if (result && "error" in result && result.error) return;
        router.push(backHref);
        router.refresh();
      }}
    >
      <p className="text-sm text-ink/55">Members will be notified that the field is booked.</p>
      <div className="flex flex-wrap gap-3">
        <SubmitButton>Confirm booked</SubmitButton>
        <button type="button" className="text-sm text-ink/55 hover:text-ink" onClick={() => router.push(backHref)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
