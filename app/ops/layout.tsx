import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { supportTickets } from "@/lib/db/schema";
import { APP_NAME } from "@/lib/brand";
import { memberOrigin } from "@/lib/hosts";
import { requirePlatformOwner } from "@/lib/platform";
import { OpsNav } from "@/components/ops-nav";

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const owner = await requirePlatformOwner();
  const openTickets =
    db
      .select({ n: count() })
      .from(supportTickets)
      .where(eq(supportTickets.status, "open"))
      .get()?.n ?? 0;

  return (
    <div className="flex min-h-dvh flex-col bg-muted">
      <header className="sticky top-0 z-30 border-b border-line bg-ink text-card">
        <div className="flex h-14 items-center gap-3 px-4 sm:h-16 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
            <span className="font-display text-lg tracking-tight">{APP_NAME} Ops</span>
          </Link>
          <p className="hidden text-xs text-card/50 sm:block">Operator console</p>
          <a href={memberOrigin()} className="ml-auto text-sm text-card/70 hover:text-card">
            {APP_NAME}
          </a>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <OpsNav name={owner.name} openTickets={openTickets} />
        <div className="min-w-0 flex-1 px-4 py-6 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
