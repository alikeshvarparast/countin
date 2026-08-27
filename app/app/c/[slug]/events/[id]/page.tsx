import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin } from "@/lib/access";
import {
  cancelWeeklyEvent,
  confirmFieldBooked,
  lockPollTime,
  postWeeklyCost,
  setRsvp,
  votePoll,
} from "@/lib/actions/weekly";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Field, Input } from "@/components/ui";
import { db } from "@/lib/db";
import { pollOptions, polls, rsvps, users, votes, weeklyEvents } from "@/lib/db/schema";
import { formatMoney, formatWhen } from "@/lib/utils";

export default async function WeeklyEventPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const community = getCommunityBySlug(slug);
  if (!community) notFound();
  const event = db.select().from(weeklyEvents).where(eq(weeklyEvents.id, id)).get();
  if (!event || event.communityId !== community.id) notFound();
  const session = await auth();
  const admin = session?.user?.id ? isAdmin(community.id, session.user.id) : false;
  const poll = db.select().from(polls).where(eq(polls.eventId, event.id)).get();
  const options = poll
    ? db.select().from(pollOptions).where(eq(pollOptions.pollId, poll.id)).all()
    : [];
  const allVotes = options.length
    ? db.select().from(votes).all().filter((v) => options.some((o) => o.id === v.optionId))
    : [];
  const rsvpRows = db
    .select({ rsvp: rsvps, user: users })
    .from(rsvps)
    .innerJoin(users, eq(users.id, rsvps.userId))
    .where(eq(rsvps.eventId, event.id))
    .all();
  const going = rsvpRows.filter((r) => r.rsvp.status === "going");
  const myRsvp = rsvpRows.find((r) => r.rsvp.userId === session?.user?.id);
  const deadlinePassed = Boolean(event.rsvpDeadlineAt && Date.now() > event.rsvpDeadlineAt);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl">{event.title}</h2>
          <p className="mt-1 text-cream/60">
            {formatWhen(event.startsAt, community.timezone)} · {event.location || community.location || "Pitch TBD"}
          </p>
          <p className="mt-1 text-sm text-cream/50">
            Minimum {event.minPlayers} to book · {going.length} going
            {event.rsvpDeadlineAt && ` · presence until ${formatWhen(event.rsvpDeadlineAt, community.timezone)}`}
          </p>
        </div>
        <Badge tone={event.status === "booked" || event.status === "ready_to_book" ? "lime" : "line"}>
          {event.status.replaceAll("_", " ")}
        </Badge>
      </div>

      {poll && event.status === "polling" && (
        <Card>
          <h3 className="font-display text-xl text-lime">{poll.question}</h3>
          {poll.closesAt && (
            <p className="mt-1 text-sm text-cream/50">Closes {formatWhen(poll.closesAt, community.timezone)}</p>
          )}
          <ul className="mt-4 space-y-2">
            {options.map((opt) => {
              const count = allVotes.filter((v) => v.optionId === opt.id).length;
              return (
                <li key={opt.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
                  <span>
                    {opt.label}{" "}
                    <span className="text-cream/40">
                      ({count} vote{count === 1 ? "" : "s"})
                    </span>
                  </span>
                  <div className="flex gap-2">
                    <form
                      action={async (formData) => {
                        "use server";
                        await votePoll(formData);
                      }}
                    >
                      <input type="hidden" name="optionId" value={opt.id} />
                      <SubmitButton variant="ghost">Vote</SubmitButton>
                    </form>
                    {admin && (
                      <form
                        action={async (formData) => {
                          "use server";
                          await lockPollTime(formData);
                        }}
                        className="flex items-center gap-2"
                      >
                        <input type="hidden" name="optionId" value={opt.id} />
                        <Input name="rsvpDeadlineAt" type="datetime-local" className="w-auto" />
                        <SubmitButton>Lock this time</SubmitButton>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {["open", "ready_to_book", "booked"].includes(event.status) && (
        <Card>
          <h3 className="font-display text-xl text-lime">Presence</h3>
          <p className="text-sm text-cream/50">
            {deadlinePassed ? "Deadline passed. Presence is locked." : "You can change this until the deadline."}
          </p>
          {!deadlinePassed && (
            <div className="mt-4 flex gap-2">
              <form
                action={async (formData) => {
                  "use server";
                  await setRsvp(formData);
                }}
              >
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="status" value="going" />
                <SubmitButton variant={myRsvp?.rsvp.status === "going" ? "primary" : "ghost"}>Going</SubmitButton>
              </form>
              <form
                action={async (formData) => {
                  "use server";
                  await setRsvp(formData);
                }}
              >
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="status" value="not_going" />
                <SubmitButton variant={myRsvp?.rsvp.status === "not_going" ? "cream" : "ghost"}>Not going</SubmitButton>
              </form>
            </div>
          )}
          <ul className="mt-4 space-y-1 text-sm">
            {rsvpRows.map(({ rsvp, user }) => (
              <li key={rsvp.id}>
                {user.name} — {rsvp.status.replace("_", " ")}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {admin && ["open", "ready_to_book"].includes(event.status) && (
        <Card className="flex flex-wrap gap-2">
          <form
            action={async () => {
              "use server";
              await confirmFieldBooked(event.id);
            }}
          >
            <SubmitButton>Mark field booked</SubmitButton>
          </form>
          <form
            action={async () => {
              "use server";
              await cancelWeeklyEvent(event.id);
            }}
          >
            <SubmitButton variant="danger">Cancel event</SubmitButton>
          </form>
        </Card>
      )}

      {admin && event.totalCostCents == null && event.status !== "cancelled" && event.status !== "polling" && (
        <Card>
          <h3 className="font-display text-xl text-lime">Post cost</h3>
          <p className="text-sm text-cream/50">Splits equally among people still marked going.</p>
          <form
            action={async (formData) => {
              "use server";
              await postWeeklyCost(formData);
            }}
            className="mt-4 flex items-end gap-3"
          >
            <input type="hidden" name="eventId" value={event.id} />
            <Field label={`Total (${community.currency})`}>
              <Input name="amount" type="number" step="0.01" min="0.01" required />
            </Field>
            <SubmitButton>Split & notify</SubmitButton>
          </form>
        </Card>
      )}

      {event.totalCostCents != null && (
        <Card>
          Posted {formatMoney(event.totalCostCents, community.currency)} among {going.length} players. See the ledger.
        </Card>
      )}
    </div>
  );
}
