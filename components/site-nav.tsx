"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CircleHelp, LogIn, LogOut, Menu, Plus, Search, UserRound, X } from "lucide-react";
import { logout } from "@/lib/actions/session";
import { Avatar } from "@/components/avatar";

function inboxHref(pathname: string) {
  const match = pathname.match(/^\/app\/c\/([^/]+)/);
  return match ? `/app/c/${match[1]}/notifications` : "/app/notifications";
}

export type SiteNavClub = {
  slug: string;
  name: string;
  imageUrl?: string | null;
};

export function SiteNav({
  loggedIn,
  name,
  imageUrl,
  unread,
  clubs = [],
  hintedSlug = null,
}: {
  loggedIn: boolean;
  name?: string | null;
  imageUrl?: string | null;
  unread: number;
  clubs?: SiteNavClub[];
  hintedSlug?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const inbox = inboxHref(pathname);
  const pathSlug = pathname.match(/^\/app\/c\/([^/]+)/)?.[1];
  const club =
    (pathSlug && clubs.find((c) => c.slug === pathSlug)) ||
    (hintedSlug && clubs.find((c) => c.slug === hintedSlug)) ||
    clubs[0] ||
    null;

  return (
    <>
      <div className="hidden items-center gap-3 text-sm md:flex">
        <Link href="/" className="flex items-center gap-1.5 text-ink/70 hover:text-ink">
          <Search className="h-4 w-4" />
          Clubs
        </Link>
        {loggedIn ? (
          <>
            <Link
              href="/app/communities/new"
              className="flex items-center gap-1.5 text-ink/70 hover:text-ink"
            >
              <Plus className="h-4 w-4" />
              New club
            </Link>
            <Link href="/app/support" className="flex items-center gap-1.5 text-ink/70 hover:text-ink">
              <CircleHelp className="h-4 w-4" />
              Help
            </Link>
            <Link href={inbox} className="relative text-ink/70 hover:text-ink" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-ink">
                  {unread}
                </span>
              )}
            </Link>
            <Link href="/app/profile" className="text-ink/70 hover:text-ink" aria-label="Profile">
              <UserRound className="h-5 w-5" />
            </Link>
            <form action={logout}>
              <button className="flex h-11 w-11 items-center justify-center text-ink/50 hover:text-ink" type="submit" aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/login" className="text-ink/70 hover:text-ink">
              Log in
            </Link>
            <Link href="/register" className="rounded-full bg-primary px-3 py-2 font-medium text-ink">
              Register
            </Link>
          </>
        )}
      </div>
      <div className="flex items-center gap-1 md:hidden">
        {loggedIn && (
          <Link
            href={inbox}
            className="relative flex h-11 w-11 items-center justify-center rounded-full text-ink"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-ink">
                {unread}
              </span>
            )}
          </Link>
        )}
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-full text-ink"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="absolute inset-x-0 top-full z-30 border-b border-line bg-muted px-4 py-3 shadow-sm md:hidden">
          <div className="flex flex-col gap-1" onClick={() => setOpen(false)}>
            {loggedIn && club && (
              <Link
                href={`/app/c/${club.slug}/settings`}
                className="mb-1 flex items-center gap-3 rounded-3xl border border-primary/25 bg-card px-3 py-3 shadow-sm"
              >
                <Avatar src={club.imageUrl} name={club.name} size="md" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{club.name}</p>
                  <p className="text-xs text-ink/50">Club profile</p>
                </div>
              </Link>
            )}
            {loggedIn && name && (
              <Link
                href="/app/profile"
                className="mb-1 flex items-center gap-3 rounded-3xl border border-line bg-card px-3 py-3 shadow-sm"
              >
                <Avatar src={imageUrl} name={name} size="md" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{name}</p>
                  <p className="text-xs text-ink/50">Your profile</p>
                </div>
              </Link>
            )}
            {loggedIn ? (
              <>
                <MobileLink href="/" icon={Search}>
                  Find clubs
                </MobileLink>
                <MobileLink href="/app/communities/new" icon={Plus}>
                  New community
                </MobileLink>
                <MobileLink href="/app/support" icon={CircleHelp}>
                  Help
                </MobileLink>
                <form action={logout}>
                  <button
                    className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-ink"
                    type="submit"
                  >
                    <LogOut className="h-4 w-4 text-ink/55" />
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <>
                <MobileLink href="/" icon={Search}>
                  Find clubs
                </MobileLink>
                <MobileLink href="/login" icon={LogIn}>
                  Log in
                </MobileLink>
                <Link
                  href="/register"
                  className="mt-2 flex min-h-11 items-center justify-center rounded-full bg-primary px-4 font-medium text-ink"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function MobileLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: typeof Search;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-ink">
      <Icon className="h-4 w-4 text-ink/55" />
      {children}
    </Link>
  );
}
