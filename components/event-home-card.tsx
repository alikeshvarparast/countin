"use client";

import Link from "next/link";
import { DateTile } from "@/components/event-card";
import { EventMenu } from "@/components/event-menu";
import { PresenceVote } from "@/components/presence-vote";
import { Badge } from "@/components/ui";
import { formatEventTimeLine } from "@/lib/utils";

export function EventHomeCard({
  slug,
  eventId,
  title,
  startsAt,
  timeZone,
  location,
  status,
  hasTime,
  durationMinutes,
  goingCount,
  notGoingCount,
  headcount,
  minPlayers,
  myStatus,
  canVote,
  canAddGuest,
  isAdmin,
  canPostCost,
  canBook,
  canCancel,
  lockOptions,
  collectorName,
  totalCostCents,
  paymentInfo,
  currency,
  guestCount,
  guests,
  pendingGuests = 0,
}: {
  slug: string;
  eventId: string;
  title: string;
  startsAt?: number | null;
  timeZone: string;
  location?: string | null;
  status?: string;
  hasTime?: boolean | null;
  durationMinutes?: number | null;
  goingCount: number;
  notGoingCount: number;
  headcount: number;
  minPlayers: number;
  myStatus?: string | null;
  canVote: boolean;
  canAddGuest: boolean;
  isAdmin?: boolean;
  canPostCost: boolean;
  canBook: boolean;
  canCancel: boolean;
  lockOptions?: { id: string; label: string }[];
  collectorName?: string;
  totalCostCents?: number | null;
  paymentInfo?: string | null;
  currency: string;
  guestCount: number;
  guests?: { id: string; label: string; hostName: string; canRemove: boolean; status?: string }[];
  pendingGuests?: number;
}) {
  const href = `/app/c/${slug}/events/${eventId}`;
  const requests = pendingGuests > 0 ? `${pendingGuests} guest request${pendingGuests === 1 ? "" : "s"}` : "";

  return (
    <div className="flex h-full flex-col rounded-2xl border border-line bg-card px-3 py-3 shadow-[0_8px_24px_rgba(63,58,52,0.06)]">
      <div className="flex items-center gap-3">
        <DateTile ms={startsAt} timeZone={timeZone} compact />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <Link href={href} className="block truncate text-sm font-medium leading-tight hover:text-primary">
                {title}
              </Link>
              <p className="truncate text-xs text-ink/50">
                {formatEventTimeLine(startsAt, timeZone, hasTime, durationMinutes)}
                {location ? ` · ${location}` : ""}
                {` · ${headcount} going`}
                {guestCount > 0 ? ` · ${guestCount} guest${guestCount === 1 ? "" : "s"}` : ""}
                {myStatus === "going" ? " · You are in" : myStatus === "not_going" ? " · You are out" : ""}
                {requests ? ` · ${requests}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {requests ? <Badge tone="clay">{requests}</Badge> : null}
              {status && <Badge>{status.replaceAll("_", " ")}</Badge>}
              <EventMenu
                slug={slug}
                eventId={eventId}
                title={title}
                currency={currency}
                canVote={canVote}
                myStatus={myStatus}
                canAddGuest={canAddGuest}
                isAdmin={isAdmin}
                canPostCost={canPostCost}
                canBook={canBook}
                canCancel={canCancel}
                lockOptions={lockOptions}
                collectorName={collectorName}
                totalCostCents={totalCostCents}
                paymentInfo={paymentInfo}
                goingCount={goingCount}
                notGoingCount={notGoingCount}
                guestCount={guestCount}
                guests={guests}
              />
            </div>
          </div>
        </div>
      </div>

      {status !== "polling" && (
        <div className="mt-auto pt-2">
          <PresenceVote
            eventId={eventId}
            myStatus={myStatus}
            goingCount={headcount}
            notGoingCount={notGoingCount}
            canVote={canVote}
          />
        </div>
      )}
    </div>
  );
}
