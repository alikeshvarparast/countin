import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { CalendarPlus, Vote } from "lucide-react";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin, isStaff, isSuspended } from "@/lib/access";
import { EventCard, SectionTitle } from "@/components/event-card";
import { EventHomeCard } from "@/components/event-home-card";
import { ContractHomeCard } from "@/components/contract-home-card";
import { ItemGrid } from "@/components/page-frame";
import { PollCard } from "@/components/poll-card";
import { db } from "@/lib/db";
import {
  clubPollOptions,
  clubPollVotes,
  clubPolls,
  eventGuests,
  pollOptions,
  polls,
  rsvps,
  contracts,
  seasonSessions,
  seasonSignups,
  seasons,
  sessionSlots,
  votes,
  weeklyEvents,
  users,
  pollSuggestions,
} from "@/lib/db/schema";
import { formatWhen, msToLocalInput, pendingRequestLabel, sessionSlotIsGoing } from "@/lib/utils";
import {
  actionNeededNote,
  homeBucket,
  lifecycleStatusLabel,
  presenceVotingClosed,
  waitingMeta,
} from "@/lib/home-events";
import { listVoteHistory } from "@/lib/votes";
import { goingHeadcount } from "@/lib/ledger";
import { eventLedgerAllSettled } from "@/lib/ledger-status";
import { notFound } from "next/navigation";

