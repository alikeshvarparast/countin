import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { auth } from "@/auth";
import { listMemberClubs } from "@/lib/access";
import { SiteNav } from "@/components/site-nav";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { APP_NAME, CLUB_COOKIE, LEGACY_CLUB_COOKIE } from "@/lib/brand";
import { countInboxUnread } from "@/lib/unread";

export async function AppHeader() {
  const session = await auth();
  let unread = 0;
  let name = session?.user?.name ?? null;
  let imageUrl: string | null = null;
  let clubs: { slug: string; name: string; imageUrl?: string | null }[] = [];
  let hintedSlug: string | null = null;

  if (session?.user?.id) {
    unread = countInboxUnread(session.user.id);
    const user = db.select().from(users).where(eq(users.id, session.user.id)).get();
    if (user) {
      name = user.name;
      imageUrl = user.imageUrl;
    }
    clubs = listMemberClubs(session.user.id).map((c) => ({
      slug: c.slug,
      name: c.name,
      imageUrl: c.imageUrl,
    }));
    const jar = await cookies();
    const hintedRaw = jar.get(CLUB_COOKIE)?.value ?? jar.get(LEGACY_CLUB_COOKIE)?.value;
    hintedSlug = hintedRaw ? decodeURIComponent(hintedRaw) : null;
  }

  return (
    <header className="header-turf relative sticky top-0 z-30 border-b border-line bg-muted/75 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="relative mx-auto flex h-14 w-full items-center gap-2 px-4 sm:h-16 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-primary/25" />
          <span className="font-display text-xl tracking-tight text-primary">{APP_NAME}</span>
        </Link>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <SiteNav
            loggedIn={Boolean(session)}
            name={name}
            imageUrl={imageUrl}
            unread={unread}
            clubs={clubs}
            hintedSlug={hintedSlug}
          />
        </div>
      </div>
    </header>
  );
}
