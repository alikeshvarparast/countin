"use client";

import { markAllNotificationsRead } from "@/lib/actions/notifications";
import { SubmitButton } from "@/components/submit-button";
import { syncAppBadge } from "@/lib/pwa-client";

export function MarkAllReadButton() {
  return (
    <form
      action={async () => {
        await markAllNotificationsRead();
        await syncAppBadge();
      }}
    >
      <SubmitButton variant="ghost" size="sm" className="h-8 border-0 px-2 text-xs text-ink/55 hover:bg-muted">
        Mark all as read
      </SubmitButton>
    </form>
  );
}
