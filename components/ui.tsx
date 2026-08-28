import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "cream";
  size?: "md" | "sm";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium transition disabled:opacity-50",
        size === "md" && "min-h-11 px-4 py-2 text-sm",
        size === "sm" && "min-h-8 px-3 py-1 text-sm",
        variant === "primary" && "bg-primary text-ink hover:bg-primary-2",
        variant === "cream" && "bg-secondary text-ink hover:opacity-90",
        variant === "ghost" && "border border-line text-ink hover:bg-pitch-3",
        variant === "danger" && "bg-secondary text-ink hover:opacity-90",
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-line bg-card px-3 py-2.5 text-ink outline-none placeholder:text-ink/40 focus:border-primary/60",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-line bg-card px-3 py-2.5 text-ink outline-none placeholder:text-ink/40 focus:border-primary/60",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-xl border border-line bg-card px-3 py-2.5 text-ink outline-none focus:border-primary/60",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-xs uppercase tracking-wider text-secondary", className)} {...props} />;
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border border-line bg-card p-5", className)}>{children}</div>
  );
}

export function Badge({
  children,
  tone = "line",
}: {
  children: ReactNode;
  tone?: "line" | "lime" | "clay" | "cream";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        tone === "line" && "border border-line text-ink/80",
        tone === "lime" && "bg-primary/20 text-ink",
        tone === "clay" && "bg-secondary/20 text-ink",
        tone === "cream" && "bg-secondary/15 text-ink",
      )}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function Modal({
  title,
  eyebrow,
  titleId,
  onClose,
  children,
}: {
  title: string;
  eyebrow?: string;
  titleId?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const headingId = titleId ?? "modal-title";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby={headingId}>
      <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-card p-5 shadow-[0_24px_64px_rgba(63,58,52,0.2)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <p className="text-xs uppercase tracking-[0.18em] text-secondary">{eyebrow}</p>}
            <h4 id={headingId} className="mt-1 font-display text-lg">
              {title}
            </h4>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink/60 hover:bg-muted hover:text-ink"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
