"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

export function ProfileSection({
  title,
  id,
  defaultOpen = false,
  children,
}: {
  title: string;
  id?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="mt-6 scroll-mt-24" id={id}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <h2 className="font-display text-lg">{title}</h2>
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 text-ink/45 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </Card>
  );
}
