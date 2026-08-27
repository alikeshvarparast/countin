import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { auth } from "@/auth";
import { logout } from "@/lib/actions/session";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export async function AppHeader() {
  const session = await auth();
  let unread = 0;
  if (session?.user?.id) {
    unread = db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, session.user.id), isNull(notifications.readAt)))
      .all().length;
  }

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-pitch/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href={session ? "/app" : "/"} className="font-display text-xl tracking-tight text-lime">
          Pitchside
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/communities" className="text-cream/70 hover:text-cream">
            Directory
          </Link>
          {session ? (
            <>
              <Link href="/app" className="text-cream/70 hover:text-cream">
                Home
              </Link>
              <Link href="/app/notifications" className="relative text-cream/70 hover:text-cream">
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-lime px-1 text-[10px] font-bold text-pitch">
                    {unread}
                  </span>
                )}
              </Link>
              <Link href="/app/profile" className="text-cream/70 hover:text-cream">
                {session.user?.name}
              </Link>
              <form action={logout}>
                <button className="text-cream/50 hover:text-cream" type="submit" aria-label="Sign out">
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-cream/70 hover:text-cream">
                Log in
              </Link>
              <Link href="/register" className="rounded-full bg-lime px-3 py-1.5 font-medium text-pitch">
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
