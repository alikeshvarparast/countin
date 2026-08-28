"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function Avatar({
  src,
  name,
  size = "md",
}: {
  src?: string | null;
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  const initial = (name.trim()[0] || "?").toUpperCase();
  const box =
    size === "xl"
      ? "h-24 w-24 text-3xl"
      : size === "lg"
        ? "h-16 w-16 text-xl"
        : size === "xs"
          ? "h-7 w-7 text-[10px]"
          : size === "sm"
            ? "h-8 w-8 text-xs"
            : "h-11 w-11 text-sm";
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={cn("shrink-0 rounded-full object-cover bg-pitch-3 ring-2 ring-card", box)}
        key={src}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-pitch-3 font-display font-medium text-ink ring-2 ring-card",
        box,
      )}
      aria-hidden
    >
      {initial}
    </span>
  );
}
