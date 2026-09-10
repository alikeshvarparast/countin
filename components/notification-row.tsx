"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { markNotificationRead } from "@/lib/actions/notifications";
import { cn } from "@/lib/utils";

export function NotificationRow({
  id,
  href,
  unread,
  children,
}: {
  id: string;
  href?: string | null;
  unread: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-start gap-3 px-3 py-2.5 text-left transition",
        unread ? "bg-primary/12" : "bg-card hover:bg-muted/80",
      )}
      onClick={() => {
        if (unread) void markNotificationRead(id);
        if (href) router.push(href);
      }}
    >
      {children}
    </button>
  );
}
