import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin } from "@/lib/access";
import { addContract, agreeToSeason, lockSeasonIfDue } from "@/lib/actions/season";
import { SubmitButton } from "@/components/submit-button";
import { SeasonRatesForm } from "@/components/season-rates-form";
import { Badge, Card, Field, Input } from "@/components/ui";
import { WaitlistPanel } from "@/components/waitlist-panel";
import { db } from "@/lib/db";
import { contracts, seasonSessions, seasonSignups, seasons, sessionSlots, users } from "@/lib/db/schema";
import { formatDuration, formatEventWhen, formatMoney, formatWhen, WEEKDAY_LABELS } from "@/lib/utils";

export default async function SeasonDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const community = getCommunityBySlug(slug);
  if (!community) notFound();
  const season = (await lockSeasonIfDue(id)) ?? db.select().from(seasons).where(eq(seasons.id, id)).get();
  if (!season || season.communityId !== community.id) notFound();
  const session = await auth();
  const userId = session?.user?.id;
  const admin = userId ? isAdmin(community.id, userId) : false;
  const days = (JSON.parse(season.weekdays) as number[]).map((d) => WEEKDAY_LABELS[d]).join(", ");
  const contractRows = db
    .select({ contract: contracts, user: users })
    .from(contracts)
    .innerJoin(users, eq(users.id, contracts.userId))
    .where(eq(contracts.seasonId, season.id))
    .all();
  const signupRows = db
    .select({ signup: seasonSignups, user: users })
    .from(seasonSignups)
    .innerJoin(users, eq(users.id, seasonSignups.userId))
    .where(eq(seasonSignups.seasonId, season.id))
    .all();
  const mySignup = userId ? signupRows.some((r) => r.signup.userId === userId) : false;
  const myContract = userId ? contractRows.some((r) => r.contract.userId === userId) : false;
  const sessions = db
    .select()
    .from(seasonSessions)
    .where(eq(seasonSessions.seasonId, season.id))
    .all()
    .sort((a, b) => a.startsAt - b.startsAt);
  const waitlistRows = db
    .select({ slot: sessionSlots, user: users, session: seasonSessions })
    .from(sessionSlots)
    .innerJoin(users, eq(users.id, sessionSlots.userId))
    .innerJoin(seasonSessions, eq(seasonSessions.id, sessionSlots.sessionId))
    .where(eq(seasonSessions.seasonId, season.id))
    .all();
  const pendingWaitlist = waitlistRows
    .filter((r) => r.slot.status === "occasional_pending")
    .sort((a, b) => a.slot.createdAt - b.slot.createdAt);
  const waitlistHistory = waitlistRows
    .filter((r) => r.slot.status === "occasional_approved" || r.slot.status === "occasional_rejected")
    .sort((a, b) => a.slot.createdAt - b.slot.createdAt);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl">{season.name}</h2>
        <p className="mt-1 text-sm text-ink/60">
          {days} at {season.timeLocal}
          {season.durationMinutes ? ` · ${formatDuration(season.durationMinutes)}` : ""}
          {" · "}
          {season.location || community.location || "Pitch TBD"}
        </p>
        <p className="mt-1 text-sm text-cream/50">
          {season.regularPriceCents > 0
            ? `Contract ${formatMoney(season.regularPriceCents, community.currency)}${
                season.occasionalPriceCents
                  ? ` · occasional ${formatMoney(season.occasionalPriceCents, community.currency)}`
                  : " · occasional rate later"
              }`
            : "Session rates not set yet"}
        </p>
      </div>

      {season.status === "signup" && (
        <Card>
          <h3 className="font-display text-lg">Contract agreement</h3>
          <p className="mt-1 text-sm text-ink/60">
            Agree by {formatWhen(season.signupClosesAt, community.timezone)} to be a fixed long-term player. After that,
            everyone else is occasional.
          </p>
          {!mySignup && !myContract && (
            <form
              className="mt-4"
              action={async () => {
                "use server";
                await agreeToSeason(season.id);
              }}
            >
              <SubmitButton>I&apos;m in for the contract</SubmitButton>
            </form>
          )}
          {(mySignup || myContract) && <p className="mt-3 text-sm">You&apos;re on the agreement list.</p>}
          <ul className="mt-3 space-y-1 text-sm">
            {signupRows.map(({ user }) => (
              <li key={user.id}>{user.name}</li>
            ))}
          </ul>
        </Card>
      )}

      {admin && (
        <Card>
          <h3 className="font-display text-lg">Session rates</h3>
          <p className="mt-1 text-sm text-ink/60">
            Set these when you know what a contract night costs, and what an occasional player pays.
          </p>
          <SeasonRatesForm
            seasonId={season.id}
            currency={community.currency}
            regularPriceCents={season.regularPriceCents}
            occasionalPriceCents={season.occasionalPriceCents}
          />
        </Card>
      )}

      {admin && (
        <Card>
          <h3 className="font-display text-lg">Add contract player</h3>
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
        <h3 className="font-display text-lg">Contracts</h3>
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

      {admin && (
        <WaitlistPanel
          pending={pendingWaitlist.map(({ slot, user, session: s }) => ({
            slotId: slot.id,
            name: user.name,
            askedAt: slot.createdAt,
            status: slot.status,
            sessionLabel: formatWhen(s.startsAt, community.timezone),
          }))}
          history={waitlistHistory.map(({ slot, user, session: s }) => ({
            slotId: slot.id,
            name: user.name,
            askedAt: slot.createdAt,
            status: slot.status,
            sessionLabel: formatWhen(s.startsAt, community.timezone),
          }))}
          timezone={community.timezone}
          canDecide
          rateMissing={!season.occasionalPriceCents}
        />
      )}

      <section>
        <h3 className="font-display text-lg">Sessions</h3>
        <ul className="mt-3 space-y-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link href={`/app/c/${slug}/sessions/${s.id}`} className="flex items-center justify-between rounded-xl border border-line px-4 py-3 hover:border-lime/40">
                <span>{formatEventWhen(s.startsAt, community.timezone, true, season.durationMinutes)}</span>
                <Badge>{s.status}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
