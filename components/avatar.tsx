"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function firstInitial(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  try {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    const first = seg.segment(trimmed)[Symbol.iterator]().next().value as { segment: string } | undefined;
    if (first?.segment) return first.segment.toLocaleUpperCase();
  } catch {
    /* older runtimes */
  }
  return trimmed[0]!.toLocaleUpperCase();
}

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
  const initial = firstInitial(name);
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
        // font-sans (not display) so Latin and Persian initials match in weight/size
        "inline-flex shrink-0 items-center justify-center rounded-full bg-pitch-3 font-sans font-semibold text-ink ring-2 ring-card",
        box,
      )}
      aria-hidden
    >
      {initial}
    </span>
  );
}
