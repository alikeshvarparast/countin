import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin } from "@/lib/access";
import { applyOccasional, claimInvitation } from "@/lib/actions/season";
import { AbsenceForm } from "@/components/absence-form";
import { GuestForm } from "@/components/guest-form";
import { GuestWaitlist } from "@/components/guest-waitlist";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui";
import { WaitlistPanel } from "@/components/waitlist-panel";
import { db } from "@/lib/db";
import { contracts, eventGuests, invitations, seasonSessions, seasons, sessionSlots, users } from "@/lib/db/schema";
import { fieldBookedLabel, formatEventWhen, formatMoney, formatWhen } from "@/lib/utils";

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-3 border-b border-line/70 py-2 last:border-0">
      <dt className="text-xs text-ink/50">{label}</dt>
      <dd className="m-0 text-sm text-ink">{children}</dd>
    </div>
  );
}

export default async function SessionPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const community = getCommunityBySlug(slug);
  if (!community) notFound();
  const sessionRow = db.select().from(seasonSessions).where(eq(seasonSessions.id, id)).get();
  if (!sessionRow || sessionRow.communityId !== community.id) notFound();
  const season = db.select().from(seasons).where(eq(seasons.id, sessionRow.seasonId)).get();
  if (!season) notFound();
  if (season.status !== "locked") redirect(`/app/c/${slug}/seasons/${season.id}`);
  const session = await auth();
  const userId = session?.user?.id;
  const admin = userId ? isAdmin(community.id, userId) : false;
  const myContract = userId
    ? db
        .select()
        .from(contracts)
        .where(and(eq(contracts.seasonId, season.id), eq(contracts.userId, userId)))
        .get()
    : undefined;
  const slots = db
    .select({ slot: sessionSlots, user: users })
    .from(sessionSlots)
    .innerJoin(users, eq(users.id, sessionSlots.userId))
    .where(eq(sessionSlots.sessionId, sessionRow.id))
    .all();
  const invites = db.select().from(invitations).where(eq(invitations.sessionId, sessionRow.id)).all();
  const guests = db.select().from(eventGuests).where(eq(eventGuests.sessionId, sessionRow.id)).all();
  const approvedGuests = guests.filter((g) => g.status === "approved");
  const pendingGuests = guests.filter((g) => g.status === "pending");
  const guestHistory = guests.filter((g) => g.status === "rejected");
  const people = db.select({ id: users.id, name: users.name }).from(users).all();
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "Member";
  const mySlot = slots.find((s) => s.slot.userId === userId);
  const sheet = slots.filter((s) => s.slot.status !== "occasional_pending");
  const pending = slots
    .filter((s) => s.slot.status === "occasional_pending")
    .sort((a, b) => a.slot.createdAt - b.slot.createdAt);
  const history = slots
    .filter((s) => s.slot.status === "occasional_approved" || s.slot.status === "occasional_rejected")
    .sort((a, b) => a.slot.createdAt - b.slot.createdAt);
  const myWaitIndex = pending.findIndex((s) => s.slot.userId === userId);
  const claimable = invites.filter((inv) => {
    if (inv.status !== "open") return false;
    if (myContract) return false;
    if (mySlot) return false;
    if (inv.type === "private") return inv.toUserId === userId;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-primary">{season.name}</p>
          <h2 className="mt-1 font-display text-2xl">
            {formatEventWhen(sessionRow.startsAt, community.timezone, true, season.durationMinutes)}
          </h2>
          <p className="mt-1 text-sm text-ink/60">{season.location || community.location || "Pitch TBD"}</p>
        </div>
        <Badge>{sessionRow.status.replaceAll("_", " ")}</Badge>
      </div>

      <div className="rounded-2xl border border-line bg-card p-5">
        <h3 className="font-display text-lg">Details</h3>
        <dl className="mt-2">
          <DetailRow label="When">
            {formatEventWhen(sessionRow.startsAt, community.timezone, true, season.durationMinutes)}
          </DetailRow>
          <DetailRow label="Where">{season.location || community.location || "Pitch TBD"}</DetailRow>
          <DetailRow label="Field">{fieldBookedLabel(sessionRow.status)}</DetailRow>
          <DetailRow label="On the sheet">{sheet.length + approvedGuests.length}</DetailRow>
          <DetailRow label="Contract">
            {season.regularPriceCents > 0
              ? formatMoney(season.regularPriceCents, community.currency)
              : "Not set yet"}
          </DetailRow>
          <DetailRow label="Occasional">
            {season.occasionalPriceCents
              ? formatMoney(season.occasionalPriceCents, community.currency)
              : "Not set yet"}
          </DetailRow>
        </dl>
      </div>

      <div className="rounded-2xl border border-line bg-card p-5">
        <h3 className="font-display text-lg">People</h3>
        <p className="mt-1 text-sm text-ink/55">{sheet.length} on the sheet · {approvedGuests.length} guests</p>
        <div className="mt-4">
          <p className="text-xs uppercase tracking-[0.18em] text-secondary">Participants · {sheet.length}</p>
          <ul className="mt-2 space-y-2 text-sm">
            {sheet.length === 0 && <li className="text-ink/45">No one on the sheet yet.</li>}
            {sheet.map(({ slot, user }) => (
              <li key={slot.id}>
                {user.name}{" "}
                <span className="text-ink/45">
                  · {slot.kind} · {slot.status.replaceAll("_", " ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-5 border-t border-line pt-5">
          <p className="text-xs uppercase tracking-[0.18em] text-secondary">Guests · {approvedGuests.length}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {approvedGuests.length === 0 && <li className="text-ink/45">No guests on the list yet.</li>}
            {approvedGuests.map((g) => (
              <li key={g.id}>
                {g.label} <span className="text-ink/45">· guest of {nameOf(g.hostUserId)}</span>
              </li>
            ))}
          </ul>
          {mySlot && mySlot.slot.status !== "occasional_pending" && (
            <div className="mt-3">
              <GuestForm sessionId={sessionRow.id} />
            </div>
          )}
        </div>
        {(admin || pendingGuests.length > 0 || guestHistory.length > 0) && (
          <GuestWaitlist
            pending={pendingGuests.map((g) => ({
              id: g.id,
              label: g.label,
              hostName: nameOf(g.hostUserId),
              askedAt: g.createdAt,
              status: g.status,
            }))}
            history={guestHistory.map((g) => ({
              id: g.id,
              label: g.label,
              hostName: nameOf(g.hostUserId),
              askedAt: g.createdAt,
              status: g.status,
            }))}
            timezone={community.timezone}
            canDecide={admin}
          />
        )}
        {(admin || pending.length > 0 || history.length > 0) && (
          <WaitlistPanel
            embedded
            pending={pending.map(({ slot, user }) => ({
              slotId: slot.id,
              name: user.name,
              askedAt: slot.createdAt,
              status: slot.status,
            }))}
            history={history.map(({ slot, user }) => ({
              slotId: slot.id,
              name: user.name,
              askedAt: slot.createdAt,
              status: slot.status,
            }))}
            timezone={community.timezone}
            canDecide={admin}
            rateMissing={!season.occasionalPriceCents}
          />
        )}
      </div>

      {myContract && mySlot?.slot.status === "contract_present" && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <h3 className="font-display text-lg">Can&apos;t make it?</h3>
          <AbsenceForm sessionId={sessionRow.id} />
        </div>
      )}

      {!myContract && myWaitIndex >= 0 && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <h3 className="font-display text-lg">You&apos;re on the waitlist</h3>
          <p className="mt-1 text-sm text-ink/60">
            Position {myWaitIndex + 1} of {pending.length}. Asked{" "}
            {formatWhen(pending[myWaitIndex].slot.createdAt, community.timezone)}.
          </p>
        </div>
      )}

      {!myContract && !mySlot && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <h3 className="font-display text-lg">Play occasionally</h3>
          <p className="mt-1 text-sm text-ink/60">
            Apply to the waitlist
            {season.occasionalPriceCents
              ? `. If approved you pay ${formatMoney(season.occasionalPriceCents, community.currency)} to the admin.`
              : ". The occasional rate will be posted later."}
          </p>
          <form
            className="mt-3"
            action={async () => {
              "use server";
              await applyOccasional(sessionRow.id);
            }}
          >
            <SubmitButton size="sm">Apply</SubmitButton>
          </form>
        </div>
      )}

      {claimable.map((inv) => (
        <div key={inv.id} className="rounded-2xl border border-line bg-card p-5">
          <h3 className="font-display text-lg">
            {inv.type === "private" ? "Private replacement invite" : "Open replacement invite"}
          </h3>
          <p className="mt-1 text-sm text-ink/60">
            {season.regularPriceCents
              ? `Contract rate ${formatMoney(season.regularPriceCents, community.currency)} goes to the absent contract player.`
              : "The contract rate will be posted later."}
          </p>
          <form
            className="mt-3"
            action={async () => {
              "use server";
              await claimInvitation(inv.id);
            }}
          >
            <SubmitButton size="sm">Take this slot</SubmitButton>
          </form>
        </div>
      ))}
    </div>
  );
}
