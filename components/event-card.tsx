import Link from "next/link";
import { Badge } from "@/components/ui";
import { formatDateParts, formatEventTimeLine } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function DateTile({
  ms,
  timeZone,
}: {
  ms?: number | null;
  timeZone?: string;
}) {
  if (!ms) {
    return (
      <div className="flex h-16 w-14 flex-col items-center justify-center rounded-2xl bg-pitch-3 text-ink/50">
        <span className="text-[10px] uppercase">TBD</span>
      </div>
    );
  }
  const parts = formatDateParts(ms, timeZone);
  return (
    <div className="flex h-16 w-14 flex-col items-center justify-center rounded-2xl bg-pitch-3 text-ink shadow-sm">
      <span className="text-[10px] font-medium uppercase tracking-wider">{parts.weekday}</span>
      <span className="font-display text-xl leading-none">{parts.day}</span>
      <span className="text-[10px] uppercase">{parts.month}</span>
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
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-2xl border border-line bg-card p-4 shadow-[0_8px_24px_rgba(63,58,52,0.06)] transition hover:-translate-y-0.5 hover:border-primary/30"
    >
      <DateTile ms={startsAt} timeZone={timeZone} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg leading-tight text-ink">{title}</h3>
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            {requests ? <Badge tone="clay">{requests}</Badge> : null}
            {status && <Badge>{status.replaceAll("_", " ")}</Badge>}
          </div>
        </div>
        <p className="mt-1 text-sm text-ink/55">
          {formatEventTimeLine(startsAt, timeZone, hasTime, durationMinutes)}
          {location ? ` · ${location}` : ""}
        </p>
        {meta && <p className="mt-1 text-xs text-ink/45">{meta}</p>}
        {requests ? <p className="mt-1 text-xs text-clay">{requests} waiting for approval</p> : null}
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
