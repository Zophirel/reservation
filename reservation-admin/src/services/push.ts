import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getMessaging, getToken, isSupported, onMessage, type MessagePayload, type Messaging } from 'firebase/messaging'
import { api } from '@/services/api'

type FirebaseWebConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
  vapidKey: string
}

type PushConfigResponse = { enabled: boolean; firebase: FirebaseWebConfig | null }

let clientPromise: Promise<{ app: FirebaseApp; messaging: Messaging; config: FirebaseWebConfig }> | null = null

async function getClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      if (!('serviceWorker' in navigator) || !('Notification' in window) || !(await isSupported())) throw new Error('Push notifications are not supported by this browser.')
      const pushConfig = await api<PushConfigResponse>('/push/config')
      if (!pushConfig.enabled || !pushConfig.firebase) throw new Error('Push notifications are not configured on the server.')
      const app = getApps()[0] || initializeApp(pushConfig.firebase)
      const messaging = getMessaging(app)
      await navigator.serviceWorker.register('/firebase-messaging-sw.js')
      return { app, messaging, config: pushConfig.firebase }
    })().catch((error) => {
      clientPromise = null
      throw error
    })
  }
  return clientPromise
}

export async function enableAdminPushNotifications() {
  if (!('Notification' in window)) throw new Error('Push notifications are not supported by this browser.')
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted.')

  const { messaging, config } = await getClient()
  const registration = await navigator.serviceWorker.ready
  const token = await getToken(messaging, { vapidKey: config.vapidKey, serviceWorkerRegistration: registration })
  if (!token) throw new Error('Firebase did not return a browser token.')
  await api('/admin/push-tokens', { method: 'POST', body: JSON.stringify({ token, platform: 'WEB' }) })
  return token
}

export async function registerGrantedAdminPush() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false
  await enableAdminPushNotifications()
  return true
}

export async function listenForAdminPushMessages(handler: (payload: MessagePayload) => void) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return () => undefined
  const { messaging } = await getClient()
  return onMessage(messaging, handler)
}
