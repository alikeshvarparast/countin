import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin } from "@/lib/access";
import { addContract } from "@/lib/actions/season";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Field, Input } from "@/components/ui";
import { db } from "@/lib/db";
import { contracts, seasonSessions, seasons, users } from "@/lib/db/schema";
import { formatMoney, formatWhen, WEEKDAY_LABELS } from "@/lib/utils";

export default async function SeasonDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const community = getCommunityBySlug(slug);
  if (!community) notFound();
  const season = db.select().from(seasons).where(eq(seasons.id, id)).get();
  if (!season || season.communityId !== community.id) notFound();
  const session = await auth();
  const admin = session?.user?.id ? isAdmin(community.id, session.user.id) : false;
  const days = (JSON.parse(season.weekdays) as number[]).map((d) => WEEKDAY_LABELS[d]).join(", ");
  const contractRows = db
    .select({ contract: contracts, user: users })
    .from(contracts)
    .innerJoin(users, eq(users.id, contracts.userId))
    .where(eq(contracts.seasonId, season.id))
    .all();
  const sessions = db
    .select()
    .from(seasonSessions)
    .where(eq(seasonSessions.seasonId, season.id))
    .all()
    .sort((a, b) => a.startsAt - b.startsAt);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-3xl">{season.name}</h2>
        <p className="mt-1 text-cream/60">
          {days} at {season.timeLocal} · {season.location || community.location || "Pitch TBD"}
        </p>
        <p className="mt-1 text-sm text-cream/50">
          Regular {formatMoney(season.regularPriceCents, community.currency)} · occasional{" "}
          {formatMoney(Math.round(season.regularPriceCents * 1.5), community.currency)}
        </p>
      </div>

      {admin && (
        <Card>
          <h3 className="font-display text-xl text-lime">Add contract player</h3>
          <form
            action={async (formData) => {
              "use server";
              await addContract(formData);
            }}
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <input type="hidden" name="seasonId" value={season.id} />
            <div className="flex-1">
              <Field label="Member email">
                <Input name="email" type="email" required />
              </Field>
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" name="prepaid" defaultChecked /> Prepaid all sessions
            </label>
            <SubmitButton>Add</SubmitButton>
          </form>
        </Card>
      )}

      <Card>
        <h3 className="font-display text-xl text-lime">Contracts</h3>
        <ul className="mt-3 space-y-2">
          {contractRows.length === 0 && <li className="text-cream/50">None yet.</li>}
          {contractRows.map(({ contract, user }) => (
            <li key={contract.id} className="flex items-center justify-between">
              <span>{user.name}</span>
              {contract.prepaid && <Badge tone="lime">prepaid</Badge>}
            </li>
          ))}
        </ul>
      </Card>

      <section>
        <h3 className="font-display text-xl text-lime">Sessions</h3>
        <ul className="mt-3 space-y-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link href={`/app/c/${slug}/sessions/${s.id}`} className="flex items-center justify-between rounded-xl border border-line px-4 py-3 hover:border-lime/40">
                <span>{formatWhen(s.startsAt, community.timezone)}</span>
                <Badge>{s.status}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
