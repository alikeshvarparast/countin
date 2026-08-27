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

export const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
