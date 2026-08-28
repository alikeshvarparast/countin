import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin } from "@/lib/access";
import { settleLedgerEntry } from "@/lib/actions/weekly";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { ledgerEntries, users } from "@/lib/db/schema";
import { formatMoney, formatWhen } from "@/lib/utils";
import { LEDGER_DISCLAIMER } from "@/lib/ledger-copy";

export default async function LedgerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const community = getCommunityBySlug(slug);
  if (!community) notFound();
  const session = await auth();
  const userId = session?.user?.id;
  const admin = userId ? isAdmin(community.id, userId) : false;
  const rows = db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.communityId, community.id))
    .orderBy(desc(ledgerEntries.createdAt))
    .all();
  const people = db.select().from(users).all();
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? id;

  const mine = rows.filter((r) => r.fromUserId === userId || r.toUserId === userId);
  const visible = admin ? rows : mine;

  const owed = mine
    .filter((r) => r.status === "pending" && r.fromUserId === userId)
    .reduce((s, r) => s + r.amountCents, 0);
  const dueToMe = mine
    .filter((r) => r.status === "pending" && r.toUserId === userId)
    .reduce((s, r) => s + r.amountCents, 0);

  return (
    <div className="space-y-6">
      <Card className="border-primary/30 bg-primary/10">
        <p className="text-xs uppercase tracking-[0.2em] text-secondary">Credit tracker</p>
        <p className="mt-2 text-sm text-ink/80">{LEDGER_DISCLAIMER}</p>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="overflow-hidden">
          <p className="text-xs uppercase tracking-wider text-cream/50">You owe</p>
          <p className="mt-1 font-display text-2xl text-clay">{formatMoney(owed, community.currency)}</p>
        </Card>
        <Card className="overflow-hidden">
          <p className="text-xs uppercase tracking-wider text-cream/50">Owed to you</p>
          <p className="mt-1 font-display text-2xl text-lime">{formatMoney(dueToMe, community.currency)}</p>
        </Card>
      </div>
      <Card>
        <h2 className="font-display text-lg">Entries</h2>
        <p className="text-sm text-ink/50">
          Mark a row verified when the person who is owed confirms they received the money. Unpaid rows stay on this list until someone marks them.
        </p>
        <ul className="mt-4 space-y-3">
          {visible.length === 0 && <li className="text-cream/50">Nothing on the ledger yet.</li>}
          {visible.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <p>
                  {nameOf(row.fromUserId)} → {nameOf(row.toUserId)}{" "}
                  <strong>{formatMoney(row.amountCents, community.currency)}</strong>
                </p>
                <p className="text-xs text-cream/50">
                  {row.reason.replaceAll("_", " ")} · {formatWhen(row.createdAt, community.timezone)}
                  {row.toUserId === userId && row.status === "pending" ? " · your payment to verify" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={row.status === "settled" ? "lime" : "clay"}>{row.status}</Badge>
                {row.status === "pending" && (admin || row.toUserId === userId) && (
                  <form
                    action={async () => {
                      "use server";
                      await settleLedgerEntry(row.id);
                    }}
                  >
                    <SubmitButton variant="ghost">{row.toUserId === userId ? "Verify payment" : "Mark paid"}</SubmitButton>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
