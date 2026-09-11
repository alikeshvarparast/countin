import { desc, eq } from "drizzle-orm";
import {
  Ban,
  Bell,
  CalendarDays,
  Clock,
  KeyRound,
  Mail,
  UserPlus,
  Users,
  Vote,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/auth";
import { Avatar } from "@/components/avatar";
import { MarkAllReadButton } from "@/components/mark-all-read-button";
import { NotificationRow } from "@/components/notification-row";
import { db } from "@/lib/db";
import { communities, notifications } from "@/lib/db/schema";
import { cn, formatRelative } from "@/lib/utils";

function iconForType(type: string): LucideIcon {
  if (type.includes("poll")) return Vote;
  if (type.includes("cancel")) return Ban;
  if (type.includes("guest") || type.includes("join")) return UserPlus;
  if (type.includes("membership")) return Users;
  if (type.includes("cost") || type.includes("payment") || type.includes("ledger")) return Wallet;
  if (type.includes("waitlist") || type.includes("deadline") || type.includes("rsvp") || type.includes("remind")) {
    return Clock;
  }
  if (type.includes("invite") || type.includes("invitation")) return Mail;
  if (type.includes("password")) return KeyRound;
  if (
    type.includes("event") ||
    type.includes("season") ||
    type.includes("session") ||
    type.includes("field") ||
    type.includes("contract")
  ) {
    return CalendarDays;
  }
  return Bell;
}

export async function InboxList() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const rows = db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, session.user.id))
    .orderBy(desc(notifications.createdAt))
    .all()
    .slice(0, 80);
  const clubs = db.select().from(communities).all();
  const clubOf = (id: string | null) => clubs.find((c) => c.id === id);
  const unreadCount = rows.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-xl">Notifications</h1>
        {unreadCount > 0 && <MarkAllReadButton />}
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-card">
        {rows.length === 0 && <p className="px-4 py-6 text-sm text-ink/45">No notifications yet.</p>}
        <ul className="divide-y divide-line">
          {rows.map((n) => {
            const club = n.communityId ? clubOf(n.communityId) : undefined;
            const Icon = iconForType(n.type);
            const unread = !n.readAt;
            return (
              <li key={n.id}>
                <NotificationRow
                  id={n.id}
                  href={n.href}
                  unread={unread}
                  icon={
                    <span className="relative mt-0.5 block">
                      {club ? (
                        <Avatar src={club.imageUrl} name={club.name} size="sm" />
                      ) : (
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-pitch-3 text-ink">
                          <Icon className="h-4 w-4" />
                        </span>
                      )}
                      {club && (
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-card ring-2 ring-card">
                          <Icon className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </span>
                  }
                >
                  <span className={cn("block text-sm leading-snug text-ink", unread ? "font-semibold" : "font-medium")}>
                    {n.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs leading-snug text-ink/55">{n.body}</span>
                  <span className="mt-0.5 block text-[11px] text-ink/40">
                    {formatRelative(n.createdAt)}
                    {club ? ` · ${club.name}` : ""}
                  </span>
                </NotificationRow>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
