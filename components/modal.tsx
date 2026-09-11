"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

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
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center p-4 pb-[calc(env(safe-area-inset-bottom)+4.75rem)] sm:items-center sm:pb-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
    >
      <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[min(85dvh,calc(100dvh-env(safe-area-inset-bottom)-5.5rem))] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-card p-5 shadow-[0_24px_64px_rgba(63,58,52,0.2)]">
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
    </div>,
    document.body,
  );
}
