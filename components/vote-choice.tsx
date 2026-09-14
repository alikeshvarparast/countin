"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function VoteOptionButton({
  active,
  disabled,
  onClick,
  label,
  detail,
  className,
}: {
  active: boolean;
  disabled?: boolean;
  onClick?: () => void;
  label: string;
  detail?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "vote-option relative flex w-full items-center gap-3 overflow-hidden rounded-xl border px-3 py-3 text-left text-sm font-medium",
        active
          ? "vote-option-selected border-primary/60 bg-primary/15 text-ink shadow-[0_8px_20px_rgba(47,107,79,0.16)]"
          : "border-line bg-card text-ink/70 hover:border-primary/40 hover:bg-primary/[0.04] hover:text-ink",
        disabled && !active && "opacity-55",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[0]",
          active ? "border-primary bg-primary text-on-primary" : "border-line bg-muted",
        )}
        aria-hidden
      >
        {active ? <Check className="vote-check h-3 w-3" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words">{label}</span>
        {detail ? <span className="mt-0.5 block text-xs font-normal text-ink/45">{detail}</span> : null}
      </span>
    </button>
  );
}

export function VoteSegmented({
  options,
  value,
  onChange,
  disabled,
  className,
}: {
  options: { id: string; label: string; detail?: string }[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-1 rounded-2xl bg-muted p-1",
        options.length === 2 ? "grid-cols-2" : "grid-cols-1",
        className,
      )}
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            className={cn(
              "vote-option rounded-xl px-3 py-2.5 text-sm font-medium",
              active
                ? "vote-option-selected bg-card text-ink shadow-sm ring-1 ring-primary/40"
                : "text-ink/60 hover:bg-card/70 hover:text-ink",
              disabled && !active && "opacity-55",
            )}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              {active ? <Check className="vote-check h-3.5 w-3.5 text-primary" strokeWidth={3} /> : null}
              <span>
                {opt.label}
                {opt.detail ? ` · ${opt.detail}` : ""}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function VoteNeedsFrame({
  needsReply,
  children,
  className,
}: {
  needsReply: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(needsReply && "vote-needs-reply rounded-2xl", className)}>{children}</div>
  );
}
