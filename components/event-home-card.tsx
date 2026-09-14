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
  canClosePresence,
  lockOptions,
  guestCount,
  pendingGuests = 0,
  needsVote,
  collapseChoices,
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
  canClosePresence?: boolean;
  lockOptions?: { id: string; label: string }[];
  guestCount: number;
  pendingGuests?: number;
  needsVote?: boolean;
  collapseChoices?: boolean;
}) {
  const href = `/app/c/${slug}/events/${eventId}`;
  const requests = pendingGuests > 0 ? `${pendingGuests} guest request${pendingGuests === 1 ? "" : "s"}` : "";
  const highlight = Boolean(needsVote);

  return (
    <div
      className={cn(
        "motion-press flex h-full flex-col rounded-2xl border bg-card px-3 py-3 shadow-[0_8px_24px_rgba(63,58,52,0.06)]",
        highlight
          ? "vote-needs-reply border-warn/45 bg-[color:var(--color-warn-wash)] shadow-[0_10px_28px_rgba(180,83,9,0.14)]"
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
              {highlight && (
                <p className="mt-1 text-xs font-medium text-warn">
                  {collapseChoices
                    ? "Not answered — tap Change presence to reply"
                    : "Your presence reply is needed"}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {collapseChoices && (
                <Badge
                  tone={
                    myStatus === "going" ? "lime" : myStatus === "not_going" ? "clay" : "line"
                  }
                >
                  {myStatus === "going"
                    ? "Going"
                    : myStatus === "not_going"
                      ? "Not going"
                      : "Not answered"}
                </Badge>
              )}
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
                canClosePresence={canClosePresence}
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
            collapseChoices={collapseChoices}
          />
        </div>
      )}
    </div>
  );
}
