export function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || Boolean(nav.standalone);
}

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export async function registerPushWorker() {
  if (!pushSupported()) return null;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export async function syncAppBadge() {
  try {
    const res = await fetch("/api/push/badge", { cache: "no-store" });
    if (res.status === 401) {
      if ("clearAppBadge" in navigator) await navigator.clearAppBadge();
      return 0;
    }
    if (!res.ok) return null;
    const data = (await res.json()) as { unread?: number };
    const unread = Number(data.unread ?? 0);
    if ("setAppBadge" in navigator) {
      if (unread > 0) await navigator.setAppBadge(unread);
      else await navigator.clearAppBadge();
    }
    window.dispatchEvent(new CustomEvent("countin:badge", { detail: unread }));
    return unread;
  } catch {
    return null;
  }
}

export async function enablePushNotifications() {
  if (!pushSupported()) return { error: "This browser cannot show app notifications." };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { error: "Notifications were blocked. Enable them in the browser settings." };
  }
  const registration = (await registerPushWorker()) ?? (await navigator.serviceWorker.ready);
  const vapid = await fetch("/api/push/vapid", { cache: "no-store" }).then((res) => {
    if (!res.ok) throw new Error("Could not load push keys.");
    return res.json() as Promise<{ publicKey: string }>;
  });
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
    }));
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { error: data.error || "Could not save this device." };
  }
  await syncAppBadge();
  return { ok: true as const };
}

export async function disablePushNotifications() {
  if (!pushSupported()) return { ok: true as const };
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
  }
  if ("clearAppBadge" in navigator) await navigator.clearAppBadge();
  return { ok: true as const };
}
