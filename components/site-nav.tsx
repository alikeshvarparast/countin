"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Menu, Plus, Search, X } from "lucide-react";
import { logout } from "@/lib/actions/session";
import { Avatar } from "@/components/avatar";

function inboxHref(pathname: string) {
  const match = pathname.match(/^\/app\/c\/([^/]+)/);
  return match ? `/app/c/${match[1]}/notifications` : "/app/notifications";
}

export function SiteNav({
  loggedIn,
  name,
  imageUrl,
  unread,
}: {
  loggedIn: boolean;
  name?: string | null;
  imageUrl?: string | null;
  unread: number;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const inbox = inboxHref(pathname);

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
            <Link href="/app/support" className="text-ink/70 hover:text-ink">
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
            <Link href="/app/profile" className="flex max-w-44 items-center gap-2 text-ink/70 hover:text-ink">
              <Avatar src={imageUrl} name={name || "Profile"} size="sm" />
              <span className="truncate">{name}</span>
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
            <MobileLink href="/">Find clubs</MobileLink>
            {loggedIn ? (
              <>
                <MobileLink href="/app/communities/new">New community</MobileLink>
                <MobileLink href="/app/support">Help</MobileLink>
                <MobileLink href={inbox}>Inbox{unread ? ` (${unread})` : ""}</MobileLink>
                <MobileLink href="/app/profile">Profile</MobileLink>
                <form action={logout}>
                  <button
                    className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-ink"
                    type="submit"
                  >
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <>
                <MobileLink href="/login">Log in</MobileLink>
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

function MobileLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex min-h-11 items-center rounded-xl px-3 text-ink">
      {children}
    </Link>
  );
}
