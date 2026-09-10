self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "CountIn";
  const href = data.href || "/app/notifications";
  const unread = Number(data.unreadCount ?? 0);
  const tag = data.tag || "countin";
  event.waitUntil(
    (async () => {
      if (unread > 0 && self.registration.setAppBadge) {
        await self.registration.setAppBadge(unread);
      } else if (self.registration.clearAppBadge) {
        await self.registration.clearAppBadge();
      }
      await self.registration.showNotification(title, {
        body: data.body || "You have a new update.",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: { href },
        tag,
        renotify: true,
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href || "/app/notifications";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(href);
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(href);
    })(),
  );
});
