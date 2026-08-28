"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, Users, Wallet } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";
import { CLUB_COOKIE } from "@/lib/brand";

export function ClubNav({
  slug,
  name,
  imageUrl,
  unreadChat = 0,
}: {
  slug: string;
  name: string;
  imageUrl?: string | null;
  unreadChat?: number;
}) {
  const pathname = usePathname();
  const base = `/app/c/${slug}`;
  const onChat = pathname.startsWith(`${base}/chat`);
  const chatBadge = onChat ? 0 : unreadChat;
  const tabs = [
    { href: base, label: "Home", icon: Home, exact: true },
    { href: `${base}/chat`, label: "Chat", icon: MessageCircle, badge: chatBadge },
    { href: `${base}/members`, label: "Members", icon: Users },
    { href: `${base}/ledger`, label: "Ledger", icon: Wallet },
  ];

  useEffect(() => {
    document.cookie = `${CLUB_COOKIE}=${encodeURIComponent(slug)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [slug]);

  return (
    <>
      <div className="sticky top-14 z-20 border-b border-line bg-muted px-4 py-2 sm:top-16 lg:sticky lg:top-16 lg:flex lg:h-[calc(100dvh-4rem)] lg:w-[4.5rem] lg:shrink-0 lg:flex-col lg:items-stretch lg:self-stretch lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-1 lg:py-3">
        <div className="lg:hidden">
          <ClubMark slug={slug} name={name} imageUrl={imageUrl} compact />
        </div>
        <div className="hidden lg:block">
          <ClubMark slug={slug} name={name} imageUrl={imageUrl} />
        </div>
        <div className="mt-3 hidden flex-col gap-1 lg:flex">
          {tabs.map((tab) => (
            <NavIcon
              key={tab.href}
              {...tab}
              active={tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)}
            />
          ))}
        </div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-muted pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {tabs.map((tab) => {
            const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-ink",
                  active ? "bg-pitch-3" : "text-ink/60",
                )}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
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

function ClubMark({
  slug,
  name,
  imageUrl,
  compact,
}: {
  slug: string;
  name: string;
  imageUrl?: string | null;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <Link href={`/app/c/${slug}/settings`} className="flex min-w-0 flex-col items-center gap-1 text-ink">
        <Avatar src={imageUrl} name={name} size="xs" />
        <p className="line-clamp-2 max-w-[9rem] text-center text-[11px] font-medium leading-tight">{name}</p>
      </Link>
    );
  }

  return (
    <Link
      href={`/app/c/${slug}/settings`}
      className="flex w-full flex-col items-center gap-1 rounded-lg border border-line bg-card px-1 py-1.5 text-center text-ink"
    >
      <Avatar src={imageUrl} name={name} size="xs" />
      <p className="line-clamp-3 w-full text-[9px] font-medium leading-tight">{name}</p>
    </Link>
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
        "flex h-11 w-full flex-col items-center justify-center gap-0.5 rounded-xl text-[9px] font-medium leading-tight text-ink",
        active ? "bg-pitch-3" : "hover:bg-card",
      )}
    >
      <span className="relative">
        <Icon className="h-4 w-4" />
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
