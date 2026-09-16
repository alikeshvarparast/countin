import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCommunityBySlug, isAdmin, isStaff, isSuspended, listApprovedMembers } from "@/lib/access";
import { PollCard } from "@/components/poll-card";
import { EventMenu } from "@/components/event-menu";
import { EventCostPanel } from "@/components/event-cost-panel";
import { GuestForm } from "@/components/guest-form";
import { GuestWaitlist, GuestCancelButton } from "@/components/guest-waitlist";
import { NonVotersToggle } from "@/components/non-voters-toggle";
import { PresenceCancelPanel } from "@/components/presence-cancel-panel";
import { PresenceVote } from "@/components/presence-vote";
import { Avatar } from "@/components/avatar";
import { PageFrame } from "@/components/page-frame";
import { Badge } from "@/components/ui";
import { db } from "@/lib/db";
import {
  eventGuests,
  eventWaitlist,
  ledgerEntries,
  pollOptions,
  polls,
  pollSuggestions,
  presenceCancelRequests,
  rsvps,
  users,
  votes,
  weeklyEvents,
} from "@/lib/db/schema";
import { eventWindowEnd, fieldBookedLabel, formatEventWhen, formatMoney, formatWhen, msToLocalInput } from "@/lib/utils";
import { goingHeadcount } from "@/lib/ledger";
import { eventLedgerAllSettled } from "@/lib/ledger-status";
import { listVoteHistory } from "@/lib/votes";
import { promoteWaitlistMember } from "@/lib/actions/weekly";
import { SubmitButton } from "@/components/submit-button";

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-3 border-b border-line/70 py-2 last:border-0">
      <dt className="text-xs text-ink/50">{label}</dt>
      <dd className="m-0 text-sm text-ink">{children}</dd>
    </div>
  );
}

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
  if (event.status === "cancelled") redirect(`/app/c/${slug}`);
  const session = await auth();
  const userId = session?.user?.id;
  const admin = userId ? isAdmin(community.id, userId) : false;
  const staff = userId ? isStaff(community.id, userId) : false;
  const suspended = userId ? isSuspended(community.id, userId) : false;
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
  const guests = db.select().from(eventGuests).where(eq(eventGuests.weeklyEventId, event.id)).all();
  const approvedGuests = guests.filter((g) => g.status === "approved");
  const pendingGuests = guests.filter((g) => g.status === "pending");
  const people = db.select({ id: users.id, name: users.name }).from(users).all();
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "Member";
  const pendingCancel = db
    .select()
    .from(presenceCancelRequests)
    .where(eq(presenceCancelRequests.eventId, event.id))
    .all()
    .filter((r) => r.status === "pending")
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: nameOf(r.userId),
      askedAt: r.createdAt,
    }));
  const going = rsvpRows.filter((r) => r.rsvp.status === "going");
  const notGoing = rsvpRows.filter((r) => r.rsvp.status === "not_going");
  const votedIds = new Set(rsvpRows.map((r) => r.rsvp.userId));
  const nonVoters = listApprovedMembers(community.id)
    .filter((m) => !votedIds.has(m.userId))
    .map((m) => ({ id: m.userId, name: m.name, imageUrl: m.imageUrl }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const myRsvp = rsvpRows.find((r) => r.rsvp.userId === userId);
  const deadlinePassed = Boolean(event.rsvpDeadlineAt && Date.now() > event.rsvpDeadlineAt);
  const headcount = goingHeadcount(event.id);
  const collector = event.collectorUserId ? nameOf(event.collectorUserId) : "the collector";
  const rsvpOpen = ["open", "ready_to_book", "booked"].includes(event.status);
  const canVote = Boolean(
    userId && rsvpOpen && !suspended && (event.status === "booked" || !deadlinePassed),
  );
  const canAddGuest = Boolean(
    myRsvp?.rsvp.status === "going" && (event.status === "booked" || !deadlinePassed) && !suspended,
  );
  const canBook = Boolean(admin && ["open", "ready_to_book"].includes(event.status));
  const canCancel = Boolean(admin && event.status !== "cancelled");
  const canClosePresence = Boolean(admin && rsvpOpen && !deadlinePassed);
  const members = listApprovedMembers(community.id).map((m) => ({
    userId: m.userId,
    name: m.name,
    paymentInfo: m.paymentInfo,
  }));
  const waitRows = db.select().from(eventWaitlist).where(eq(eventWaitlist.eventId, event.id)).all();
  const ended = Boolean(event.startsAt && (eventWindowEnd(event) ?? event.startsAt) < Date.now());
  const canSendPrepaid = Boolean(
    admin && event.paymentMode === "prepaid" && ["booked", "ready_to_book"].includes(event.status),
  );
  const canSendPostpaid = Boolean(admin && (event.paymentMode !== "prepaid" ? ended || event.status === "booked" : false));
  const allSettled = event.paymentRequestedAt ? eventLedgerAllSettled(event.id) : false;
  const shareRows = event.paymentRequestedAt
    ? db
        .select({
          id: ledgerEntries.id,
          fromUserId: ledgerEntries.fromUserId,
          amountCents: ledgerEntries.amountCents,
          status: ledgerEntries.status,
          fromName: users.name,
        })
        .from(ledgerEntries)
        .innerJoin(users, eq(users.id, ledgerEntries.fromUserId))
        .where(eq(ledgerEntries.weeklyEventId, event.id))
        .all()
    : [];
  const showCost = event.status !== "polling" && event.status !== "cancelled" && (admin || Boolean(event.paymentRequestedAt));
  const myWaitlisted = waitRows.some((w) => w.userId === userId);
  const suggestions = poll
    ? db
        .select()
        .from(pollSuggestions)
        .all()
        .filter((s) => s.kind === "event" && s.pollId === poll.id)
        .map((s) => ({ id: s.id, label: s.label, name: nameOf(s.suggestedById), status: s.status }))
    : [];
  const guestItems = guests
    .filter((g) => g.status !== "rejected")
    .map((g) => ({
      id: g.id,
      label: g.label,
      hostName: nameOf(g.hostUserId),
      canRemove: Boolean(userId === g.hostUserId || admin),
      status: g.status,
    }));

  return (
    <PageFrame width="article" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-2xl break-words">{event.title}</h2>
          <p className="mt-1 text-sm text-ink/60">
            {formatEventWhen(event.startsAt, community.timezone, event.hasTime, event.durationMinutes)}
          </p>
        </div>
        <div className="flex items-start gap-2">
          {pendingGuests.length > 0 && (
            <Badge tone="clay">
              {pendingGuests.length} guest request{pendingGuests.length === 1 ? "" : "s"}
            </Badge>
          )}
          <Badge tone={event.status === "booked" || event.status === "ready_to_book" ? "lime" : "line"}>
            {event.status.replaceAll("_", " ")}
          </Badge>
          <EventMenu
            slug={slug}
            eventId={event.id}
            canVote={canVote}
            canAddGuest={canAddGuest}
            isAdmin={admin}
            canBook={canBook}
            canCancel={canCancel}
            canEdit={Boolean(admin && event.status !== "cancelled" && event.status !== "completed")}
            canClosePresence={canClosePresence}
            lockOptions={admin && event.status === "polling" ? options.map((o) => ({ id: o.id, label: o.label })) : undefined}
            showDetails={false}
          />
        </div>
      </div>

      {poll && event.status === "polling" && (
        <PollCard
          pollId={poll.id}
          slug={slug}
          kind="event"
          question={poll.question}
          closesLabel={poll.closesAt ? `Closes ${formatWhen(poll.closesAt, community.timezone)}` : null}
          closesAtDefault={msToLocalInput(poll.closesAt)}
          options={options.map((o) => ({
            id: o.id,
            label: o.label,
            votes: allVotes.filter((v) => v.optionId === o.id).length,
            mine: allVotes.some((v) => v.optionId === o.id && v.userId === userId),
          }))}
          voters={allVotes.map((v) => ({
            userId: v.userId,
            name: nameOf(v.userId),
            vote: options.find((o) => o.id === v.optionId)?.label ?? "",
            optionId: v.optionId,
            votedAt: v.createdAt,
          }))}
          history={listVoteHistory("event", poll.id)}
          suggestions={suggestions}
          timezone={community.timezone}
          staff={staff}
          canVote={!suspended}
          canSeeDetails={!suspended}
        />
      )}

      <div className="rounded-2xl border border-line bg-card p-5">
        <h3 className="font-display text-lg">Details</h3>
        <dl className="mt-2">
          <DetailRow label="When">
            {formatEventWhen(event.startsAt, community.timezone, event.hasTime, event.durationMinutes)}
          </DetailRow>
          <DetailRow label="Where">{event.location || community.location || "Pitch TBD"}</DetailRow>
          <DetailRow label="Presence until">
            {event.rsvpDeadlineAt ? formatWhen(event.rsvpDeadlineAt, community.timezone) : "Open"}
          </DetailRow>
          <DetailRow label="Field">{fieldBookedLabel(event.status)}</DetailRow>
          <DetailRow label="Minimum">{event.minPlayers} players</DetailRow>
          {event.maxPlayers != null && <DetailRow label="Maximum">{event.maxPlayers} players</DetailRow>}
          <DetailRow label="Payment">{event.paymentMode === "prepaid" ? "Pre-paid" : "Post-paid"}</DetailRow>
          <DetailRow label="Headcount">
            {headcount} going
            {approvedGuests.length > 0
              ? ` · ${going.length} player${going.length === 1 ? "" : "s"} · ${approvedGuests.length} guest${approvedGuests.length === 1 ? "" : "s"}`
              : ""}
            {waitRows.length > 0 ? ` · ${waitRows.length} waitlisted` : ""}
          </DetailRow>
          <DetailRow label="Collector">{collector}</DetailRow>
          <DetailRow label="Cost">
            {event.totalCostCents != null
              ? formatMoney(event.totalCostCents, community.currency)
              : "Not set yet"}
            {event.paymentRequestedAt ? " · requests sent" : ""}
          </DetailRow>
          {event.paymentInfo && <DetailRow label="Pay">{event.paymentInfo}</DetailRow>}
          {event.totalCostCents != null && (
            <DetailRow label="Split among">
              {going.length} player{going.length === 1 ? "" : "s"}
              {approvedGuests.length ? ` · ${approvedGuests.length} guest${approvedGuests.length === 1 ? "" : "s"}` : ""}
            </DetailRow>
          )}
        </dl>
      </div>

      {event.status !== "polling" && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <h3 className="font-display text-lg">People</h3>
          <p className="mt-1 text-sm text-ink/55">
            {headcount} going
            {approvedGuests.length > 0 ? ` · ${approvedGuests.length} guest${approvedGuests.length === 1 ? "" : "s"}` : ""}
            {" · "}
            {notGoing.length} not going
            {deadlinePassed ? (admin ? " · Presence deadline passed (admins can still vote)" : " · Presence is locked") : ""}
            {pendingGuests.length > 0
              ? ` · ${pendingGuests.length} guest request${pendingGuests.length === 1 ? "" : "s"}`
              : ""}
          </p>
          {(canVote || myRsvp) && (
            <div className="mt-4">
              <PresenceVote
                eventId={event.id}
                myStatus={myRsvp?.rsvp.status}
                goingCount={headcount}
                notGoingCount={notGoing.length}
                canVote={canVote}
                pendingCancel={Boolean(
                  userId && pendingCancel.some((r) => r.userId === userId),
                )}
              />
            </div>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-secondary">Going · {going.length}</p>
              <ul className="mt-1 space-y-1 text-sm">
                {going.length === 0 && <li className="text-ink/45">No one yet.</li>}
                {going.map(({ user }) => (
                  <li key={user.id} className="flex items-center gap-2 py-0.5">
                    <Avatar src={user.imageUrl} name={user.name} size="xs" />
                    <span className="truncate">{user.name}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-secondary">Not going · {notGoing.length}</p>
              <ul className="mt-1 space-y-1 text-sm">
                {notGoing.length === 0 && <li className="text-ink/45">No one yet.</li>}
                {notGoing.map(({ user }) => (
                  <li key={user.id} className="flex items-center gap-2 py-0.5">
                    <Avatar src={user.imageUrl} name={user.name} size="xs" />
                    <span className="truncate">{user.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <NonVotersToggle people={nonVoters} />
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
            {canAddGuest && <GuestForm eventId={event.id} />}
          </div>
        </div>
      )}

      <PresenceCancelPanel
        pending={pendingCancel}
        timezone={community.timezone}
        canDecide={admin}
        userId={userId}
        minPlayers={event.minPlayers}
      />

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

      {waitRows.length > 0 && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <h3 className="font-display text-lg">Waitlist · {waitRows.length}</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {waitRows
              .sort((a, b) => a.createdAt - b.createdAt)
              .map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-2">
                  <span>{nameOf(w.userId)}</span>
                  {admin && (
                    <form
                      action={async () => {
                        "use server";
                        const fd = new FormData();
                        fd.set("eventId", event.id);
                        fd.set("userId", w.userId);
                        await promoteWaitlistMember(fd);
                      }}
                    >
                      <SubmitButton size="sm" variant="ghost">
                        Promote
                      </SubmitButton>
                    </form>
                  )}
                </li>
              ))}
          </ul>
          {myWaitlisted && <p className="mt-2 text-sm text-ink/55">You are on the waitlist for this session.</p>}
        </div>
      )}

      {showCost && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <EventCostPanel
            eventId={event.id}
            currency={community.currency}
            paymentMode={event.paymentMode}
            totalCostCents={event.totalCostCents}
            collectorUserId={event.collectorUserId}
            paymentRequestedAt={event.paymentRequestedAt}
            status={event.status}
            members={members}
            initialAttendeeIds={going.map((g) => g.user.id)}
            shares={shareRows}
            currentUserId={userId ?? null}
            isAdmin={admin}
            allSettled={allSettled}
            canSendPrepaid={canSendPrepaid || (event.paymentMode === "prepaid" && event.status === "booked")}
            canSendPostpaid={
              event.paymentMode !== "prepaid" && (ended || ["booked", "ready_to_book", "open", "completed"].includes(event.status))
            }
          />
        </div>
      )}
    </PageFrame>
  );
}
