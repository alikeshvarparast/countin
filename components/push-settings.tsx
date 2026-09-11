"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import {
  disablePushNotifications,
  enablePushNotifications,
  isStandaloneDisplay,
  pushSupported,
} from "@/lib/pwa-client";

export function PushSettings({ enabled }: { enabled: boolean }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(pushSupported());
    setStandalone(isStandaloneDisplay());
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, []);

  async function turnOn() {
    setBusy(true);
    setError(null);
    try {
      const result = await enablePushNotifications();
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setOn(true);
      setPermission("granted");
    } catch {
      setError("Could not enable notifications on this device.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setError(null);
    await disablePushNotifications();
    setBusy(false);
    setOn(false);
  }

  return (
    <div className="space-y-3 text-sm text-cream/70">
      <p>
        New messages, invitations, and inbox updates appear as a notification. The unread count
        shows on the Home Screen icon.
      </p>
      {!standalone && (
        <p>
          Open CountIn from the Home Screen icon first — see the steps in Home Screen app above —
          then turn alerts on.
        </p>
      )}
      {supported === false && (
        <p>This browser cannot receive home-screen notifications. Use Chrome, Safari, or Edge.</p>
      )}
      {permission === "denied" && (
        <p>Notifications are blocked for this site. Enable them in the phone or browser settings.</p>
      )}
      {error && <p className="text-secondary">{error}</p>}
      {on ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-ink">This device will receive alerts.</p>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void turnOff()}>
            Turn off
          </Button>
        </div>
      ) : (
        <Button type="button" disabled={busy || supported === false} onClick={() => void turnOn()}>
          {busy ? "Enabling…" : "Turn on notifications"}
        </Button>
      )}
    </div>
  );
}
