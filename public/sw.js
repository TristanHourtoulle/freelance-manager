// Minimal service worker: makes the app installable, caches immutable build
// assets + icons (cache-first), and receives Web Push. Navigations and API
// data stay network-driven (SSR + Cache Components + Postgres), so nothing
// stale is ever served — push adds delivery, not caching.
const CACHE = "fm-static-v1"

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
      }),
    )
  }
})

// Push delivery: one daily digest. The fixed tag collapses any accidental
// second digest into the same notification.
self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {}
  const title = data.title || "Freelance Manager"
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      tag: "fm-daily-digest",
      renotify: true,
      data: { url: data.url || "/dashboard" },
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || "/dashboard"
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      for (const client of all) {
        if (client.url.includes(url) && "focus" in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })(),
  )
})
