"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { markNotificationRead } from "@/lib/actions/notifications";
import { syncAppBadge } from "@/lib/pwa-client";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function NotificationRow({
  id,
  href,
  unread,
  icon,
  children,
}: {
  id: string;
  href?: string | null;
  unread: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();

  async function markRead() {
    await markNotificationRead(id);
    void syncAppBadge();
    router.refresh();
  }

  return (
    <div className={cn("px-3 py-2.5 transition", unread ? "bg-primary/12" : "bg-card")}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
          onClick={() => {
            if (unread) void markRead();
            if (href) router.push(href);
          }}
        >
          <span className="shrink-0">{icon}</span>
          <span className="min-w-0 flex-1">{children}</span>
        </button>
        {unread && (
          <button
            type="button"
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink shadow-sm hover:bg-muted sm:flex"
            aria-label="Mark as read"
            onClick={() => void markRead()}
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>
        )}
      </div>
      {unread && (
        <button
          type="button"
          className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-line bg-card text-sm font-medium text-ink shadow-sm active:bg-muted sm:hidden"
          onClick={() => void markRead()}
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
          Mark as read
        </button>
      )}
    </div>
  );
}
