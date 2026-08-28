import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { replyToTicket, setTicketStatus } from "@/lib/actions/support";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { supportMessages, supportTickets } from "@/lib/db/schema";
import { requirePlatformOwner } from "@/lib/platform";
import { formatWhen } from "@/lib/utils";

export default async function OpsTicketPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformOwner();
  const { id } = await params;
  const ticket = db.select().from(supportTickets).where(eq(supportTickets.id, id)).get();
  if (!ticket) notFound();
  const messages = db
    .select()
    .from(supportMessages)
    .where(eq(supportMessages.ticketId, id))
    .orderBy(desc(supportMessages.createdAt))
    .all()
    .reverse();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-secondary">{ticket.category}</p>
          <h1 className="mt-1 font-display text-3xl">{ticket.subject}</h1>
          <p className="mt-1 text-sm text-ink/50">
            {ticket.name} · {ticket.email}
          </p>
        </div>
        <Badge tone={ticket.status === "closed" ? "line" : ticket.status === "open" ? "lime" : "clay"}>{ticket.status}</Badge>
      </div>

      <Card>
        <p className="text-xs text-ink/40">{formatWhen(ticket.createdAt)}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm">{ticket.body}</p>
      </Card>

      <ul className="space-y-3">
        {messages.map((message) => (
          <li
            key={message.id}
            className={`rounded-2xl border px-4 py-3 text-sm ${
              message.authorKind === "ops" ? "border-primary/30 bg-primary/10" : "border-line bg-card"
            }`}
          >
            <p className="text-xs text-ink/40">
              {message.authorKind === "ops" ? "Ops" : "Member"} · {formatWhen(message.createdAt)}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
          </li>
        ))}
      </ul>

      <Card>
        <form
          className="space-y-3"
          action={async (formData) => {
            "use server";
            await replyToTicket(formData);
          }}
        >
          <input type="hidden" name="ticketId" value={ticket.id} />
          <label className="block text-sm font-medium" htmlFor="ops-reply">
            Reply
          </label>
          <textarea
            id="ops-reply"
            name="body"
            required
            minLength={2}
            rows={5}
            className="w-full rounded-xl border border-line bg-muted px-3 py-2.5 text-sm outline-none focus:border-primary/60"
          />
          <SubmitButton>Send reply</SubmitButton>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {ticket.status !== "closed" && (
            <form
              action={async (formData) => {
                "use server";
                await setTicketStatus(formData);
              }}
            >
              <input type="hidden" name="ticketId" value={ticket.id} />
              <input type="hidden" name="status" value="closed" />
              <SubmitButton variant="ghost">Close ticket</SubmitButton>
            </form>
          )}
          {ticket.status === "closed" && (
            <form
              action={async (formData) => {
                "use server";
                await setTicketStatus(formData);
              }}
            >
              <input type="hidden" name="ticketId" value={ticket.id} />
              <input type="hidden" name="status" value="open" />
              <SubmitButton variant="ghost">Reopen</SubmitButton>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}
