/* Firebase needs a root-scoped service worker to display background notifications. */
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js')

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

fetch('/api/push/config')
  .then((response) => response.json())
  .then((config) => {
    if (!config.enabled || !config.firebase) return
    firebase.initializeApp(config.firebase)
    const messaging = firebase.messaging()
    messaging.onBackgroundMessage((payload) => {
      if (payload.notification) return
      const title = payload.data?.title || 'New booking request'
      const link = payload.data?.link || '/reservations'
      self.registration.showNotification(title, {
        body: payload.data?.body || 'A customer has requested a new booking.',
        tag: payload.data?.reservationId || 'reservio-push',
        data: { link, reservationId: payload.data?.reservationId },
      })
    })
  })
  .catch(() => undefined)

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const notificationData = event.notification.data || {}
  const fcmData = notificationData.FCM_MSG?.data || {}
  const rawLink = notificationData.link || fcmData.link || '/reservations'
  const reservationId = notificationData.reservationId || fcmData.reservationId
  const link = new URL(rawLink, self.location.origin).href
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => 'focus' in client)
    if (existing) {
      if (reservationId) {
        existing.postMessage({ type: 'RESERVIO_OPEN_RESERVATION', reservationId, link })
        return existing.focus()
      }
      // A push link may be configured with the LAN IP while the admin is open
      // on localhost. Keep an existing tab on its current origin.
      const currentOrigin = new URL(existing.url).origin
      const localLink = new URL(new URL(link).pathname + new URL(link).search + new URL(link).hash, currentOrigin).href
      return existing.navigate(localLink).then((client) => client?.focus())
    }
    return clients.openWindow(link)
  }))
})
