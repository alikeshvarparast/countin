import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export { Modal } from "@/components/modal";

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
        variant === "primary" &&
          "bg-primary text-ink shadow-[0_6px_16px_rgba(47,107,79,0.22)] hover:bg-primary-2",
        variant === "cream" && "bg-secondary text-ink hover:opacity-90",
        variant === "ghost" && "border border-line text-ink hover:border-primary/35 hover:bg-pitch-3",
        variant === "danger" && "bg-secondary text-ink hover:opacity-90",
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, type, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const temporal = type === "date" || type === "time" || type === "datetime-local" || type === "month" || type === "week";
  return (
    <input
      type={type}
      className={cn(
        "h-11 w-full min-w-0 max-w-full rounded-xl border border-line bg-card px-3 text-ink outline-none placeholder:text-ink/40 focus:border-primary/60",
        temporal ? "py-0" : "py-2.5",
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
        "h-11 w-full min-w-0 max-w-full rounded-xl border border-line bg-card px-3 text-ink outline-none focus:border-primary/60",
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
  id,
}: {
  className?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <div id={id} className={cn("min-w-0 overflow-x-hidden rounded-2xl border border-line bg-card p-5", className)}>
      {children}
    </div>
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
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="mt-1 text-xs text-ink/45">{hint}</p> : null}
    </div>
  );
}
