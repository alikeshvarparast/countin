"use client";

import Link from "next/link";
import { DateTile, statusBadgeTone } from "@/components/event-card";
import { EventMenu } from "@/components/event-menu";
import { PresenceVote } from "@/components/presence-vote";
import { Badge } from "@/components/ui";
import { cn, formatEventTimeLine } from "@/lib/utils";

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
  myStatus,
  canVote,
  canAddGuest,
  isAdmin,
  canBook,
  canCancel,
  canEdit,
  lockOptions,
  guestCount,
  pendingGuests = 0,
  needsVote,
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
  myStatus?: string | null;
  canVote: boolean;
  canAddGuest: boolean;
  isAdmin?: boolean;
  canBook: boolean;
  canCancel: boolean;
  canEdit?: boolean;
  lockOptions?: { id: string; label: string }[];
  guestCount: number;
  pendingGuests?: number;
  needsVote?: boolean;
}) {
  const href = `/app/c/${slug}/events/${eventId}`;
  const requests = pendingGuests > 0 ? `${pendingGuests} guest request${pendingGuests === 1 ? "" : "s"}` : "";
  const highlight = Boolean(needsVote);

  return (
    <div
      className={cn(
        "motion-press flex h-full flex-col rounded-2xl border bg-card px-3 py-3 shadow-[0_8px_24px_rgba(63,58,52,0.06)]",
        highlight
          ? "border-warn/35 bg-[color:var(--color-warn-wash)] shadow-[0_10px_28px_rgba(180,83,9,0.1)]"
          : "border-line",
      )}
    >
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
              {status && <Badge tone={statusBadgeTone(status)}>{status.replaceAll("_", " ")}</Badge>}
              <EventMenu
                slug={slug}
                eventId={eventId}
                canVote={canVote}
                canAddGuest={canAddGuest}
                isAdmin={isAdmin}
                canBook={canBook}
                canCancel={canCancel}
                canEdit={canEdit}
                lockOptions={lockOptions}
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
