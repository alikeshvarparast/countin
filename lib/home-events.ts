import { eventWindowEnd } from "@/lib/utils";

export type HomeBucket = "express" | "action" | "upcoming" | "future" | "past" | "skip";

export type HomeEventLike = {
  id: string;
  status: string;
  startsAt: number | null;
  hasTime?: boolean | number | null;
  durationMinutes?: number | null;
  rsvpDeadlineAt?: number | null;
  paymentRequestedAt?: number | null;
  totalCostCents?: number | null;
};

export function presenceVotingClosed(event: HomeEventLike, now: number) {
  return Boolean(event.rsvpDeadlineAt && now > event.rsvpDeadlineAt);
}

export function eventWindowEnded(event: HomeEventLike, now: number) {
  if (!event.startsAt) return false;
  return (eventWindowEnd(event) ?? event.startsAt) < now;
}

export function isBookedField(event: HomeEventLike) {
  return event.status === "booked";
}

export function canPresenceRsvp(event: HomeEventLike) {
  return ["open", "ready_to_book", "booked"].includes(event.status);
}

/** Event still needs admin cost/share finalize (or booking after vote closed). */
export function needsStaffAction(event: HomeEventLike, now: number): boolean {
  if (event.status === "cancelled" || event.status === "completed") return false;
  if (event.status === "polling") return false;

  const ended = eventWindowEnded(event, now);
  const closed = presenceVotingClosed(event, now);
  const booked = isBookedField(event);

  if (ended) {
    // Finished nights stay in Action needed until marked completed.
    return true;
  }

  // Voting finished but field not booked.
  if (closed && !booked && ["open", "ready_to_book"].includes(event.status)) {
    return true;
  }

  return false;
}

/**
 * Home section for a one-night weekly event (not polls).
 * Season sessions are handled separately on the page.
 */
export function homeBucket(
  event: HomeEventLike,
  opts: {
    now: number;
    hasVote: boolean;
    weekMs: number;
  },
): HomeBucket {
  const { now, hasVote, weekMs } = opts;

  if (event.status === "polling") return "skip";
  if (event.status === "cancelled") return "past";
  if (event.status === "completed") return "past";

  if (needsStaffAction(event, now)) return "action";

  if (!canPresenceRsvp(event)) return "skip";

  const closed = presenceVotingClosed(event, now);
  const booked = isBookedField(event);

  if (!closed) {
    if (!booked) return "express";
    if (!hasVote) return "express";
  } else if (!booked) {
    return "action";
  }

  // Booked + (voted while open, or voting closed for everyone)
  const soon = Boolean(event.startsAt && event.startsAt <= now + weekMs);
  if (!event.startsAt) return "future";
  return soon ? "upcoming" : "future";
}

/** Derived lifecycle label for badges (not a DB enum). */
export function lifecycleStatusLabel(event: HomeEventLike, now: number, ledgerSettled: boolean) {
  if (event.status === "cancelled") return "cancelled";
  if (event.status === "completed") return "completed";
  const ended = eventWindowEnded(event, now);
  if (ended) {
    if (event.paymentRequestedAt || event.totalCostCents != null || isBookedField(event)) {
      if (event.paymentRequestedAt && ledgerSettled) return "finished";
      return "needs payment";
    }
    return "finished";
  }
  if (isBookedField(event)) return "booked";
  if (presenceVotingClosed(event, now)) return "voting closed";
  if (["open", "ready_to_book"].includes(event.status)) return "voting";
  return event.status.replaceAll("_", " ");
}

export function waitingMeta(event: HomeEventLike, now: number, ledgerSettled = false) {
  if (eventWindowEnded(event, now)) {
    if (event.paymentRequestedAt && !ledgerSettled) {
      return "Waiting for organizers to verify payments";
    }
    if (event.paymentRequestedAt && ledgerSettled) {
      return "Waiting for organizers to close this night";
    }
    return "Waiting for organizers to finalize costs";
  }
  if (presenceVotingClosed(event, now) && !isBookedField(event)) {
    return "Waiting for organizers to book the field";
  }
  return "Waiting on club organizers";
}

/** Clear next step for admins/owners on Action needed cards. */
export function actionNeededNote(event: HomeEventLike, now: number, ledgerSettled = false) {
  const ended = eventWindowEnded(event, now);
  const closed = presenceVotingClosed(event, now);
  const booked = isBookedField(event);

  if (ended) {
    if (!booked && event.totalCostCents == null && !event.paymentRequestedAt) {
      return "Night ended without a booking — cancel it or close it from the event page.";
    }
    if (!event.paymentRequestedAt) {
      return "Set the total cost and send payment shares to members.";
    }
    if (!ledgerSettled) {
      return "Verify payments on the event Cost section or Ledger.";
    }
    return "All shares are settled — mark this night completed.";
  }

  if (closed && !booked) {
    return "Presence voting is closed — book the field, or cancel the night.";
  }

  return "Open the event to finish the next admin step.";
}