export default async function CommunityOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const community = getCommunityBySlug(slug);
  if (!community) notFound();
  const timeZone = community.timezone;
  const clubLocation = community.location;
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
  const settledByEvent = new Map<string, boolean>();
  for (const e of events) {
    if (e.paymentRequestedAt) settledByEvent.set(e.id, eventLedgerAllSettled(e.id));
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
    s.startsAt + (seasonOf(s.seasonId)?.durationMinutes ?? 120) * 60_000;
  const openSeasonIds = new Set(seasonRows.filter((s) => s.status === "locked").map((s) => s.id));
  const liveSessions = sessions.filter(
    (s) => openSeasonIds.has(s.seasonId) && s.status !== "cancelled",
  );
  const weekMs = 7 * 24 * 60 * 60_000;
  function sessionWithinHomeWindow(s: (typeof sessions)[number]) {
    const weeks = seasonOf(s.seasonId)?.homeVisibleWeeks ?? 4;
    return s.startsAt <= now + weeks * weekMs;
  }
  const upcomingSessions = liveSessions.filter(
    (s) => sessionEnd(s) >= now && sessionWithinHomeWindow(s),
  );
  const pastSessions = liveSessions
    .filter((s) => sessionEnd(s) < now)
    .sort((a, b) => b.startsAt - a.startsAt);
  const votingSeasons = seasonRows.filter((s) => s.status === "signup");
  /** Closed agreement, nights not created — staff Action needed only. */
  const agreedSeasons = admin
    ? seasonRows.filter((s) => s.status === "agreed")
    : [];
  const signupRows = db.select().from(seasonSignups).all();
  const contractRows = db.select().from(contracts).all();

  const openVoteSeasons = votingSeasons.filter((s) => !suspended);
  const needsVoteSeasons = openVoteSeasons.filter((s) => {
    if (!userId) return false;
    return !signupRows.some((r) => r.seasonId === s.id && r.userId === userId);
  });

  function hasMyPresenceVote(e: (typeof events)[number]) {
    return Boolean(userId && rsvpRows.some((r) => r.eventId === e.id && r.userId === userId));
  }

  const expressEvents: (typeof events)[number][] = [];
  const actionEvents: (typeof events)[number][] = [];
  const upcomingEvents: (typeof events)[number][] = [];
  const futureEvents: (typeof events)[number][] = [];
  const pastWeekly: (typeof events)[number][] = [];

  for (const e of events) {
    const bucket = homeBucket(e, {
      now,
      hasVote: hasMyPresenceVote(e),
      weekMs,
    });
    if (bucket === "express") expressEvents.push(e);
    else if (bucket === "action") actionEvents.push(e);
    else if (bucket === "upcoming") upcomingEvents.push(e);
    else if (bucket === "future") futureEvents.push(e);
    else if (bucket === "past") pastWeekly.push(e);
  }

  const needsVoteEvents = expressEvents.filter(
    (e) => userId && !suspended && !hasMyPresenceVote(e),
  );
  const upcomingSessionsSoon = upcomingSessions.filter((s) => s.startsAt <= now + weekMs);
  const futureSessions = upcomingSessions.filter((s) => s.startsAt > now + weekMs);

  const pastItems = [
    ...pastWeekly.map((e) => ({ kind: "weekly" as const, at: e.startsAt ?? e.createdAt, event: e })),
    ...pastSessions.map((s) => ({ kind: "session" as const, at: s.startsAt, session: s })),
  ].sort((a, b) => b.at - a.at);
  const pastPreview = pastItems.slice(0, 5);
  const pastHasMore = pastItems.length > 5;

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

  const allLivePolls = [...liveClubPolls, ...eventPolls.filter((p) => p !== null)];
  /** Keep open polls on Home after you vote — hide only when closed. */
  const livePolls = allLivePolls.filter((poll) => Boolean(poll));
  const pollsAwaitingYou = livePolls.some(
    (poll) => poll && userId && !suspended && !poll.options.some((o) => o.mine),
  );
  const createLinks = staff ? (
    <>
      <Link
        href={`/app/c/${slug}/events/new`}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-medium text-ink shadow-[0_6px_16px_rgba(47,107,79,0.25)] hover:bg-primary-2"
      >
        <CalendarPlus className="h-4 w-4" />
        Create event
      </Link>
      <Link
        href={`/app/c/${slug}/polls/new`}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3 text-sm text-ink hover:border-primary/40"
      >
        <Vote className="h-4 w-4 text-primary" />
        Create poll
      </Link>
    </>
  ) : null;

  function renderWeeklyCard(
    e: (typeof events)[number],
    opts: {
      mode: "express" | "upcoming" | "action";
    },
  ) {
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
    const closed = presenceVotingClosed(e, now);
    const headcount = goingByEvent.get(e.id) ?? 0;
    const settled = settledByEvent.get(e.id) ?? false;
    const life = lifecycleStatusLabel(e, now, settled);
    const canClosePresence = Boolean(
      admin && ["open", "ready_to_book", "booked"].includes(e.status) && !closed,
    );
    // Booked nights keep Change presence after voting closes; unbooked closed nights do not.
    const canVote = Boolean(
      userId &&
        !suspended &&
        ["open", "ready_to_book", "booked"].includes(e.status) &&
        (e.status === "booked" || !closed),
    );

    if (opts.mode === "action") {
      const note = admin
        ? actionNeededNote(e, now, settled)
        : waitingMeta(e, now, settled);
      const meta = `${headcount} going${guestCount ? ` · ${guestCount} guest${guestCount === 1 ? "" : "s"}` : ""}`;
      return (
        <EventCard
          key={e.id}
          href={`/app/c/${slug}/events/${e.id}`}
          title={e.title}
          startsAt={e.startsAt}
          timeZone={timeZone}
          location={e.location || clubLocation}
          status={life}
          hasTime={e.hasTime}
          durationMinutes={e.durationMinutes}
          note={note}
          meta={meta}
          attention="action"
          requests={
            admin && pendingGuests > 0
              ? `${pendingGuests} guest request${pendingGuests === 1 ? "" : "s"}`
              : undefined
          }
          myPresence={null}
        />
      );
    }

    if (opts.mode === "upcoming") {
      // Change presence only (collapsed); show reply badge on compact cards when not editing via home card.
      return (
        <EventHomeCard
          key={e.id}
          slug={slug}
          eventId={e.id}
          title={e.title}
          startsAt={e.startsAt}
          timeZone={timeZone}
          location={e.location || clubLocation}
          status={life}
          hasTime={e.hasTime}
          durationMinutes={e.durationMinutes}
          goingCount={goingCount}
          notGoingCount={notGoingCount}
          headcount={headcount}
          myStatus={myStatus}
          canVote={canVote}
          canAddGuest={Boolean(myStatus === "going" && e.status === "booked" && !suspended)}
          isAdmin={admin}
          canBook={Boolean(admin && ["open", "ready_to_book"].includes(e.status))}
          canCancel={Boolean(admin && e.status !== "cancelled")}
          canEdit={Boolean(admin && e.status !== "cancelled" && e.status !== "completed")}
          canClosePresence={canClosePresence}
          guestCount={guestCount}
          pendingGuests={pendingGuests}
          needsVote={Boolean(!myStatus)}
          collapseChoices
        />
      );
    }

    // Express the presence — full vote buttons while voting is open.
    return (
      <EventHomeCard
        key={e.id}
        slug={slug}
        eventId={e.id}
        title={e.title}
        startsAt={e.startsAt}
        timeZone={timeZone}
        location={e.location || clubLocation}
        status={life}
        hasTime={e.hasTime}
        durationMinutes={e.durationMinutes}
        goingCount={goingCount}
        notGoingCount={notGoingCount}
        headcount={headcount}
        myStatus={myStatus}
        canVote={canVote}
        canAddGuest={Boolean(myStatus === "going" && !closed && !suspended)}
        isAdmin={admin}
        canBook={Boolean(admin && ["open", "ready_to_book"].includes(e.status))}
        canCancel={Boolean(admin && e.status !== "cancelled")}
        canEdit={Boolean(admin && e.status !== "cancelled" && e.status !== "completed")}
        canClosePresence={canClosePresence}
        guestCount={guestCount}
        pendingGuests={pendingGuests}
        needsVote={Boolean(userId && !myStatus)}
        collapseChoices={false}
      />
    );
  }

  function renderSessionCard(s: (typeof sessions)[number]) {
    const occasionalPending = slotRows.filter((r) => r.sessionId === s.id && r.status === "occasional_pending").length;
    const guestPending = guestRows.filter((g) => g.sessionId === s.id && g.status === "pending").length;
    const approvedGuestCount = guestRows.filter((g) => g.sessionId === s.id && g.status === "approved").length;
    const onSheet = slotRows.filter((r) => r.sessionId === s.id && sessionSlotIsGoing(r.status)).length;
    const requests = pendingRequestLabel(guestPending, occasionalPending);
    const mySlot = userId ? slotRows.find((r) => r.sessionId === s.id && r.userId === userId) : undefined;
    const myPresence = mySlot
      ? sessionSlotIsGoing(mySlot.status)
        ? ("going" as const)
        : mySlot.status === "contract_absent" || mySlot.status === "occasional_declined"
          ? ("not_going" as const)
          : null
      : null;
    return (
      <EventCard
        key={s.id}
        href={`/app/c/${slug}/sessions/${s.id}`}
        title={seasonName(s.seasonId)}
        startsAt={s.startsAt}
        timeZone={timeZone}
        location={seasonOf(s.seasonId)?.location || clubLocation}
        status={s.status}
        durationMinutes={seasonOf(s.seasonId)?.durationMinutes}
        meta={`${onSheet + approvedGuestCount} going${approvedGuestCount ? ` · ${approvedGuestCount} guest${approvedGuestCount === 1 ? "" : "s"}` : ""} · Season session`}
        requests={requests || undefined}
        myPresence={myPresence}
      />
    );
  }

  const sectionAction = admin ? (
    <Link href={`/app/c/${slug}/seasons`} className="text-sm text-primary">
      Seasons
    </Link>
  ) : undefined;

  const showActionSection = actionEvents.length > 0 || (admin && agreedSeasons.length > 0);

  return (
    <div className="motion-enter space-y-8">
      {createLinks && (
        <div className="flex flex-wrap items-center gap-2">{createLinks}</div>
      )}

      {livePolls.length > 0 && (
        <section>
          <SectionTitle tone="vote">{pollsAwaitingYou ? "Needs your vote · polls" : "Open polls"}</SectionTitle>
          <ItemGrid>
            {livePolls.map((poll) =>
              poll ? (
                <PollCard
                  key={poll.id}
                  pollId={poll.id}
                  slug={slug}
                  kind={poll.kind}
                  question={poll.question}
                  closesLabel={poll.closesAt ? `Closes ${formatWhen(poll.closesAt, community.timezone)}` : null}
                  closesAtDefault={msToLocalInput(poll.closesAt)}
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
          </ItemGrid>
        </section>
      )}

      {openVoteSeasons.length > 0 && (
        <section>
          <SectionTitle tone={needsVoteSeasons.length > 0 ? "vote" : "default"}>
            {needsVoteSeasons.length > 0 ? "Needs your reply · contract" : "Contract agreement"}
          </SectionTitle>
          <ItemGrid>
            {openVoteSeasons.map((s) => {
              const inCount = signupRows.filter((r) => r.seasonId === s.id && r.intent !== "decline").length;
              const outCount = signupRows.filter((r) => r.seasonId === s.id && r.intent === "decline").length;
              const mySignup = userId
                ? signupRows.find((r) => r.seasonId === s.id && r.userId === userId)
                : undefined;
              return (
                <ContractHomeCard
                  key={s.id}
                  slug={slug}
                  seasonId={s.id}
                  title={s.name}
                  location={s.location || community.location}
                  agreeCount={inCount}
                  declineCount={outCount}
                  minPlayers={s.minPlayers}
                  myIntent={mySignup?.intent}
                  canVote={Boolean(userId && !suspended)}
                />
              );
            })}
          </ItemGrid>
        </section>
      )}

      {expressEvents.length > 0 && (
        <section>
          <SectionTitle tone="vote">
            {needsVoteEvents.length > 0 ? "Express the presence · needs your reply" : "Express the presence"}
          </SectionTitle>
          <ItemGrid>{expressEvents.map((e) => renderWeeklyCard(e, { mode: "express" }))}</ItemGrid>
        </section>
      )}

      {showActionSection && (
        <section>
          <SectionTitle tone="close">{admin ? "Action needed" : "Waiting"}</SectionTitle>
          <ItemGrid>
            {admin &&
              agreedSeasons.map((s) => {
                const onContract = contractRows.filter((r) => r.seasonId === s.id).length;
                return (
                  <EventCard
                    key={s.id}
                    href={`/app/c/${slug}/seasons/${s.id}`}
                    title={s.name}
                    location={s.location || community.location}
                    status="agreement closed"
                    note="Action needed: create the season nights from this closed agreement."
                    meta={`${onContract} on contract · min ${s.minPlayers}`}
                    attention="action"
                  />
                );
              })}
            {actionEvents.map((e) => renderWeeklyCard(e, { mode: "action" }))}
          </ItemGrid>
        </section>
      )}

      <section>
        <SectionTitle tone="upcoming" action={sectionAction}>
          Upcoming events · next 7 days
        </SectionTitle>
        <ItemGrid>
          {upcomingEvents.length === 0 && upcomingSessionsSoon.length === 0 && (
            <p className="surface-empty col-span-full rounded-2xl border border-line px-4 py-8 text-center text-ink/50">
              Nothing in the next week.
            </p>
          )}
          {upcomingEvents.map((e) => renderWeeklyCard(e, { mode: "upcoming" }))}
          {upcomingSessionsSoon.map(renderSessionCard)}
        </ItemGrid>
      </section>

      {(futureEvents.length > 0 || futureSessions.length > 0) && (
        <section>
          <SectionTitle tone="future">Future events · after 7 days</SectionTitle>
          <ItemGrid>
            {futureEvents.map((e) => renderWeeklyCard(e, { mode: "upcoming" }))}
            {futureSessions.map(renderSessionCard)}
          </ItemGrid>
        </section>
      )}

      {pastPreview.length > 0 && (
        <section>
          <SectionTitle
            tone="past"
            action={
              pastHasMore ? (
                <Link href={`/app/c/${slug}/events?scope=past`} className="text-sm text-primary">
                  See more…
                </Link>
              ) : undefined
            }
          >
            Past events
          </SectionTitle>
          <ItemGrid className="opacity-90">
            {pastPreview.map((item) =>
              item.kind === "weekly" ? (
                <EventCard
                  key={item.event.id}
                  href={`/app/c/${slug}/events/${item.event.id}`}
                  title={item.event.title}
                  startsAt={item.event.startsAt}
                  timeZone={community.timezone}
                  location={item.event.location || community.location}
                  status={lifecycleStatusLabel(
                    item.event,
                    now,
                    settledByEvent.get(item.event.id) ?? false,
                  )}
                  hasTime={item.event.hasTime}
                  durationMinutes={item.event.durationMinutes}
                />
              ) : (
                renderSessionCard(item.session)
              ),
            )}
          </ItemGrid>
        </section>
      )}
    </div>
  );
}
