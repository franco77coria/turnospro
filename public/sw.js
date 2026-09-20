// Versión nueva: al cambiar el nombre se descarta la caché vieja, que tenía
// páginas apuntando al dominio de vercel.app y respuestas de sesión ajenas.
const CACHE_NAME = 'glowup-v2'
const OFFLINE_URL = '/offline'

const PRECACHE_URLS = [
  '/',
  '/explore',
  '/offline',
]

// Rutas que NUNCA se guardan en caché: su HTML depende de quién esté logueado.
// Si se cachean, al quedarse sin red (o después de cerrar sesión) el navegador
// puede mostrar el panel del usuario anterior desde el disco.
const RUTAS_PRIVADAS = [
  '/dashboard',
  '/onboarding',
  '/book/my-appointments',
  '/book/profile',
  '/book/favorites',
  '/login',
  '/register',
]

const esPrivada = (pathname) => RUTAS_PRIVADAS.some((r) => pathname === r || pathname.startsWith(`${r}/`))

// Install: precache essential resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return

  // ── Origen cruzado: no lo tocamos NUNCA ────────────────────────────────
  // Acá se rompía el login con Google. El handler de navegación de abajo
  // interceptaba también la ida a accounts.google.com y la resolvía con
  // fetch(). OAuth es una cadena de redirects, así que fetch() devolvía una
  // respuesta con redirected=true, y el navegador se niega a usar una
  // respuesta redirigida para una navegación cuyo redirect mode no es
  // 'follow': la navegación fallaba, caía en el .catch() y terminabas viendo
  // la página offline en vez de la pantalla de Google.
  // Dejando pasar el pedido, el navegador maneja los redirects por su cuenta.
  if (url.origin !== self.location.origin) return

  // API, auth y Supabase: siempre a la red, nunca cacheados.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return

  // Navegaciones del mismo origen
  if (request.mode === 'navigate') {
    // Una navegación a una ruta privada va directo a la red, sin guardar copia.
    if (esPrivada(url.pathname)) {
      event.respondWith(
        fetch(request).catch(() => caches.match(OFFLINE_URL))
      )
      return
    }

    event.respondWith(
      fetch(request)
        .then((response) => {
          // Una respuesta redirigida no se puede reutilizar para una
          // navegación: guardarla dejaría la caché envenenada.
          if (response.ok && !response.redirected) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    )
    return
  }

  // Estáticos: cache-first
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$/) ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
      })
    )
  }
})

// Push notification handler
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  const title = data.title || 'GLOWUP'
  const options = {
    body: data.body || 'Tenés una notificación nueva',
    // /icon-192.png no existe en public/: la notificación salía sin ícono.
    icon: '/logo.png',
    badge: '/logo.png',
    tag: data.tag || 'default',
    data: { url: data.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Comparar client.url (absoluta) contra una ruta relativa nunca daba
      // true, así que siempre abría una ventana nueva en vez de enfocar la
      // que ya estaba abierta.
      for (const client of clientList) {
        if (new URL(client.url).pathname === target && 'focus' in client) {
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    })
  )
})
