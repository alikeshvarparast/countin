import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { supportTickets } from "@/lib/db/schema";
import { requirePlatformOwner } from "@/lib/platform";
import { Badge } from "@/components/ui";
import { formatWhen } from "@/lib/utils";

function ticketTone(status: string): "lime" | "clay" | "line" {
  if (status === "open") return "lime";
  if (status === "pending") return "clay";
  return "line";
}

export default async function OpsTicketsPage() {
  await requirePlatformOwner();
  const rows = db.select().from(supportTickets).orderBy(desc(supportTickets.updatedAt)).all().slice(0, 100);

  return (
    <div>
      <h1 className="font-display text-3xl">Tickets</h1>
      <p className="mt-1 text-sm text-ink/50">
        Feedback and support from members. Reply here — they see your answer in Help.
      </p>
      <ul className="mt-6 space-y-2">
        {rows.length === 0 && (
          <li className="rounded-2xl border border-dashed border-line bg-card px-4 py-10 text-center">
            <p className="font-display text-xl">No tickets yet</p>
            <p className="mt-1 text-sm text-ink/50">When someone sends help or feedback, it will show up here.</p>
          </li>
        )}
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={`/ops/tickets/${row.id}`}
              className="flex flex-col gap-2 rounded-2xl border border-line bg-card px-4 py-3 hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium">{row.subject}</p>
                <p className="mt-0.5 truncate text-sm text-ink/50">
                  {row.name} · {row.email} · {row.category}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Badge tone={ticketTone(row.status)}>{row.status}</Badge>
                <span className="text-xs text-ink/40">{formatWhen(row.updatedAt)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
