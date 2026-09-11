import { eachSeasonDate } from "@/lib/timezone";

/** Season contract billing: period payments + last weeks prepaid on installment #1. */

export type SeasonBillingInput = {
  startDate: string;
  endDate: string;
  weekdays: string;
  regularPriceCents: number;
  /** How often players pay, in contract weeks (e.g. 4). */
  paymentPeriodWeeks?: number | null;
  /**
   * How many of the contract's last weeks are collected on the first payment.
   * Example: 12-week contract, pay every 4, lastWeeks=2 →
   *   #1: weeks 1–4 + 11–12, #2: 5–8, #3: 9–10.
   */
  firstPaymentLastWeeks?: number | null;
  /** Legacy: sessions per period. Used only if paymentPeriodWeeks is unset. */
  prepaidSessionCount?: number | null;
};

export type SeasonPaymentInstallment = {
  index: number;
  /** 1-based week numbers covered by this installment. */
  weeks: number[];
  weekCount: number;
  sessionCount: number;
  amountCents: number;
  label: string;
};

function parseWeekdays(weekdaysJson: string) {
  try {
    const days = JSON.parse(weekdaysJson) as number[];
    return Array.isArray(days) ? days.filter((d) => d >= 0 && d <= 6) : [];
  } catch {
    return [];
  }
}

export function seasonNightsPerWeek(weekdaysJson: string) {
  const days = parseWeekdays(weekdaysJson);
  return days.length > 0 ? days.length : 1;
}

/**
 * Number of contract weeks from the season calendar.
 * Uses playing nights ÷ nights-per-week so a 12-night weekly season is 12 weeks.
 */
export function seasonContractWeeks(season: Pick<SeasonBillingInput, "startDate" | "endDate" | "weekdays">) {
  const weekdays = parseWeekdays(season.weekdays);
  if (weekdays.length === 0) return null;
  const dates = eachSeasonDate(season.startDate, season.endDate, weekdays);
  if (dates.length === 0) return null;
  return Math.max(1, Math.ceil(dates.length / weekdays.length));
}

export function seasonPaymentPeriodWeeks(season: SeasonBillingInput) {
  if (season.paymentPeriodWeeks != null && season.paymentPeriodWeeks > 0) {
    return Math.round(season.paymentPeriodWeeks);
  }
  // Legacy: sessions-per-period → weeks via nights/week.
  if (season.prepaidSessionCount != null && season.prepaidSessionCount > 0) {
    const nights = seasonNightsPerWeek(season.weekdays);
    return Math.max(1, Math.round(season.prepaidSessionCount / nights));
  }
  return null;
}

function formatWeekRanges(weeks: number[]) {
  if (weeks.length === 0) return "";
  const ranges: string[] = [];
  let start = weeks[0]!;
  let prev = weeks[0]!;
  for (let i = 1; i < weeks.length; i++) {
    const w = weeks[i]!;
    if (w === prev + 1) {
      prev = w;
      continue;
    }
    ranges.push(start === prev ? `week ${start}` : `weeks ${start}–${prev}`);
    start = w;
    prev = w;
  }
  ranges.push(start === prev ? `week ${start}` : `weeks ${start}–${prev}`);
  return ranges.join(" + ");
}

/**
 * Build the full installment schedule.
 * Last N weeks of the contract are attached to payment #1 and removed from the end.
 */
export function buildSeasonPaymentSchedule(season: SeasonBillingInput): SeasonPaymentInstallment[] | null {
  const totalWeeks = seasonContractWeeks(season);
  const periodWeeks = seasonPaymentPeriodWeeks(season);
  if (totalWeeks == null || periodWeeks == null || !season.regularPriceCents) return null;

  const lastWeeks = Math.max(0, Math.min(Math.round(season.firstPaymentLastWeeks ?? 0), totalWeeks));
  if (lastWeeks >= totalWeeks) return null;

  const nightsPerWeek = seasonNightsPerWeek(season.weekdays);
  const coreWeeks = totalWeeks - lastWeeks;
  const prepaidTail =
    lastWeeks > 0 ? Array.from({ length: lastWeeks }, (_, i) => totalWeeks - lastWeeks + 1 + i) : [];

  const installments: SeasonPaymentInstallment[] = [];
  let cursor = 1;
  let index = 1;
  while (cursor <= coreWeeks) {
    const end = Math.min(cursor + periodWeeks - 1, coreWeeks);
    const body = Array.from({ length: end - cursor + 1 }, (_, i) => cursor + i);
    const weeks = index === 1 ? [...body, ...prepaidTail] : body;
    const weekCount = weeks.length;
    const sessionCount = weekCount * nightsPerWeek;
    installments.push({
      index,
      weeks,
      weekCount,
      sessionCount,
      amountCents: sessionCount * season.regularPriceCents,
      label: formatWeekRanges(weeks),
    });
    cursor = end + 1;
    index += 1;
  }

  return installments;
}

export function seasonFirstPaymentAmountCents(season: SeasonBillingInput) {
  return buildSeasonPaymentSchedule(season)?.[0]?.amountCents ?? null;
}

export function seasonFirstPaymentSessionCount(season: SeasonBillingInput) {
  return buildSeasonPaymentSchedule(season)?.[0]?.sessionCount ?? null;
}

/** @deprecated use schedule; kept for call sites that only need the first installment nights. */
export function seasonFirstPaymentExtraSessions(season: SeasonBillingInput) {
  const schedule = buildSeasonPaymentSchedule(season);
  if (!schedule?.[0]) return 0;
  const periodWeeks = seasonPaymentPeriodWeeks(season) ?? 0;
  const nights = seasonNightsPerWeek(season.weekdays);
  const firstBodySessions = Math.min(periodWeeks, schedule[0].weekCount) * nights;
  return Math.max(0, schedule[0].sessionCount - firstBodySessions);
}

export function seasonLaterPaymentAmountCents(season: SeasonBillingInput) {
  const schedule = buildSeasonPaymentSchedule(season);
  if (!schedule || schedule.length < 2) return null;
  // Prefer a full middle period when present; otherwise the next installment.
  const full = schedule.find((row, i) => i > 0 && row.weekCount === (seasonPaymentPeriodWeeks(season) ?? -1));
  return (full ?? schedule[1])?.amountCents ?? null;
}

export function sessionsFromPaymentPeriodWeeks(weekdaysJson: string, periodWeeks: number) {
  return Math.max(1, Math.round(periodWeeks)) * seasonNightsPerWeek(weekdaysJson);
}
