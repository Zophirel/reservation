import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging'
import { prisma } from './prisma.js'

type BookingNotification = {
  id: string
  customerName: string
  serviceName: string
  startAt: Date
}

type PushMessage = {
  title: string
  body: string
  data: Record<string, string>
}

type InvitationNotification = { id: string; contactName?: string | null; contactPhone?: string | null; role: string; type: string }

function envBoolean(value: string | undefined) {
  return value?.toLowerCase() === 'true'
}

function hasServerConfig() {
  return Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)
}

export function isPushEnabled() {
  return envBoolean(process.env.FIREBASE_ENABLED) && hasServerConfig() && Boolean(getFirebaseWebConfig())
}

export function getFirebaseWebConfig() {
  const apiKey = process.env.FIREBASE_WEB_API_KEY
  const messagingSenderId = process.env.FIREBASE_WEB_MESSAGING_SENDER_ID
  const appId = process.env.FIREBASE_WEB_APP_ID
  const vapidKey = process.env.FIREBASE_WEB_VAPID_KEY
  if (!process.env.FIREBASE_PROJECT_ID || !apiKey || !messagingSenderId || !appId || !vapidKey) return null

  return {
    apiKey,
    authDomain: process.env.FIREBASE_WEB_AUTH_DOMAIN || `${process.env.FIREBASE_PROJECT_ID}.firebaseapp.com`,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_WEB_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`,
    messagingSenderId,
    appId,
    vapidKey,
  }
}

function firebaseMessaging() {
  if (!isPushEnabled()) return null
  const app = getApps()[0] || initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
  return getMessaging(app)
}

function isExpiredTokenError(code: string | undefined) {
  return code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token'
}

export async function sendBookingRequestNotification(reservation: BookingNotification) {
  const messaging = firebaseMessaging()
  if (!messaging) return { sent: 0, configured: false }

  const subscriptions = await prisma.pushToken.findMany({
    where: { user: { role: 'ADMIN', status: 'ACTIVE' } },
    select: { token: true },
  })
  const tokens = subscriptions.map(({ token }) => token)
  if (!tokens.length) return { sent: 0, configured: true }

  const adminUrl = process.env.PUBLIC_ADMIN_URL || 'http://localhost:5174'
  const link = `${adminUrl.replace(/\/$/, '')}/reservations?reservation=${encodeURIComponent(reservation.id)}`
  return sendToTokens(messaging, tokens, {
    title: 'New booking request',
    body: `${reservation.customerName} · ${reservation.serviceName}`,
    data: { type: 'BOOKING_REQUEST', reservationId: reservation.id, link, startAt: reservation.startAt.toISOString() },
  })
}

export async function sendInvitationCreatedNotification(invitation: InvitationNotification) {
  const messaging = firebaseMessaging()
  if (!messaging) return { sent: 0, configured: false }
  const subscriptions = await prisma.pushToken.findMany({ where: { user: { role: 'ADMIN', status: 'ACTIVE' } }, select: { token: true } })
  const tokens = subscriptions.map(({ token }) => token)
  if (!tokens.length) return { sent: 0, configured: true }
  const adminUrl = process.env.PUBLIC_ADMIN_URL || 'http://localhost:5174'
  const contactLabel = invitation.contactName || invitation.contactPhone || 'a new contact'
  return sendToTokens(messaging, tokens, {
    title: `Invitation ready for ${contactLabel}`,
    body: `${invitation.type === 'ONE_TIME' ? 'One-time' : 'Permanent'} ${invitation.role.toLowerCase()} invitation created${invitation.contactPhone ? ` · ${invitation.contactPhone}` : ''}.`,
    data: { type: 'INVITATION_CREATED', invitationId: invitation.id, link: `${adminUrl.replace(/\/$/, '')}/invitations` },
  })
}

async function sendToTokens(messaging: ReturnType<typeof getMessaging>, tokens: string[], push: PushMessage) {
  const message: MulticastMessage = {
    tokens,
    // Use a data-only message so the service worker owns notification display
    // and can attach the reservation deep link to the notification click.
    data: { title: push.title, body: push.body, ...push.data },
    webpush: { fcmOptions: { link: push.data.link || process.env.PUBLIC_ADMIN_URL || 'http://localhost:5174' } },
  }
  const result = await messaging.sendEachForMulticast(message)
  const expiredTokens = result.responses.map((item, index) => item.success || !isExpiredTokenError(item.error?.code) ? null : tokens[index]).filter((token): token is string => Boolean(token))
  if (expiredTokens.length) await prisma.pushToken.deleteMany({ where: { token: { in: expiredTokens } } })
  return { sent: result.successCount, failed: result.failureCount, configured: true, errors: result.responses.flatMap((item) => item.error?.code ? [item.error.code] : []) }
}

export async function sendTestPushNotification(userId: string) {
  const messaging = firebaseMessaging()
  if (!messaging) return { sent: 0, failed: 0, configured: false, errors: [] as string[] }
  const subscriptions = await prisma.pushToken.findMany({ where: { userId }, select: { token: true } })
  if (!subscriptions.length) return { sent: 0, failed: 0, configured: true, errors: ['NO_REGISTERED_TOKEN'] }
  const adminUrl = process.env.PUBLIC_ADMIN_URL || 'http://localhost:5174'
  return sendToTokens(messaging, subscriptions.map(({ token }) => token), {
    title: 'Push notifications are working',
    body: 'This is a test notification from Reservio.',
    data: { type: 'PUSH_TEST', link: `${adminUrl.replace(/\/$/, '')}/settings` },
  })
}
