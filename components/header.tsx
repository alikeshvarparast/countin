import { and, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { auth } from "@/auth";
import { Avatar } from "@/components/avatar";
import { SiteNav } from "@/components/site-nav";
import { db } from "@/lib/db";
import { notifications, users } from "@/lib/db/schema";
import { APP_NAME } from "@/lib/brand";

export async function AppHeader() {
  const session = await auth();
  let unread = 0;
  let name = session?.user?.name ?? null;
  let imageUrl: string | null = null;
  if (session?.user?.id) {
    unread = db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, session.user.id), isNull(notifications.readAt)))
      .all().length;
    const user = db.select().from(users).where(eq(users.id, session.user.id)).get();
    if (user) {
      name = user.name;
      imageUrl = user.imageUrl;
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-muted/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="relative mx-auto flex h-14 w-full items-center gap-2 px-4 sm:h-16">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
          <span className="font-display text-xl tracking-tight text-primary">{APP_NAME}</span>
        </Link>
        {session && name && (
          <Link
            href="/app/profile"
            className="flex min-w-0 flex-1 items-center gap-2 md:hidden"
            aria-label={`Signed in as ${name}`}
          >
            <Avatar src={imageUrl} name={name} size="sm" />
            <span className="truncate text-sm font-medium text-ink">{name}</span>
          </Link>
        )}
        <div className="ml-auto flex min-w-0 items-center">
          <SiteNav loggedIn={Boolean(session)} name={name} imageUrl={imageUrl} unread={unread} />
        </div>
      </div>
    </header>
  );
}
