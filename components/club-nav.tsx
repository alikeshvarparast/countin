"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, Users, Wallet } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { useMobileKeyboardClass } from "@/components/use-mobile-keyboard";
import { cn } from "@/lib/utils";
import { CLUB_COOKIE } from "@/lib/brand";

export function ClubNav({
  slug,
  name,
  imageUrl,
  unreadChat = 0,
  ledgerActions = 0,
}: {
  slug: string;
  name: string;
  imageUrl?: string | null;
  unreadChat?: number;
  ledgerActions?: number;
}) {
  const pathname = usePathname();
  useMobileKeyboardClass();
  const base = `/app/c/${slug}`;
  const onChat = pathname.startsWith(`${base}/chat`);
  const onLedger = pathname.startsWith(`${base}/ledger`);
  const chatBadge = onChat ? 0 : unreadChat;
  const ledgerBadge = onLedger ? 0 : ledgerActions;
  const tabs = [
    { href: base, label: "Home", icon: Home, exact: true },
    { href: `${base}/chat`, label: "Chat", icon: MessageCircle, badge: chatBadge },
    { href: `${base}/members`, label: "Members", icon: Users },
    { href: `${base}/ledger`, label: "Ledger", icon: Wallet, badge: ledgerBadge },
  ];

  useEffect(() => {
    document.cookie = `${CLUB_COOKIE}=${encodeURIComponent(slug)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [slug]);

  return (
    <>
      <div className="sticky top-14 z-20 hidden border-b border-line bg-muted/95 px-1 py-3 backdrop-blur sm:top-16 lg:sticky lg:top-16 lg:flex lg:h-[calc(100dvh-4rem)] lg:w-[4.5rem] lg:shrink-0 lg:flex-col lg:items-stretch lg:self-stretch lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <Link
          href={`/app/c/${slug}/settings`}
          className="flex w-full flex-col items-center gap-1 rounded-xl border border-primary/20 bg-card px-1 py-1.5 text-center text-ink shadow-sm"
        >
          <Avatar src={imageUrl} name={name} size="xs" />
          <p className="line-clamp-3 w-full text-[9px] font-medium leading-tight">{name}</p>
        </Link>
        <div className="mt-3 flex flex-col gap-1">
          {tabs.map((tab) => (
            <NavIcon
              key={tab.href}
              {...tab}
              active={tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)}
            />
          ))}
        </div>
      </div>

      {/* Mobile: bottom tabs — hidden while the soft keyboard is open */}
      <nav className="club-mobile-nav fixed inset-x-0 bottom-0 z-20 border-t border-line bg-muted/95 pb-[env(safe-area-inset-bottom)] backdrop-blur transition-[transform,opacity] duration-200 lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {tabs.map((tab) => {
            const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "nav-tab-transition flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  active ? "nav-active-pill text-ink" : "text-ink/55",
                )}
              >
                <span className="relative">
                  <Icon className={cn("h-5 w-5", active && "text-primary")} />
                  <UnreadBadge count={tab.badge} />
                </span>
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function NavIcon({
  href,
  label,
  icon: Icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "nav-tab-transition flex h-11 w-full flex-col items-center justify-center gap-0.5 rounded-xl text-[9px] font-medium leading-tight",
        active ? "nav-active-pill" : "text-ink/60 hover:bg-card",
      )}
    >
      <span className="relative">
        <Icon className={cn("h-4 w-4", active && "text-primary")} />
        <UnreadBadge count={badge} />
      </span>
      {label}
    </Link>
  );
}

function UnreadBadge({ count }: { count?: number }) {
  if (!count || count < 1) return null;
  return (
    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-ink">
      {count > 99 ? "99+" : count}
    </span>
  );
}
