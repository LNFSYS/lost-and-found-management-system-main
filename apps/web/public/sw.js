const CACHE_VERSION = "lnfs-pwa-v3";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const SHELL_ASSETS = ["/", "/home", "/posts", "/my-posts", "/manifest.webmanifest", "/icons/lnfs-icon.svg"];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isMutation(request) {
  return !["GET", "HEAD"].includes(request.method);
}

function isPrivateApi(url) {
  return url.pathname.startsWith("/api/auth") ||
    url.pathname.includes("/media/") ||
    url.pathname.includes("/evidence") ||
    url.pathname.includes("/private") ||
    url.pathname.startsWith("/api/admin") ||
    url.pathname.startsWith("/api/staff");
}

function hasAuthorization(request) {
  return request.headers.has("authorization");
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(SHELL_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const url = typeof payload.url === "string" && payload.url.startsWith("/") && !payload.url.startsWith("//")
    ? payload.url
    : "/notifications";
  event.waitUntil(self.registration.showNotification(
    typeof payload.title === "string" ? payload.title : "FPTU Lost & Found",
    {
      body: typeof payload.body === "string" ? payload.body : "Bạn có thông báo mới. Mở ứng dụng để xem.",
      icon: "/icons/lnfs-icon.svg",
      badge: "/icons/lnfs-icon.svg",
      data: { url }
    }
  ));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/notifications", self.location.origin);
  const url = target.origin === self.location.origin ? `${target.pathname}${target.search}${target.hash}` : "/notifications";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
    for (const client of clients) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        if ("navigate" in client) await client.navigate(url);
        return client.focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (!isSameOrigin(url) || isMutation(request) || isPrivateApi(url)) return;
  // Cache the application shell and static assets only. All API responses,
  // including private conversation data, must always come from the network.
  if (url.pathname.startsWith("/api/") || hasAuthorization(request)) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/home").then((cached) => cached || caches.match("/"))));
    return;
  }
  if (["script", "style", "image", "font", "manifest"].includes(request.destination)) {
    event.respondWith(cacheFirst(request));
  }
});
