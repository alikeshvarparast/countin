import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { replyToTicket } from "@/lib/actions/support";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { supportMessages, supportTickets } from "@/lib/db/schema";
import { APP_NAME } from "@/lib/brand";
import { formatWhen } from "@/lib/utils";

export default async function SupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const { id } = await params;
  const ticket = db.select().from(supportTickets).where(eq(supportTickets.id, id)).get();
  if (!ticket || ticket.userId !== session.user.id) notFound();
  const messages = db
    .select()
    .from(supportMessages)
    .where(eq(supportMessages.ticketId, id))
    .orderBy(desc(supportMessages.createdAt))
    .all()
    .reverse();

  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 py-10">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-secondary">{ticket.category}</p>
        <h1 className="mt-1 font-display text-2xl">{ticket.subject}</h1>
        <div className="mt-2">
          <Badge tone={ticket.status === "closed" ? "line" : ticket.status === "open" ? "lime" : "clay"}>{ticket.status}</Badge>
        </div>
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
              {message.authorKind === "ops" ? APP_NAME : "You"} · {formatWhen(message.createdAt)}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
          </li>
        ))}
      </ul>
      {ticket.status !== "closed" && (
        <Card>
          <form
            className="space-y-3"
            action={async (formData) => {
              "use server";
              await replyToTicket(formData);
            }}
          >
            <input type="hidden" name="ticketId" value={ticket.id} />
            <textarea
              name="body"
              required
              minLength={2}
              rows={4}
              placeholder="Add a reply"
              className="w-full rounded-xl border border-line bg-muted px-3 py-2.5 text-sm outline-none focus:border-primary/60"
            />
            <SubmitButton>Reply</SubmitButton>
          </form>
        </Card>
      )}
    </main>
  );
}
