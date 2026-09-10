"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui";
import {
  enablePushNotifications,
  isStandaloneDisplay,
  pushSupported,
  registerPushWorker,
  syncAppBadge,
} from "@/lib/pwa-client";

const DISMISS_KEY = "countin-push-prompt";

export function PwaShell() {
  const pathname = usePathname();
  const [prompt, setPrompt] = useState<"hidden" | "install" | "enable">("hidden");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void registerPushWorker();
  }, []);

  useEffect(() => {
    void syncAppBadge();
    const onFocus = () => {
      void syncAppBadge();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void syncAppBadge();
    }, 45_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.clearInterval(timer);
    };
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!pushSupported() || localStorage.getItem(DISMISS_KEY) === "1") return;
      if (pathname.startsWith("/login") || pathname.startsWith("/register")) return;
      const badge = await fetch("/api/push/badge", { cache: "no-store" });
      if (cancelled || badge.status !== 200) return;
      if (Notification.permission === "denied") return;
      if (Notification.permission === "granted") {
        void enablePushNotifications();
        return;
      }
      const standalone = isStandaloneDisplay();
      if (!standalone && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        setPrompt("install");
        return;
      }
      setPrompt("enable");
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (prompt === "hidden") return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] z-40 px-4 lg:bottom-4">
      <div className="mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-line bg-card p-3 shadow-[0_12px_40px_rgba(63,58,52,0.12)]">
        <div className="min-w-0 flex-1 text-sm text-ink">
          {prompt === "install" ? (
            <p>Add CountIn to your Home Screen, then open it from there to get alerts and an unread badge.</p>
          ) : (
            <p>Turn on notifications to see messages and invitations on this phone.</p>
          )}
          {prompt === "enable" && (
            <Button
              type="button"
              size="sm"
              className="mt-2"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void enablePushNotifications().then((result) => {
                  setBusy(false);
                  if (!("error" in result && result.error)) setPrompt("hidden");
                });
              }}
            >
              {busy ? "Enabling…" : "Enable"}
            </Button>
          )}
        </div>
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink/45 hover:bg-muted hover:text-ink"
          aria-label="Dismiss"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setPrompt("hidden");
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
