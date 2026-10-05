self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  event.waitUntil(self.registration.showNotification(data.title || "Alchemical Visions", {
    body: data.body || "You have a new consultation request.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/provider" },
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/provider"));
});
