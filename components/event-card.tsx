import Link from "next/link";
import { Badge } from "@/components/ui";
import { formatDateParts, formatEventTimeLine } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function DateTile({
  ms,
  timeZone,
  compact,
}: {
  ms?: number | null;
  timeZone?: string;
  compact?: boolean;
}) {
  const box = compact
    ? "h-10 w-10 rounded-xl text-[9px]"
    : "h-16 w-14 rounded-2xl text-[10px]";
  if (!ms) {
    return (
      <div className={cn("flex shrink-0 flex-col items-center justify-center bg-pitch-3 text-ink/50", box)}>
        <span className="uppercase">TBD</span>
      </div>
    );
  }
  const parts = formatDateParts(ms, timeZone);
  return (
    <div className={cn("flex shrink-0 flex-col items-center justify-center bg-pitch-3 text-ink shadow-sm", box)}>
      <span className="font-medium uppercase tracking-wider">{parts.weekday.slice(0, compact ? 2 : 3)}</span>
      <span className={cn("font-display leading-none", compact ? "text-sm" : "text-xl")}>{parts.day}</span>
      {!compact && <span className="uppercase">{parts.month}</span>}
    </div>
  );
}

export function EventCard({
  href,
  title,
  startsAt,
  timeZone,
  location,
  status,
  meta,
  hasTime = true,
  durationMinutes,
  requests,
}: {
  href: string;
  title: string;
  startsAt?: number | null;
  timeZone?: string;
  location?: string | null;
  status?: string;
  meta?: string;
  hasTime?: boolean | null;
  durationMinutes?: number | null;
  requests?: string;
}) {
  const when = startsAt
    ? `${formatEventTimeLine(startsAt, timeZone, hasTime, durationMinutes)}${location ? ` · ${location}` : ""}`
    : location || "";
  const extra = [meta, requests ? `${requests} waiting` : ""].filter(Boolean).join(" · ");

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-line bg-card px-3 py-2 hover:border-primary/30"
    >
      <DateTile ms={startsAt} timeZone={timeZone} compact />
      <p className="min-w-0 flex-1 truncate text-sm">
        <span className="font-medium text-ink">{title}</span>
        {when && <span className="ml-2 text-ink/45">{when}</span>}
        {extra && <span className="ml-2 text-ink/40">{extra}</span>}
      </p>
      <div className="flex shrink-0 items-center gap-1">
        {requests ? <Badge tone="clay">{requests}</Badge> : null}
        {status && <Badge>{status.replaceAll("_", " ")}</Badge>}
      </div>
    </Link>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <h2 className="font-display text-xl text-ink">{children}</h2>
      {action ? <div className="flex flex-wrap items-center justify-end gap-2">{action}</div> : null}
    </div>
  );
}
