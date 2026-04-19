// AdminOS Service Worker — offline resilience for load shedding
const CACHE_VERSION = 'adminos-v1'
const STATIC_ASSETS = [
  '/dashboard',
  '/manifest.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only cache GET requests for same-origin navigation
  if (request.method !== 'GET') return
  if (!url.origin.includes(self.location.origin)) return

  // API routes — network first, no cache
  if (url.pathname.startsWith('/api/')) return

  // Static assets and pages — cache first, fall back to network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const clone = response.clone()
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone))
        }
        return response
      }).catch(() => {
        // Offline fallback for navigation
        if (request.mode === 'navigate') {
          return caches.match('/dashboard') || new Response('Offline', { status: 503 })
        }
        return new Response('Offline', { status: 503 })
      })
    })
  )
})
