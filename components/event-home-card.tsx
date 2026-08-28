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
  guests?: { id: string; label: string; hostName: string; canRemove: boolean }[];
}) {
  const href = `/app/c/${slug}/events/${eventId}`;

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-[0_8px_24px_rgba(63,58,52,0.06)]">
      <div className="flex items-start gap-4">
        <DateTile ms={startsAt} timeZone={timeZone} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.18em] text-primary">Session</p>
              <Link href={href} className="mt-1 block font-display text-lg leading-tight hover:text-primary">
                {title}
              </Link>
              <p className="mt-1 text-sm text-ink/55">
                {formatEventTimeLine(startsAt, timeZone, hasTime, durationMinutes)}
                {location ? ` · ${location}` : ""}
              </p>
              <p className="mt-1 text-xs text-ink/45">
                {headcount} going · min {minPlayers}
                {myStatus === "going" ? " · You are in" : myStatus === "not_going" ? " · You are out" : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-start gap-1">
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
        <div className="mt-3">
          <PresenceVote
            eventId={eventId}
            myStatus={myStatus}
            goingCount={goingCount}
            notGoingCount={notGoingCount}
            canVote={canVote}
          />
        </div>
      )}
    </div>
  );
}
