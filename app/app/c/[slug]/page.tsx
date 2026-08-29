import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { CalendarPlus, Vote } from "lucide-react";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin, isStaff, isSuspended } from "@/lib/access";
import { EventCard, SectionTitle } from "@/components/event-card";
import { EventHomeCard } from "@/components/event-home-card";
import { PollCard } from "@/components/poll-card";
import { lockSeasonIfDue } from "@/lib/actions/season";
import { db } from "@/lib/db";
import {
  clubPollOptions,
  clubPollVotes,
  clubPolls,
  eventGuests,
  pollOptions,
  polls,
  rsvps,
  seasonSessions,
  seasonSignups,
  seasons,
  sessionSlots,
  votes,
  weeklyEvents,
  users,
  pollSuggestions,
} from "@/lib/db/schema";
import { eventWindowEnd, formatWhen, pendingRequestLabel } from "@/lib/utils";
import { listVoteHistory } from "@/lib/votes";
import { goingHeadcount } from "@/lib/ledger";
import { notFound } from "next/navigation";

export default async function CommunityOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const community = getCommunityBySlug(slug);
  if (!community) notFound();
  const session = await auth();
  const userId = session?.user?.id;
  const admin = userId ? isAdmin(community.id, userId) : false;
  const staff = userId ? isStaff(community.id, userId) : false;
  const suspended = userId ? isSuspended(community.id, userId) : false;
  const now = Date.now();
  const people = db.select({ id: users.id, name: users.name }).from(users).all();
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "Member";

  const events = db
    .select()
    .from(weeklyEvents)
    .where(eq(weeklyEvents.communityId, community.id))
    .orderBy(desc(weeklyEvents.createdAt))
    .all();

  const goingByEvent = new Map<string, number>();
  for (const e of events) {
    goingByEvent.set(e.id, goingHeadcount(e.id));
  }
  const rsvpRows = db.select().from(rsvps).all();
  const guestRows = db.select().from(eventGuests).all();
  const slotRows = db.select().from(sessionSlots).all();

  const activeEvents = events.filter((e) => {
    if (e.status === "cancelled") return false;
    if (!e.startsAt) return e.status === "polling" || e.status === "open";
    return (eventWindowEnd(e) ?? e.startsAt) >= now;
  });
  const pastEvents = events.filter((e) => {
    if (!e.startsAt) return false;
    return (eventWindowEnd(e) ?? e.startsAt) < now;
  });

  const seasonRowsRaw = db.select().from(seasons).where(eq(seasons.communityId, community.id)).all();
  for (const row of seasonRowsRaw) {
    if (row.status === "signup") await lockSeasonIfDue(row.id);
  }
  const seasonRows = db.select().from(seasons).where(eq(seasons.communityId, community.id)).all();
  const sessions = db
    .select()
    .from(seasonSessions)
    .where(eq(seasonSessions.communityId, community.id))
    .orderBy(desc(seasonSessions.startsAt))
    .all();
  const seasonOf = (id: string) => seasonRows.find((s) => s.id === id);
  const seasonName = (id: string) => seasonOf(id)?.name ?? "Season";
  const sessionEnd = (s: (typeof sessions)[number]) =>
    s.startsAt + (seasonOf(s.seasonId)?.durationMinutes ?? 120) * 60 * 1000;
  const openSeasonIds = new Set(seasonRows.filter((s) => s.status === "locked").map((s) => s.id));
  const upcomingSessions = sessions.filter((s) => openSeasonIds.has(s.seasonId) && sessionEnd(s) >= now);
  const pastSessions = sessions.filter((s) => openSeasonIds.has(s.seasonId) && sessionEnd(s) < now).slice(0, 8);
  const votingSeasons = seasonRows.filter((s) => s.status === "signup");
  const signupRows = db.select().from(seasonSignups).all();

  const eventPolls = events
    .filter((e) => e.status === "polling")
    .map((event) => {
      const poll = db.select().from(polls).where(eq(polls.eventId, event.id)).get();
      if (!poll) return null;
      const options = db.select().from(pollOptions).where(eq(pollOptions.pollId, poll.id)).all();
      const allVotes = db.select().from(votes).all().filter((v) => options.some((o) => o.id === v.optionId));
      return {
        id: poll.id,
        kind: "event" as const,
        question: poll.question,
        closesAt: poll.closesAt,
        options: options.map((o) => ({
          id: o.id,
          label: o.label,
          votes: allVotes.filter((v) => v.optionId === o.id).length,
          mine: allVotes.some((v) => v.optionId === o.id && v.userId === userId),
        })),
        voters: allVotes.map((v) => ({
          userId: v.userId,
          name: nameOf(v.userId),
          vote: options.find((o) => o.id === v.optionId)?.label ?? "",
          optionId: v.optionId,
          votedAt: v.createdAt,
        })),
        history: listVoteHistory("event", poll.id),
        suggestions: db
          .select()
          .from(pollSuggestions)
          .all()
          .filter((s) => s.kind === "event" && s.pollId === poll.id)
          .map((s) => ({ id: s.id, label: s.label, name: nameOf(s.suggestedById), status: s.status })),
      };
    })
    .filter(Boolean);

  const clubPollRows = db
    .select()
    .from(clubPolls)
    .where(eq(clubPolls.communityId, community.id))
    .orderBy(desc(clubPolls.createdAt))
    .all()
    .filter((p) => !p.closesAt || p.closesAt > now);

  const liveClubPolls = clubPollRows.map((poll) => {
    const options = db.select().from(clubPollOptions).where(eq(clubPollOptions.pollId, poll.id)).all();
    const allVotes = db
      .select()
      .from(clubPollVotes)
      .all()
      .filter((v) => options.some((o) => o.id === v.optionId));
    return {
      id: poll.id,
      kind: "club" as const,
      question: poll.question,
      closesAt: poll.closesAt,
      options: options.map((o) => ({
        id: o.id,
        label: o.label,
        votes: allVotes.filter((v) => v.optionId === o.id).length,
        mine: allVotes.some((v) => v.optionId === o.id && v.userId === userId),
      })),
      voters: allVotes.map((v) => ({
        userId: v.userId,
        name: nameOf(v.userId),
        vote: options.find((o) => o.id === v.optionId)?.label ?? "",
        optionId: v.optionId,
        votedAt: v.createdAt,
      })),
      history: listVoteHistory("club", poll.id),
      suggestions: db
        .select()
        .from(pollSuggestions)
        .all()
        .filter((s) => s.kind === "club" && s.pollId === poll.id)
        .map((s) => ({ id: s.id, label: s.label, name: nameOf(s.suggestedById), status: s.status })),
    };
  });

  const livePolls = [...liveClubPolls, ...eventPolls.filter((p) => p !== null)];
  const createLinks = staff ? (
    <>
      <Link
        href={`/app/c/${slug}/events/new`}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-sm text-ink"
      >
        <CalendarPlus className="h-4 w-4" />
        Create event
      </Link>
      <Link
        href={`/app/c/${slug}/polls/new`}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-sm text-ink"
      >
        <Vote className="h-4 w-4 text-primary" />
        Create poll
      </Link>
    </>
  ) : null;

  return (
    <div className="space-y-8">
      {livePolls.length > 0 && (
        <section>
          <SectionTitle action={createLinks}>Current polls</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            {livePolls.map((poll) =>
              poll ? (
                <PollCard
                  key={poll.id}
                  pollId={poll.id}
                  slug={slug}
                  kind={poll.kind}
                  question={poll.question}
                  closesLabel={poll.closesAt ? `Closes ${formatWhen(poll.closesAt, community.timezone)}` : null}
                  options={poll.options}
                  voters={poll.voters}
                  history={poll.history}
                  suggestions={poll.suggestions}
                  timezone={community.timezone}
                  staff={staff}
                  canVote={!suspended}
                  canSeeDetails={!suspended}
                />
              ) : null,
            )}
          </div>
        </section>
      )}

      {votingSeasons.length > 0 && (
        <section>
          <SectionTitle>Contract agreement</SectionTitle>
          <div className="space-y-3">
            {votingSeasons.map((s) => {
              const inCount = signupRows.filter((r) => r.seasonId === s.id && r.intent !== "decline").length;
              return (
                <EventCard
                  key={s.id}
                  href={`/app/c/${slug}/seasons/${s.id}`}
                  title={s.name}
                  location={s.location || community.location}
                  status="signup"
                  meta={`${inCount} of ${s.minPlayers} agreed · nights open after voting ends`}
                />
              );
            })}
          </div>
        </section>
      )}

      <section>
        <SectionTitle
          action={
            (livePolls.length === 0 && createLinks) || admin ? (
              <>
                {livePolls.length === 0 ? createLinks : null}
                {admin ? (
                  <Link href={`/app/c/${slug}/seasons`} className="text-sm text-primary">
                    Seasons
                  </Link>
                ) : null}
              </>
            ) : undefined
          }
        >
          Active events
        </SectionTitle>
        <div className="space-y-3">
          {activeEvents.filter((e) => e.status !== "polling").length === 0 && upcomingSessions.length === 0 && (
            <p className="rounded-2xl border border-dashed border-line bg-card px-4 py-8 text-center text-ink/50">
              Nothing on the pitch yet. Create an event to gather the squad.
            </p>
          )}
          {activeEvents
            .filter((e) => e.status !== "polling")
            .map((e) => {
              const eventRsvps = rsvpRows.filter((r) => r.eventId === e.id);
              const goingCount = eventRsvps.filter((r) => r.status === "going").length;
              const notGoingCount = eventRsvps.filter((r) => r.status === "not_going").length;
              const myStatus = eventRsvps.find((r) => r.userId === userId)?.status ?? null;
              const guests = guestRows
                .filter((g) => g.weeklyEventId === e.id && g.status !== "rejected")
                .map((g) => ({
                  id: g.id,
                  label: g.label,
                  hostName: nameOf(g.hostUserId),
                  canRemove: Boolean(userId === g.hostUserId || admin),
                  status: g.status,
                }));
              const guestCount = guests.filter((g) => g.status === "approved").length;
              const pendingGuests = guests.filter((g) => g.status === "pending").length;
              const deadlinePassed = Boolean(e.rsvpDeadlineAt && now > e.rsvpDeadlineAt);
              const rsvpOpen = ["open", "ready_to_book", "booked"].includes(e.status);
              return (
                <EventHomeCard
                  key={e.id}
                  slug={slug}
                  eventId={e.id}
                  title={e.title}
                  startsAt={e.startsAt}
                  timeZone={community.timezone}
                  location={e.location || community.location}
                  status={e.status}
                  hasTime={e.hasTime}
                  durationMinutes={e.durationMinutes}
                  goingCount={goingCount}
                  notGoingCount={notGoingCount}
                  headcount={goingByEvent.get(e.id) ?? 0}
                  minPlayers={e.minPlayers}
                  myStatus={myStatus}
                  canVote={Boolean(userId && rsvpOpen && !deadlinePassed && !suspended)}
                  canAddGuest={Boolean(myStatus === "going" && !deadlinePassed && !suspended)}
                  isAdmin={admin}
                  canPostCost={Boolean(
                    admin && e.paymentMode === "postpay" && e.totalCostCents == null && e.status !== "cancelled",
                  )}
                  canBook={Boolean(admin && ["open", "ready_to_book"].includes(e.status))}
                  canCancel={Boolean(admin && ["open", "ready_to_book"].includes(e.status))}
                  collectorName={e.collectorUserId ? nameOf(e.collectorUserId) : undefined}
                  totalCostCents={e.totalCostCents}
                  paymentInfo={e.paymentInfo}
                  currency={community.currency}
                  guestCount={guestCount}
                  guests={guests}
                  pendingGuests={pendingGuests}
                />
              );
            })}
          {upcomingSessions.map((s) => {
            const occasionalPending = slotRows.filter((r) => r.sessionId === s.id && r.status === "occasional_pending").length;
            const guestPending = guestRows.filter((g) => g.sessionId === s.id && g.status === "pending").length;
            const approvedGuestCount = guestRows.filter((g) => g.sessionId === s.id && g.status === "approved").length;
            const onSheet = slotRows.filter((r) => r.sessionId === s.id && r.status !== "occasional_pending").length;
            const requests = pendingRequestLabel(guestPending, occasionalPending);
            return (
              <EventCard
                key={s.id}
                href={`/app/c/${slug}/sessions/${s.id}`}
                title={seasonName(s.seasonId)}
                startsAt={s.startsAt}
                timeZone={community.timezone}
                location={seasonOf(s.seasonId)?.location || community.location}
                status={s.status}
                durationMinutes={seasonOf(s.seasonId)?.durationMinutes}
                meta={`${onSheet + approvedGuestCount} going${approvedGuestCount ? ` · ${approvedGuestCount} guest${approvedGuestCount === 1 ? "" : "s"}` : ""} · Season session`}
                requests={requests || undefined}
              />
            );
          })}
        </div>
      </section>

      {(pastEvents.length > 0 || pastSessions.length > 0) && (
        <section>
          <SectionTitle>Past events</SectionTitle>
          <div className="space-y-3 opacity-90">
            {pastEvents.slice(0, 8).map((e) => (
              <EventCard
                key={e.id}
                href={`/app/c/${slug}/events/${e.id}`}
                title={e.title}
                startsAt={e.startsAt}
                timeZone={community.timezone}
                location={e.location || community.location}
                status={e.status}
                hasTime={e.hasTime}
                durationMinutes={e.durationMinutes}
              />
            ))}
            {pastSessions.map((s) => (
              <EventCard
                key={s.id}
                href={`/app/c/${slug}/sessions/${s.id}`}
                title={seasonName(s.seasonId)}
                startsAt={s.startsAt}
                timeZone={community.timezone}
                location={seasonOf(s.seasonId)?.location || community.location}
                status={s.status}
                durationMinutes={seasonOf(s.seasonId)?.durationMinutes}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
