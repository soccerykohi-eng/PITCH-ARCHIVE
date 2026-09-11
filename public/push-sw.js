self.addEventListener("push",(event) => {
  const data=event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(data.title || "PITCH ARCHIVE",{
    body:data.body || "新しいお知らせがあります。",
    icon:"/icon-192.png",
    badge:"/icon-192.png",
    data:{ url:data.url || "/" },
  }));
});
self.addEventListener("notificationclick",(event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/"));
});
