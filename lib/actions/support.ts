"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import { db } from "@/lib/db";
import { supportMessages, supportTickets, users } from "@/lib/db/schema";
import { createId, now } from "@/lib/id";
import { isPlatformOwner, requirePlatformOwner } from "@/lib/platform";

const CATEGORIES = new Set(["support", "feedback"]);
const STATUSES = new Set(["open", "pending", "closed"]);

export async function createSupportTicket(formData: FormData) {
  const user = await requireUser();
  const row = db.select().from(users).where(eq(users.id, user.id)).get();
  if (!row) return { error: "Account not found." };

  const category = String(formData.get("category") ?? "support").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!CATEGORIES.has(category)) return { error: "Pick a category." };
  if (subject.length < 3) return { error: "Add a short subject." };
  if (body.length < 10) return { error: "Tell us a bit more so we can help." };
  if (subject.length > 120) return { error: "Keep the subject under 120 characters." };
  if (body.length > 4000) return { error: "Keep the message under 4000 characters." };

  const t = now();
  const id = createId();
  db.insert(supportTickets)
    .values({
      id,
      userId: row.id,
      name: row.name,
      email: row.email,
      category,
      subject,
      body,
      status: "open",
      createdAt: t,
      updatedAt: t,
    })
    .run();

  revalidatePath("/app/support");
  revalidatePath("/ops/tickets");
  revalidatePath("/ops");
  redirect(`/app/support/${id}`);
}

export async function replyToTicket(formData: FormData) {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 2) return { error: "Write a reply." };
  if (body.length > 4000) return { error: "Keep the reply under 4000 characters." };

  const ticket = db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).get();
  if (!ticket) return { error: "Ticket not found." };

  const account = db.select().from(users).where(eq(users.id, user.id)).get();
  const ops = account ? isPlatformOwner({ id: account.id, email: account.email }) : false;
  const isOwner = ticket.userId === user.id;
  if (!ops && !isOwner) return { error: "Ticket not found." };
  if (ticket.status === "closed" && !ops) return { error: "This ticket is closed." };

  const t = now();
  db.insert(supportMessages)
    .values({
      id: createId(),
      ticketId,
      authorId: user.id,
      authorKind: ops ? "ops" : "user",
      body,
      createdAt: t,
    })
    .run();
  db.update(supportTickets)
    .set({ status: ops ? "pending" : "open", updatedAt: t })
    .where(eq(supportTickets.id, ticketId))
    .run();

  revalidatePath("/app/support");
  revalidatePath(`/app/support/${ticketId}`);
  revalidatePath("/ops/tickets");
  revalidatePath(`/ops/tickets/${ticketId}`);
  return { ok: true };
}

export async function setTicketStatus(formData: FormData) {
  await requirePlatformOwner();
  const ticketId = String(formData.get("ticketId") ?? "");
  const status = String(formData.get("status") ?? "").trim();
  if (!STATUSES.has(status)) return { error: "Pick a valid status." };
  const ticket = db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).get();
  if (!ticket) return { error: "Ticket not found." };
  db.update(supportTickets)
    .set({ status, updatedAt: now() })
    .where(and(eq(supportTickets.id, ticketId)))
    .run();
  revalidatePath("/ops/tickets");
  revalidatePath(`/ops/tickets/${ticketId}`);
  revalidatePath("/ops");
  return { ok: true };
}
