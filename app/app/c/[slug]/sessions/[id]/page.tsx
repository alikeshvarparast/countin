import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin } from "@/lib/access";
import { applyOccasional, claimInvitation, decideWaitlist } from "@/lib/actions/season";
import { AbsenceForm } from "@/components/absence-form";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { contracts, invitations, seasonSessions, seasons, sessionSlots, users } from "@/lib/db/schema";
import { formatMoney, formatWhen } from "@/lib/utils";

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
  const mySlot = slots.find((s) => s.slot.userId === userId);
  const claimable = invites.filter((inv) => {
    if (inv.status !== "open") return false;
    if (myContract) return false;
    if (mySlot) return false;
    if (inv.type === "private") return inv.toUserId === userId;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-lime">{season.name}</p>
        <h2 className="font-display text-3xl">{formatWhen(sessionRow.startsAt, community.timezone)}</h2>
        <p className="text-cream/60">{season.location || community.location || "Pitch TBD"}</p>
      </div>

      <Card>
        <h3 className="font-display text-xl text-lime">Sheet</h3>
        <ul className="mt-3 space-y-2">
          {slots.length === 0 && <li className="text-cream/50">No one on the sheet yet.</li>}
          {slots.map(({ slot, user }) => (
            <li key={slot.id} className="flex items-center justify-between gap-3">
              <span>
                {user.name}{" "}
                <span className="text-cream/40">
                  · {slot.kind} · {slot.status.replaceAll("_", " ")}
                </span>
              </span>
              {admin && slot.status === "occasional_pending" && (
                <div className="flex gap-2">
                  <form
                    action={async (formData) => {
                      "use server";
                      await decideWaitlist(formData);
                    }}
                  >
                    <input type="hidden" name="slotId" value={slot.id} />
                    <input type="hidden" name="decision" value="approved" />
                    <SubmitButton>Approve</SubmitButton>
                  </form>
                  <form
                    action={async (formData) => {
                      "use server";
                      await decideWaitlist(formData);
                    }}
                  >
                    <input type="hidden" name="slotId" value={slot.id} />
                    <input type="hidden" name="decision" value="rejected" />
                    <SubmitButton variant="ghost">Decline</SubmitButton>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {myContract && mySlot?.slot.status === "contract_present" && (
        <Card>
          <h3 className="font-display text-xl text-lime">Can&apos;t make it?</h3>
          <AbsenceForm sessionId={sessionRow.id} />
        </Card>
      )}

      {!myContract && !mySlot && (
        <Card>
          <h3 className="font-display text-xl text-lime">Play occasionally</h3>
          <p className="text-sm text-cream/60">
            Apply to the waitlist. If approved you pay{" "}
            {formatMoney(Math.round(season.regularPriceCents * 1.5), community.currency)} to the admin.
          </p>
          <form
            className="mt-3"
            action={async () => {
              "use server";
              await applyOccasional(sessionRow.id);
            }}
          >
            <SubmitButton>Apply</SubmitButton>
          </form>
        </Card>
      )}

      {claimable.map((inv) => (
        <Card key={inv.id}>
          <h3 className="font-display text-xl text-lime">
            {inv.type === "private" ? "Private replacement invite" : "Open replacement invite"}
          </h3>
          <p className="text-sm text-cream/60">
            Regular rate {formatMoney(season.regularPriceCents, community.currency)} goes to the absent contract player.
          </p>
          <form
            className="mt-3"
            action={async () => {
              "use server";
              await claimInvitation(inv.id);
            }}
          >
            <SubmitButton>Take this slot</SubmitButton>
          </form>
        </Card>
      ))}
    </div>
  );
}
