"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export function ActionMenu({
  open,
  onClose,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState({ top: 0, right: 8 });

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const parent = anchorRef.current?.parentElement;
      if (!parent) return;
      const r = parent.getBoundingClientRect();
      setCoords({
        top: r.bottom + 4,
        right: Math.max(8, window.innerWidth - r.right),
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <span ref={anchorRef} className="pointer-events-none absolute h-0 w-0" aria-hidden />
      {mounted &&
        open &&
        createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-ink/35 sm:bg-transparent"
              aria-label="Close menu"
              onClick={onClose}
            />
            <div
              className={cn(
                "fixed z-50 max-h-[min(70dvh,28rem)] overflow-y-auto rounded-2xl border border-line bg-card py-1 text-sm shadow-[0_12px_32px_rgba(63,58,52,0.18)]",
                "inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)]",
                "sm:inset-x-auto sm:bottom-auto sm:top-[var(--menu-top)] sm:right-[var(--menu-right)] sm:w-56",
                className,
              )}
              style={
                {
                  "--menu-top": `${coords.top}px`,
                  "--menu-right": `${coords.right}px`,
                } as CSSProperties
              }
            >
              {children}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
