"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui";
import {
  canPromptInstall,
  enablePushNotifications,
  isStandaloneDisplay,
  promptInstall,
  pushSupported,
  registerAppWorker,
  subscribeInstallPrompt,
  syncAppBadge,
} from "@/lib/pwa-client";

const DISMISS_KEY = "countin-push-prompt";

export function PwaShell() {
  const pathname = usePathname();
  const [prompt, setPrompt] = useState<"hidden" | "install" | "enable">("hidden");
  const [busy, setBusy] = useState(false);
  const [installable, setInstallable] = useState(false);

  useEffect(() => {
    void registerAppWorker();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => root.classList.toggle("standalone", isStandaloneDisplay());
    sync();
    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    setInstallable(canPromptInstall());
    return subscribeInstallPrompt(() => setInstallable(canPromptInstall()));
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
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
      if (pathname.startsWith("/login") || pathname.startsWith("/register")) return;
      const standalone = isStandaloneDisplay();
      if (!standalone && (installable || /iPhone|iPad|iPod/i.test(navigator.userAgent))) {
        setPrompt("install");
        return;
      }
      if (!pushSupported()) return;
      const badge = await fetch("/api/push/badge", { cache: "no-store" });
      if (cancelled || badge.status !== 200) return;
      if (Notification.permission === "denied") return;
      if (Notification.permission === "granted") {
        void enablePushNotifications();
        return;
      }
      setPrompt("enable");
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [pathname, installable]);

  if (prompt === "hidden") return null;

  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] z-40 px-4 lg:bottom-4">
      <div className="mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-line bg-card p-3 shadow-[0_12px_40px_rgba(63,58,52,0.12)]">
        <div className="min-w-0 flex-1 text-sm text-ink">
          {prompt === "install" ? (
            <>
              <p>Add CountIn to your Home Screen for a full-screen app, alerts, and an unread badge.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {installable && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      void promptInstall().finally(() => setBusy(false));
                    }}
                  >
                    {busy ? "Installing…" : "Install"}
                  </Button>
                )}
                <Link href="/app/profile#home-screen" className="text-sm font-medium text-primary">
                  See how
                </Link>
              </div>
            </>
          ) : (
            <>
              <p>Turn on notifications to see messages and invitations on this phone.</p>
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
            </>
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
