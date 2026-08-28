import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { auth } from "@/auth";
import { SupportForm } from "@/components/support-form";
import { Badge, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { supportTickets } from "@/lib/db/schema";
import { formatWhen } from "@/lib/utils";

export default async function SupportPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const rows = db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.userId, session.user.id))
    .orderBy(desc(supportTickets.updatedAt))
    .all();

  return (
    <main className="mx-auto max-w-lg px-4 py-10">
      <h1 className="font-display text-2xl">Help</h1>
      <p className="mt-2 text-sm text-ink/50">Send feedback or ask for support. Replies show up on the ticket.</p>
      <Card className="mt-8">
        <SupportForm />
      </Card>
      <h2 className="mt-10 font-display text-lg">Your tickets</h2>
      <ul className="mt-4 space-y-2">
        {rows.length === 0 && <li className="text-sm text-ink/45">Nothing sent yet.</li>}
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={`/app/support/${row.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3"
            >
              <span>
                <span className="font-medium">{row.subject}</span>
                <span className="mt-0.5 block text-xs text-ink/45">{formatWhen(row.updatedAt)}</span>
              </span>
              <Badge tone={row.status === "closed" ? "line" : row.status === "open" ? "lime" : "clay"}>{row.status}</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
