import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin, listApprovedMembers } from "@/lib/access";
import { applyOccasional, cancelSeasonSession, claimInvitation } from "@/lib/actions/season";
import { Avatar } from "@/components/avatar";
import { AbsenceForm } from "@/components/absence-form";
import { GuestForm } from "@/components/guest-form";
import { GuestWaitlist, GuestCancelButton } from "@/components/guest-waitlist";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui";
import { WaitlistPanel } from "@/components/waitlist-panel";
import { db } from "@/lib/db";
import { contracts, eventGuests, invitations, seasonSessions, seasons, sessionSlots, users } from "@/lib/db/schema";
import { PageFrame } from "@/components/page-frame";
import { fieldBookedLabel, formatEventWhen, formatMoney, formatWhen, pendingRequestLabel, sessionSlotIsGoing } from "@/lib/utils";

function slotLabel(kind: string, status: string) {
  if (status === "contract_absent") return "Contract · out";
  if (kind === "contract") return "Contract";
  if (kind === "replacement") return "Replacement · this night";
  if (status === "occasional_approved") return "Occasional";
  if (status === "occasional_pending") return "Occasional · waiting";
  return `${kind} · ${status.replaceAll("_", " ")}`;
}

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
  if (season.status === "cancelled" || sessionRow.status === "cancelled") redirect(`/app/c/${slug}`);
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
  const people = db.select({ id: users.id, name: users.name }).from(users).all();
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "Member";
  const mySlot = slots.find((s) => s.slot.userId === userId);
  const sheet = slots.filter((s) => s.slot.status !== "occasional_pending" && s.slot.status !== "occasional_rejected");
  const goingSlots = sheet.filter((s) => sessionSlotIsGoing(s.slot.status));
  const outSlots = sheet.filter((s) => s.slot.status === "contract_absent");
  const goingCount = goingSlots.length + approvedGuests.length;
  const pending = slots
    .filter((s) => s.slot.status === "occasional_pending")
    .sort((a, b) => a.slot.createdAt - b.slot.createdAt);
  const history = slots
    .filter((s) => s.slot.status === "occasional_approved" || s.slot.status === "occasional_rejected")
    .sort((a, b) => a.slot.createdAt - b.slot.createdAt);
  const myWaitIndex = pending.findIndex((s) => s.slot.userId === userId);
  const nightCancelled = sessionRow.status === "cancelled";
  const contractIds = new Set(
    db
      .select({ userId: contracts.userId })
      .from(contracts)
      .where(eq(contracts.seasonId, season.id))
      .all()
      .map((row) => row.userId),
  );
  const claimable = invites.filter((inv) => {
    if (inv.status !== "open") return false;
    if (myContract) return false;
    if (mySlot) return false;
    if (inv.type === "private") return inv.toUserId === userId;
    return true;
  });
  const occasionalMembers = listApprovedMembers(community.id)
    .filter((member) => member.userId !== userId && !contractIds.has(member.userId))
    .map((member) => ({ id: member.userId, name: member.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <PageFrame width="article" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-primary">{season.name}</p>
          <h2 className="mt-1 font-display text-2xl">
            {formatEventWhen(sessionRow.startsAt, community.timezone, true, season.durationMinutes)}
          </h2>
          <p className="mt-1 text-sm text-ink/60">{season.location || community.location || "Pitch TBD"}</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {pendingRequestLabel(pendingGuests.length, pending.length) ? (
            <Badge tone="clay">{pendingRequestLabel(pendingGuests.length, pending.length)}</Badge>
          ) : null}
          <Badge>{sessionRow.status.replaceAll("_", " ")}</Badge>
          {admin && sessionRow.status !== "cancelled" && (
            <form
              action={async () => {
                "use server";
                await cancelSeasonSession(sessionRow.id);
              }}
            >
              <SubmitButton variant="danger" size="sm">
                Cancel night
              </SubmitButton>
            </form>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-card p-5">
        <h3 className="font-display text-lg">Details</h3>
        <dl className="mt-2">
          <DetailRow label="When">
            {formatEventWhen(sessionRow.startsAt, community.timezone, true, season.durationMinutes)}
          </DetailRow>
          <DetailRow label="Where">{season.location || community.location || "Pitch TBD"}</DetailRow>
          <DetailRow label="Field">{fieldBookedLabel(sessionRow.status)}</DetailRow>
          <DetailRow label="On the sheet">
            {goingCount} going
            {outSlots.length > 0 ? ` · ${outSlots.length} out` : ""}
            {approvedGuests.length > 0
              ? ` · ${goingSlots.length} player${goingSlots.length === 1 ? "" : "s"} · ${approvedGuests.length} guest${approvedGuests.length === 1 ? "" : "s"}`
              : ""}
          </DetailRow>
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

      <GuestWaitlist
        pending={pendingGuests.map((g) => ({
          id: g.id,
          label: g.label,
          hostName: nameOf(g.hostUserId),
          hostUserId: g.hostUserId,
          askedAt: g.createdAt,
          status: g.status,
        }))}
        timezone={community.timezone}
        canDecide={admin}
        userId={userId}
      />

      <div className="rounded-2xl border border-line bg-card p-5">
        <h3 className="font-display text-lg">People</h3>
        <p className="mt-1 text-sm text-ink/55">
          {goingCount} going
          {outSlots.length > 0 ? ` · ${outSlots.length} out` : ""}
          {approvedGuests.length > 0 ? ` · ${approvedGuests.length} guest${approvedGuests.length === 1 ? "" : "s"}` : ""}
          {pendingGuests.length || pending.length
            ? ` · ${pendingRequestLabel(pendingGuests.length, pending.length)}`
            : ""}
        </p>
        <div className="mt-4">
          <p className="text-xs uppercase tracking-[0.18em] text-secondary">Participants · {goingSlots.length}</p>
          <ul className="mt-2 space-y-2 text-sm">
            {goingSlots.length === 0 && <li className="text-ink/45">No one on the sheet yet.</li>}
            {goingSlots.map(({ slot, user }) => (
              <li key={slot.id} className="flex items-center gap-2 py-0.5">
                <Avatar src={user.imageUrl} name={user.name} size="xs" />
                <span className="min-w-0 truncate">
                  {user.name} <span className="text-ink/45">· {slotLabel(slot.kind, slot.status)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        {outSlots.length > 0 && (
          <div className="mt-5">
            <p className="text-xs uppercase tracking-[0.18em] text-secondary">Out · {outSlots.length}</p>
            <ul className="mt-2 space-y-2 text-sm">
              {outSlots.map(({ slot, user }) => (
                <li key={slot.id} className="flex items-center gap-2 py-0.5">
                  <Avatar src={user.imageUrl} name={user.name} size="xs" />
                  <span className="min-w-0 truncate">
                    {user.name} <span className="text-ink/45">· {slotLabel(slot.kind, slot.status)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-5 border-t border-line pt-5">
          <p className="text-xs uppercase tracking-[0.18em] text-secondary">Guests · {approvedGuests.length}</p>
          <ul className="mt-2 space-y-2 text-sm">
            {approvedGuests.length === 0 && <li className="text-ink/45">No guests on the list yet.</li>}
            {approvedGuests.map((g) => (
              <li key={g.id} className="flex items-center gap-2 py-0.5">
                <span className="min-w-0 flex-1 truncate">
                  {g.label} <span className="text-ink/45">· guest of {nameOf(g.hostUserId)}</span>
                </span>
                {(admin || userId === g.hostUserId) && <GuestCancelButton guestId={g.id} />}
              </li>
            ))}
          </ul>
          {mySlot && sessionSlotIsGoing(mySlot.slot.status) && !nightCancelled && (
            <div className="mt-3">
              <GuestForm sessionId={sessionRow.id} />
            </div>
          )}
        </div>
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
      </div>

      {myContract && mySlot?.slot.status === "contract_present" && !nightCancelled && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <h3 className="font-display text-lg">Can&apos;t make it?</h3>
          <AbsenceForm sessionId={sessionRow.id} members={occasionalMembers} />
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

      {!myContract && !mySlot && !nightCancelled && (
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

      {!nightCancelled && claimable.map((inv) => (
        <div key={inv.id} className="rounded-2xl border border-line bg-card p-5">
          <h3 className="font-display text-lg">
            {inv.type === "private" ? "Private exchange request" : "Open exchange request"}
          </h3>
          <p className="mt-1 text-sm text-ink/60">
            Take this night only, or take over the remaining contract
            {season.regularPriceCents
              ? `. This night is ${formatMoney(season.regularPriceCents, community.currency)} to the contract player.`
              : ". The contract rate will be posted later."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <form
              action={async (formData) => {
                "use server";
                await claimInvitation(formData);
              }}
            >
              <input type="hidden" name="invitationId" value={inv.id} />
              <input type="hidden" name="mode" value="night" />
              <SubmitButton size="sm">Take this night only</SubmitButton>
            </form>
            <form
              action={async (formData) => {
                "use server";
                await claimInvitation(formData);
              }}
            >
              <input type="hidden" name="invitationId" value={inv.id} />
              <input type="hidden" name="mode" value="contract" />
              <SubmitButton size="sm" variant="ghost">
                Take over the contract
              </SubmitButton>
            </form>
          </div>
        </div>
      ))}
    </PageFrame>
  );
}
