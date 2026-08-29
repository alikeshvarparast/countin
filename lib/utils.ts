import { zonedDateTimeToUtcMs } from "@/lib/timezone";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "club";
}

export const TIMEZONES = [
  "America/Toronto",
  "America/Vancouver",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Istanbul",
  "Asia/Tehran",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
  "UTC",
] as const;

export const CURRENCIES = ["CAD", "USD", "EUR", "GBP", "IRR"] as const;

export function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function formatWhen(ms: number | null | undefined, timeZone?: string) {
  if (!ms) return "TBD";
  return new Intl.DateTimeFormat("en", {
    timeZone: timeZone || "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

export function fieldBookedLabel(status: string) {
  switch (status) {
    case "booked":
      return "Field booked";
    case "ready_to_book":
      return "Ready to book";
    case "open":
      return "Field not booked yet";
    case "polling":
      return "Time not locked yet";
    case "cancelled":
      return "Cancelled";
    case "scheduled":
      return "Scheduled";
    default:
      return status.replaceAll("_", " ");
  }
}

export function formatDuration(minutes: number | null | undefined) {
  if (!minutes || minutes < 1) return "";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return hours === 1 ? "1 hour" : `${hours} hours`;
  return `${mins} min`;
}

export function hasClockTime(hasTime: boolean | number | null | undefined) {
  return hasTime !== false && hasTime !== 0;
}

export function formatEventWhen(
  ms: number | null | undefined,
  timeZone?: string,
  hasTime: boolean | number | null | undefined = true,
  durationMinutes?: number | null,
) {
  if (!ms) return "TBD";
  const date = new Intl.DateTimeFormat("en", {
    timeZone: timeZone || "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(ms));
  const duration = formatDuration(durationMinutes);
  if (!hasClockTime(hasTime)) {
    return duration ? `${date} · ${duration} · time TBD` : `${date} · time TBD`;
  }
  const start = formatTime(ms, timeZone);
  if (durationMinutes && durationMinutes > 0) {
    const end = formatTime(ms + durationMinutes * 60 * 1000, timeZone);
    return `${date} · ${start}–${end}`;
  }
  return `${date} · ${start}`;
}

export function eventWindowEnd(event: {
  startsAt: number | null;
  hasTime?: boolean | number | null;
  durationMinutes?: number | null;
}) {
  if (!event.startsAt) return null;
  if (!hasClockTime(event.hasTime)) return event.startsAt + 24 * 60 * 60 * 1000;
  return event.startsAt + (event.durationMinutes ?? 120) * 60 * 1000;
}

export function parseDurationMinutes(hoursRaw: unknown, minutesRaw: unknown) {
  const hours = Number(hoursRaw ?? 0);
  const minutes = Number(minutesRaw ?? 0);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || minutes < 0) return null;
  const total = Math.round(hours) * 60 + Math.round(minutes);
  if (total < 1 || total > 12 * 60) return null;
  return total;
}

export function eventStartFromParts(dateYmd: string, timeHm: string, timeZone: string) {
  const date = dateYmd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const time = timeHm.trim();
  const timeMatch = time.match(/^(\d{2}:\d{2})(?::\d{2})?$/);
  const hasTime = Boolean(timeMatch);
  const clock = timeMatch?.[1] ?? "00:00";
  return {
    startsAt: zonedDateTimeToUtcMs(date, clock, timeZone),
    hasTime,
  };
}

export function formatEventTimeLine(
  startsAt: number | null | undefined,
  timeZone?: string,
  hasTime: boolean | number | null | undefined = true,
  durationMinutes?: number | null,
) {
  if (!startsAt) return "Time poll open";
  const duration = formatDuration(durationMinutes);
  if (!hasClockTime(hasTime)) return duration ? `${duration} · time TBD` : "Time TBD";
  const start = formatTime(startsAt, timeZone);
  if (durationMinutes && durationMinutes > 0) {
    return `${start}–${formatTime(startsAt + durationMinutes * 60 * 1000, timeZone)}`;
  }
  return start;
}

export function formatDateParts(ms: number, timeZone?: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timeZone || "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    weekday: get("weekday"),
    month: get("month"),
    day: get("day"),
  };
}

export function formatTime(ms: number | null | undefined, timeZone?: string) {
  if (!ms) return "";
  return new Intl.DateTimeFormat("en", {
    timeZone: timeZone || "UTC",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

export function localInputToMs(value: string) {
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

export function msToLocalInput(ms: number | null | undefined) {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function safeNextPath(raw: unknown) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return "/app";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/app";
  return value;
}

export function pendingRequestLabel(guestPending: number, occasionalPending = 0) {
  const parts: string[] = [];
  if (guestPending > 0) {
    parts.push(`${guestPending} guest request${guestPending === 1 ? "" : "s"}`);
  }
  if (occasionalPending > 0) {
    parts.push(`${occasionalPending} occasional request${occasionalPending === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
