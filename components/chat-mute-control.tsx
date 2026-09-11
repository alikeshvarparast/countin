"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { BellOff, BellRing } from "lucide-react";
import { getChatMuted, setChatMuted } from "@/lib/actions/club";

function chatSlugFromPath(pathname: string) {
  const match = pathname.match(/^\/app\/c\/([^/]+)\/chat\/?$/);
  return match?.[1] ?? null;
}

export function ChatMuteControl() {
  const pathname = usePathname();
  const slug = chatSlugFromPath(pathname);
  const [muted, setMuted] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!slug) {
      setMuted(null);
      return;
    }
    let cancelled = false;
    void getChatMuted(slug).then((value) => {
      if (!cancelled) setMuted(value);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!slug || muted === null) return null;

  return (
    <button
      type="button"
      className={
        muted
          ? "relative flex h-11 w-11 items-center justify-center rounded-full text-primary hover:text-ink disabled:opacity-60 md:h-auto md:w-auto md:p-0"
          : "relative flex h-11 w-11 items-center justify-center rounded-full text-ink/70 hover:text-ink disabled:opacity-60 md:h-auto md:w-auto md:p-0"
      }
      aria-label={muted ? "Unmute chat notifications" : "Mute chat notifications"}
      title={muted ? "Chat muted — unread counts stay, no phone alerts" : "Mute chat alerts"}
      disabled={pending}
      onClick={() => {
        const next = !muted;
        setMuted(next);
        startTransition(async () => {
          const result = await setChatMuted(slug, next);
          if (result.error) setMuted(!next);
        });
      }}
    >
      {muted ? <BellOff className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
    </button>
  );
}
