"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LayoutDashboard, LifeBuoy, LogOut, Users } from "lucide-react";
import { logout } from "@/lib/actions/session";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/ops", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/ops/communities", label: "Clubs", icon: Users },
  { href: "/ops/activity", label: "Activity", icon: Activity },
  { href: "/ops/tickets", label: "Tickets", icon: LifeBuoy },
];

export function OpsNav({ name, openTickets }: { name: string; openTickets: number }) {
  const pathname = usePathname();

  return (
    <aside className="lg:flex lg:h-[calc(100dvh-4rem)] lg:w-56 lg:shrink-0 lg:flex-col lg:border-r lg:border-line lg:bg-card">
      <nav className="flex gap-1 overflow-x-auto border-b border-line px-2 py-2 lg:flex-col lg:overflow-visible lg:border-b-0 lg:px-3 lg:py-4">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          const badge = tab.href === "/ops/tickets" ? openTickets : 0;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium",
                active ? "bg-pitch-3 text-ink" : "text-ink/60 hover:bg-muted hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {badge > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-ink">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto hidden items-center justify-between gap-2 border-t border-line px-3 py-3 lg:flex">
        <p className="min-w-0 truncate text-xs text-ink/50">{name}</p>
        <form action={logout}>
          <button type="submit" className="inline-flex h-9 w-9 items-center justify-center text-ink/45 hover:text-ink" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </aside>
  );
}
