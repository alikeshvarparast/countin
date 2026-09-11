export function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || Boolean(nav.standalone);
}

export function installPlatform(): "ios" | "android" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
    return "ios";
  }
  if (/Android/i.test(ua)) return "android";
  return "desktop";
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

export async function registerAppWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export async function registerPushWorker() {
  return registerAppWorker();
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredInstall: BeforeInstallPromptEvent | null = null;

function emitInstallable() {
  window.dispatchEvent(new CustomEvent("countin:installable", { detail: Boolean(deferredInstall) }));
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstall = event as BeforeInstallPromptEvent;
    emitInstallable();
  });
  window.addEventListener("appinstalled", () => {
    deferredInstall = null;
    emitInstallable();
  });
}

export function canPromptInstall() {
  return Boolean(deferredInstall);
}

export function subscribeInstallPrompt(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  const onChange = () => listener();
  window.addEventListener("countin:installable", onChange);
  return () => window.removeEventListener("countin:installable", onChange);
}

export async function promptInstall() {
  if (!deferredInstall) return { outcome: "unavailable" as const };
  await deferredInstall.prompt();
  const { outcome } = await deferredInstall.userChoice;
  deferredInstall = null;
  emitInstallable();
  return { outcome };
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
