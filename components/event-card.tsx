import Link from "next/link";
import { Badge } from "@/components/ui";
import { formatDateParts, formatEventTimeLine, cn } from "@/lib/utils";

export function statusBadgeTone(status?: string | null): "line" | "lime" | "clay" | "cream" {
  if (!status) return "line";
  const s = status.toLowerCase();
  if (s.includes("vote") || s.includes("poll") || s.includes("agreement") || s === "signup") return "clay";
  if (
    s === "booked" ||
    s === "open" ||
    s === "ready_to_book" ||
    s === "scheduled" ||
    s === "locked" ||
    s === "voting"
  ) {
    return "lime";
  }
  if (s === "needs payment" || s === "voting closed" || s === "finished") return "clay";
  if (s === "completed" || s === "cancelled") return "line";
  return "cream";
}

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
      <div
        className={cn(
          "flex shrink-0 flex-col items-center justify-center border border-dashed border-line bg-pitch-3/80 text-ink/45",
          box,
        )}
      >
        <span className="uppercase">TBD</span>
      </div>
    );
  }
  const parts = formatDateParts(ms, timeZone);
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col items-center justify-center bg-primary text-on-primary shadow-[0_6px_16px_rgba(47,107,79,0.28)]",
        box,
      )}
    >
      <span className="font-medium uppercase tracking-wider opacity-90">
        {parts.weekday.slice(0, compact ? 2 : 3)}
      </span>
      <span className={cn("font-display leading-none", compact ? "text-sm" : "text-xl")}>{parts.day}</span>
      {!compact && <span className="uppercase opacity-90">{parts.month}</span>}
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
  note,
  hasTime = true,
  durationMinutes,
  requests,
  emphasize,
  attention,
  myPresence,
}: {
  href: string;
  title: string;
  startsAt?: number | null;
  timeZone?: string;
  location?: string | null;
  status?: string;
  meta?: string;
  /** Primary instruction — shown clearly, not truncated away. */
  note?: string;
  hasTime?: boolean | null;
  durationMinutes?: number | null;
  requests?: string;
  emphasize?: boolean;
  /** Urgent Home treatment: action needed or unanswered vote. */
  attention?: "action" | "vote" | null;
  /** Your reply on this night — shown as a clear badge on Upcoming/Future. */
  myPresence?: "going" | "not_going" | "none" | null;
}) {
  const when = startsAt
    ? `${formatEventTimeLine(startsAt, timeZone, hasTime, durationMinutes)}${location ? ` · ${location}` : ""}`
    : location || "";
  const presenceLabel =
    myPresence === "going"
      ? "Going"
      : myPresence === "not_going"
        ? "Not going"
        : myPresence === "none"
          ? "Not answered"
          : null;
  const presenceTone = myPresence === "going" ? "lime" : myPresence === "not_going" ? "clay" : "line";
  const urgent = Boolean(attention) || Boolean(emphasize);

  return (
    <Link
      href={href}
      className={cn(
        "motion-press flex items-center gap-3 rounded-2xl border bg-card px-3 py-2.5",
        attention === "action" &&
          "vote-needs-reply border-warn/45 bg-[color:var(--color-warn-wash)] shadow-[0_10px_28px_rgba(180,83,9,0.12)]",
        attention === "vote" &&
          "vote-needs-reply border-warn/45 bg-[color:var(--color-warn-wash)] shadow-[0_10px_28px_rgba(180,83,9,0.12)]",
        emphasize && !attention && "vote-needs-reply border-primary/40 shadow-[0_8px_22px_rgba(47,107,79,0.1)]",
        myPresence === "going" && !urgent && "border-primary/25 bg-[color:var(--color-success-wash)]",
        !urgent && !myPresence && "border-line",
      )}
      style={emphasize && !attention ? { backgroundColor: "var(--color-success-wash)" } : undefined}
    >
      <DateTile ms={startsAt} timeZone={timeZone} compact />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          <span className="font-medium text-ink">{title}</span>
          {when && <span className="ml-2 text-ink/45">{when}</span>}
        </p>
        {note && (
          <p className="mt-1 text-xs font-medium leading-snug text-warn line-clamp-3">{note}</p>
        )}
        {meta && <p className="mt-0.5 truncate text-xs text-ink/45">{meta}</p>}
        {requests && !note && (
          <p className="mt-0.5 truncate text-xs text-ink/40">{requests} waiting</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {presenceLabel && <Badge tone={presenceTone}>{presenceLabel}</Badge>}
        <div className="flex items-center gap-1">
          {requests ? <Badge tone="clay">{requests}</Badge> : null}
          {status && <Badge tone={statusBadgeTone(status)}>{status.replaceAll("_", " ")}</Badge>}
        </div>
      </div>
    </Link>
  );
}

export type SectionTone = "vote" | "upcoming" | "future" | "past" | "close" | "default";

const sectionToneClass: Record<SectionTone, string> = {
  vote: "bg-warn",
  upcoming: "bg-primary",
  future: "bg-primary-bright",
  past: "bg-secondary/50",
  close: "bg-clay",
  default: "bg-primary/70",
};

export function SectionTitle({
  children,
  action,
  tone = "default",
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  tone?: SectionTone;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <h2 className="flex items-center gap-2.5 font-display text-xl text-ink">
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", sectionToneClass[tone])} aria-hidden />
        {children}
      </h2>
      {action ? <div className="flex flex-wrap items-center justify-end gap-2">{action}</div> : null}
    </div>
  );
}
