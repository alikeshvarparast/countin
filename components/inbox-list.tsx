import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import { SubmitButton } from "@/components/submit-button";
import { Card } from "@/components/ui";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { formatWhen } from "@/lib/utils";
import Link from "next/link";

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

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl">Inbox</h1>
        <form
          action={async () => {
            "use server";
            await markAllNotificationsRead();
          }}
        >
          <SubmitButton variant="ghost">Mark all read</SubmitButton>
        </form>
      </div>
      <p className="mt-2 text-sm text-ink/50">Same alerts go to Telegram once your bot chat is linked.</p>
      <div className="mt-8 space-y-3">
        {rows.length === 0 && <Card>No notifications yet.</Card>}
        {rows.map((n) => (
          <Card key={n.id} className={n.readAt ? "opacity-60" : ""}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-primary">{n.type.replaceAll("_", " ")}</p>
                <h2 className="mt-1 font-medium">{n.title}</h2>
                <p className="mt-1 text-sm text-ink/70">{n.body}</p>
                <p className="mt-2 text-xs text-ink/40">{formatWhen(n.createdAt)}</p>
                {n.href && (
                  <Link href={n.href} className="mt-2 inline-block text-sm text-primary">
                    Open →
                  </Link>
                )}
              </div>
              {!n.readAt && (
                <form
                  action={async () => {
                    "use server";
                    await markNotificationRead(n.id);
                  }}
                >
                  <SubmitButton variant="ghost">Read</SubmitButton>
                </form>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
