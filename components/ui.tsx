import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "cream";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition disabled:opacity-50",
        variant === "primary" && "bg-lime text-pitch hover:bg-lime-2",
        variant === "cream" && "bg-cream text-pitch hover:bg-white",
        variant === "ghost" && "border border-line text-cream hover:bg-pitch-3",
        variant === "danger" && "bg-clay text-pitch hover:opacity-90",
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
        "w-full rounded-xl border border-line bg-pitch-2 px-3 py-2.5 text-cream outline-none placeholder:text-cream/40 focus:border-lime/60",
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
        "w-full rounded-xl border border-line bg-pitch-2 px-3 py-2.5 text-cream outline-none placeholder:text-cream/40 focus:border-lime/60",
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
        "w-full rounded-xl border border-line bg-pitch-2 px-3 py-2.5 text-cream outline-none focus:border-lime/60",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-xs uppercase tracking-wider text-cream/60", className)} {...props} />;
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border border-line bg-pitch-2/80 p-5", className)}>{children}</div>
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
        tone === "line" && "border border-line text-cream/80",
        tone === "lime" && "bg-lime text-pitch",
        tone === "clay" && "bg-clay text-pitch",
        tone === "cream" && "bg-cream/15 text-cream",
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
