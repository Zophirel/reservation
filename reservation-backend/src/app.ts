import { randomBytes } from 'node:crypto'
import { google } from 'googleapis'
import { Prisma, type Invitation, type UserRole } from '@prisma/client'
import cors from 'cors'
import express, { type NextFunction, type Request, type Response } from 'express'
import QRCode from 'qrcode'
import { type ZodType } from 'zod'
import { calculateAvailability, calculateAvailableDates, getBookingDateRange } from './availability.js'
import { reconcileGoogleCalendarDeletions } from './calendar-reconciliation.js'
import { createToken, decryptToken, encryptToken, hashInvitationToken, hashPassword, newInvitationToken, publicUser, verifyPassword, verifyToken } from './auth.js'
import { normalizePhone } from './contacts.js'
import { CalendarConfigError, checkCalendarConnection, createCalendarEvent, deleteCalendarEvent, isCalendarEnabled, listCalendarBusyEvents } from './google-calendar.js'
import { GoogleContactsConfigError, listGoogleContacts } from './google-contacts.js'
import { getFirebaseWebConfig, isPushEnabled, sendBookingRequestNotification, sendInvitationCreatedNotification, sendTestPushNotification } from './push-notifications.js'
import { prisma } from './prisma.js'
import { calendarRangeSchema, contactAssociationSchema, daySchema, exceptionSchema, externalContactsSchema, invitationSchema, loginSchema, profileSchema, pushTokenSchema, registerSchema, reservationSchema, serviceSchema, settingsSchema, userStatusSchema, weeklySchema } from './schemas.js'

type AppError = Error & { status?: number; code?: string; fieldErrors?: unknown }
const app = express()
const allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:5173,http://localhost:5174,https://localhost,capacitor://localhost').split(',').map((value) => value.trim())

app.use(cors({ origin: (origin, callback) => !origin || allowedOrigins.includes(origin) ? callback(null, true) : callback(new Error('Origin is not allowed by CORS.')) }))
app.use(express.json({ limit: '64kb' }))

function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    const error = new Error('Please correct the highlighted fields.') as AppError
    error.status = 400
    error.code = 'VALIDATION_ERROR'
    error.fieldErrors = result.error.flatten().fieldErrors
    throw error
  }
  return result.data
}

function requireAuth(request: Request, response: Response, next: NextFunction) {
  const userId = verifyToken(request.headers.authorization?.replace(/^Bearer\s+/i, ''))
  if (!userId) return response.status(401).json({ code: 'AUTH_REQUIRED', message: 'Authentication required.' })
  prisma.user.findUnique({ where: { id: userId } }).then((user) => {
    if (!user || user.status === 'DISABLED') return response.status(401).json({ code: 'ACCOUNT_DISABLED', message: 'This account is unavailable.' })
    request.user = user
    next()
  }).catch(next)
}

function requireAdmin(request: Request, response: Response, next: NextFunction) {
  if (request.user?.role !== 'ADMIN') return response.status(403).json({ code: 'FORBIDDEN', message: 'Administrator access required.' })
  next()
}

function pagination(query: Request['query']) {
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 10))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

function pageResult<T>(items: T[], total: number, page: number, pageSize: number) {
  return { items, pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) } }
}

function invitationStatus(invitation: Invitation) {
  if (invitation.revokedAt) return 'REVOKED'
  if (invitation.type === 'ONE_TIME' && invitation.usedAt) return 'USED'
  if (invitation.expiresAt && invitation.expiresAt.getTime() <= Date.now()) return 'EXPIRED'
  return 'ACTIVE'
}

function invitationDto(invitation: Invitation, includeUrl = false) {
  const result: Record<string, unknown> = { ...invitation, tokenHash: undefined, tokenEncrypted: undefined, status: invitationStatus(invitation) }
  delete result.tokenHash
  delete result.tokenEncrypted
  if (includeUrl) result.url = `${process.env.PUBLIC_APP_URL || 'http://localhost:5173'}/invite/${decryptToken(invitation.tokenEncrypted)}`
  return result
}

type DetailedReservation = Prisma.ReservationGetPayload<{ include: { user: true; service: true } }>

async function syncReservationCalendar(reservation: DetailedReservation, timezone: string) {
  if (!isCalendarEnabled()) {
    return prisma.reservation.update({
      where: { id: reservation.id },
      data: { calendarSyncStatus: 'NOT_CONFIGURED', calendarSyncError: null },
      include: { user: true, service: true },
    })
  }

  try {
    const eventId = reservation.calendarEventId || await createCalendarEvent(reservation, timezone)
    return prisma.reservation.update({
      where: { id: reservation.id },
      data: { calendarEventId: eventId, calendarSyncStatus: 'SYNCED', calendarSyncError: null, calendarSyncedAt: new Date() },
      include: { user: true, service: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google Calendar synchronization failed.'
    return prisma.reservation.update({
      where: { id: reservation.id },
      data: { calendarSyncStatus: error instanceof CalendarConfigError ? 'NOT_CONFIGURED' : 'FAILED', calendarSyncError: message },
      include: { user: true, service: true },
    })
  }
}

async function cancelReservationRecord(reservation: DetailedReservation) {
  let updated = await prisma.reservation.update({
    where: { id: reservation.id },
    data: { status: 'CANCELLED', cancelledAt: reservation.cancelledAt || new Date() },
    include: { user: true, service: true },
  })
  if (!reservation.calendarEventId) return updated

  try {
    await deleteCalendarEvent(reservation.calendarEventId)
    updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data: { calendarSyncStatus: 'DELETED', calendarSyncError: null, calendarSyncedAt: new Date() },
      include: { user: true, service: true },
    })
  } catch (error) {
    updated = await prisma.reservation.update({
      where: { id: reservation.id },
      data: { calendarSyncStatus: 'FAILED', calendarSyncError: error instanceof Error ? error.message : 'Google Calendar deletion failed.' },
      include: { user: true, service: true },
    })
  }
  return updated
}

app.get('/api/health', (_request, response) => response.json({ status: 'ok' }))
app.get('/api/push/config', (_request, response) => response.json({ enabled: isPushEnabled(), firebase: isPushEnabled() ? getFirebaseWebConfig() : null }))

app.post('/api/auth/login', async (request, response) => {
  const input = parse(loginSchema, request.body)
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } })
  if (!user || user.status === 'DISABLED' || !(await verifyPassword(input.password, user.passwordHash))) return response.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' })
  response.json({ user: publicUser(user), token: createToken(user.id) })
})

app.get('/api/invitations/:token', async (request, response) => {
  const invitation = await prisma.invitation.findUnique({ where: { tokenHash: hashInvitationToken(request.params.token) } })
  if (!invitation || invitationStatus(invitation) !== 'ACTIVE') return response.status(410).json({ code: 'INVITATION_INVALID', message: 'Invitation is no longer valid.' })
  response.json({ invitation: { type: invitation.type, name: invitation.name, email: invitation.email, phoneNumber: invitation.phoneNumber, role: invitation.role, description: invitation.description, expiresAt: invitation.expiresAt } })
})

app.post('/api/auth/register', async (request, response) => {
  const input = parse(registerSchema, request.body)
  const tokenHash = hashInvitationToken(input.token)
  const invitation = await prisma.invitation.findUnique({ where: { tokenHash } })
  if (!invitation || invitationStatus(invitation) !== 'ACTIVE') return response.status(410).json({ code: 'INVITATION_INVALID', message: 'Invitation is no longer valid.' })
  const email = input.email.toLowerCase()
  if (invitation.email && invitation.email.toLowerCase() !== email) return response.status(400).json({ code: 'EMAIL_MISMATCH', message: 'Use the email address associated with this invitation.' })

  try {
    const user = await prisma.$transaction(async (tx) => {
      if (invitation.type === 'ONE_TIME') {
        const claimed = await tx.invitation.updateMany({ where: { id: invitation.id, usedAt: null, revokedAt: null }, data: { usedAt: new Date(), useCount: { increment: 1 } } })
        if (claimed.count !== 1) throw Object.assign(new Error('Invitation is no longer valid.'), { status: 410, code: 'INVITATION_INVALID' })
      } else await tx.invitation.update({ where: { id: invitation.id }, data: { useCount: { increment: 1 } } })
      return tx.user.create({ data: { name: input.name, email, phoneNumber: input.phoneNumber, passwordHash: await hashPassword(input.password), role: invitation.role } })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    response.status(201).json({ user: publicUser(user), token: createToken(user.id) })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return response.status(409).json({ code: 'EMAIL_EXISTS', message: 'An account with this email already exists.' })
    throw error
  }
})

app.get('/api/me', requireAuth, (request, response) => response.json({ user: publicUser(request.user!) }))
app.patch('/api/me', requireAuth, async (request, response) => {
  const input = parse(profileSchema, request.body)
  const user = await prisma.user.update({ where: { id: request.user!.id }, data: input })
  response.json({ user: publicUser(user) })
})

app.post('/api/contacts/device', requireAuth, async (request, response) => {
  const input = parse(externalContactsSchema, request.body)
  const users = await prisma.user.findMany({ where: { phoneNumber: { not: null } }, select: { id: true, phoneNumber: true } })
  const usersByPhone = new Map(users.flatMap((user) => { const phone = normalizePhone(user.phoneNumber || ''); return phone ? [[phone, user.id] as const] : [] }))
  const contacts = await prisma.$transaction(input.contacts.map((contact) => {
    const phoneNormalized = normalizePhone(contact.phoneNumber)
    return prisma.externalContact.upsert({ where: { source_externalId: { source: 'DEVICE', externalId: contact.externalId } }, update: { name: contact.name, phoneNumber: contact.phoneNumber, phoneNormalized, importedById: request.user!.id, matchedUserId: usersByPhone.get(phoneNormalized) || null }, create: { source: 'DEVICE', externalId: contact.externalId, name: contact.name, phoneNumber: contact.phoneNumber, phoneNormalized, importedById: request.user!.id, matchedUserId: usersByPhone.get(phoneNormalized) || null } })
  }))
  response.json({ contacts })
})

app.get('/api/services', async (_request, response) => response.json({ services: await prisma.service.findMany({ where: { enabled: true }, orderBy: { name: 'asc' } }) }))
app.get('/api/settings/public', async (_request, response) => {
  const settings = await prisma.businessSettings.findUnique({ where: { id: 'default' } })
  const timezone = settings?.timezone || 'Europe/Rome'
  const range = getBookingDateRange(timezone, settings?.bookingWindow || 'MONTH')
  response.json({ settings: { businessName: settings?.businessName || 'Reservio', timezone, bookingWindow: settings?.bookingWindow || 'MONTH', ...range } })
})

app.get('/api/availability/dates', async (request, response) => {
  const month = String(request.query.month || '')
  if (!/^\d{4}-\d{2}$/.test(month)) return response.status(400).json({ code: 'VALIDATION_ERROR', message: 'Month is required in YYYY-MM format.' })
  response.json({ month, availableDates: await calculateAvailableDates(prisma, month) })
})

app.get('/api/availability', async (request, response) => {
  const serviceId = String(request.query.serviceId || '')
  const date = String(request.query.date || '')
  if (!serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return response.status(400).json({ code: 'VALIDATION_ERROR', message: 'Service and date are required.' })
  response.json({ date, slots: await calculateAvailability(prisma, serviceId, date) })
})

app.get('/api/reservations', requireAuth, async (request, response) => {
  const reservations = await prisma.reservation.findMany({ where: { userId: request.user!.id }, include: { service: true }, orderBy: { startAt: 'asc' } })
  response.json({ reservations })
})

app.post('/api/reservations', requireAuth, async (request, response) => {
  const input = parse(reservationSchema, request.body)
  const service = await prisma.service.findFirst({ where: { id: input.serviceId, enabled: true } })
  const settings = await prisma.businessSettings.findUnique({ where: { id: 'default' } })
  if (!service) return response.status(404).json({ code: 'SERVICE_NOT_FOUND', message: 'Service not found.' })
  const { DateTime } = await import('luxon')
  const requested = DateTime.fromISO(input.startAt, { setZone: true })
  const date = requested.setZone(settings?.timezone || 'Europe/Rome').toISODate()!
  try {
    const reservation = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(7192026)`
      const slots = await calculateAvailability(tx, service.id, date)
      const slot = slots.find((item) => item.startAt === requested.toUTC().toISO())
      if (!slot) throw Object.assign(new Error('That appointment was just booked. Please select another time.'), { status: 409, code: 'SLOT_UNAVAILABLE' })
      return tx.reservation.create({ data: { userId: request.user!.id, serviceId: service.id, startAt: new Date(slot.startAt), endAt: new Date(slot.endAt), status: 'PENDING' }, include: { service: true } })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    void sendBookingRequestNotification({ id: reservation.id, customerName: request.user!.name, serviceName: reservation.service.name, startAt: reservation.startAt }).catch((error) => {
      console.error('Unable to send booking request push notification:', error instanceof Error ? error.message : error)
    })
    response.status(201).json({ reservation })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2004', 'P2034'].includes(error.code)) return response.status(409).json({ code: 'SLOT_UNAVAILABLE', message: 'That appointment was just booked. Please select another time.' })
    throw error
  }
})

app.post('/api/reservations/:id/cancel', requireAuth, async (request, response) => {
  const reservation = await prisma.reservation.findFirst({ where: { id: String(request.params.id), userId: request.user!.id }, include: { user: true, service: true } })
  if (!reservation) return response.status(404).json({ code: 'NOT_FOUND', message: 'Reservation not found.' })
  const updated = await cancelReservationRecord(reservation)
  response.json({ reservation: updated })
})

app.use('/api/admin', requireAuth, requireAdmin)

app.get('/api/admin/contacts', async (request, response) => {
  const source = request.query.source === 'DEVICE' || request.query.source === 'GOOGLE' ? request.query.source : undefined
  const search = String(request.query.search || '')
  const contacts = await prisma.externalContact.findMany({ where: { ...(source ? { source } : {}), ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { phoneNumber: { contains: search } }] } : {}) }, include: { matchedUser: { select: { id: true, name: true, email: true, phoneNumber: true } }, importedBy: { select: { id: true, name: true, email: true } } }, orderBy: { name: 'asc' } })
  const uniqueContacts = contacts.filter((contact, index, items) => {
    const phone = contact.phoneNormalized || contact.phoneNumber.trim()
    return index === items.findIndex((candidate) => (candidate.phoneNormalized || candidate.phoneNumber.trim()) === phone)
  })
  response.json({ contacts: uniqueContacts })
})

app.post('/api/admin/contacts/google/sync', async (_request, response) => {
  try {
    const imported = await listGoogleContacts()
    const users = await prisma.user.findMany({ where: { phoneNumber: { not: null } }, select: { id: true, phoneNumber: true } })
    const usersByPhone = new Map(users.flatMap((user) => { const phone = normalizePhone(user.phoneNumber || ''); return phone ? [[phone, user.id] as const] : [] }))
    const contacts = await prisma.$transaction(imported.map((contact) => { const phoneNormalized = normalizePhone(contact.phoneNumber); return prisma.externalContact.upsert({ where: { source_externalId: { source: 'GOOGLE', externalId: contact.externalId } }, update: { name: contact.name, phoneNumber: contact.phoneNumber, phoneNormalized, matchedUserId: usersByPhone.get(phoneNormalized) || null }, create: { source: 'GOOGLE', externalId: contact.externalId, name: contact.name, phoneNumber: contact.phoneNumber, phoneNormalized, matchedUserId: usersByPhone.get(phoneNormalized) || null } }) }))
    response.json({ contacts, imported: contacts.length })
  } catch (error) {
    if (error instanceof GoogleContactsConfigError) return response.status(503).json({ code: error.code, message: error.message })
    throw error
  }
})

app.post('/api/admin/contacts/:id/associate', async (request, response) => {
  const input = parse(contactAssociationSchema, request.body)
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } })
  if (!user) return response.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found.' })
  const contact = await prisma.externalContact.update({ where: { id: request.params.id }, data: { matchedUserId: input.userId }, include: { matchedUser: { select: { id: true, name: true, email: true, phoneNumber: true } } } })
  response.json({ contact })
})

app.delete('/api/admin/contacts/:id/associate', async (request, response) => {
  const contact = await prisma.externalContact.update({ where: { id: request.params.id }, data: { matchedUserId: null }, include: { matchedUser: { select: { id: true, name: true, email: true, phoneNumber: true } } } })
  response.json({ contact })
})

app.post('/api/admin/push-tokens', async (request, response) => {
  const input = parse(pushTokenSchema, request.body)
  const pushToken = await prisma.pushToken.upsert({ where: { token: input.token }, update: { userId: request.user!.id, platform: input.platform }, create: { userId: request.user!.id, token: input.token, platform: input.platform } })
  response.status(201).json({ pushToken: { id: pushToken.id, platform: pushToken.platform } })
})
app.get('/api/admin/push/status', async (request, response) => response.json({ enabled: isPushEnabled(), registered: await prisma.pushToken.count({ where: { userId: request.user!.id } }) }))
app.post('/api/admin/push/test', async (request, response) => response.json(await sendTestPushNotification(request.user!.id)))
app.delete('/api/admin/push-tokens', async (request, response) => {
  const input = parse(pushTokenSchema, request.body)
  await prisma.pushToken.deleteMany({ where: { token: input.token, userId: request.user!.id } })
  response.status(204).end()
})

app.get('/api/admin/dashboard', async (_request, response) => {
  const now = new Date()
  const [upcomingReservations, pendingReservations, activeServices, activeUsers, activeInvitations] = await Promise.all([
    prisma.reservation.count({ where: { status: 'CONFIRMED', startAt: { gte: now } } }), prisma.reservation.count({ where: { status: 'PENDING', startAt: { gte: now } } }), prisma.service.count({ where: { enabled: true } }), prisma.user.count({ where: { status: 'ACTIVE' } }), prisma.invitation.count({ where: { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
  ])
  response.json({ metrics: { upcomingReservations, pendingReservations, activeServices, activeUsers, activeInvitations } })
})

app.get('/api/admin/reservations/pending', async (_request, response) => {
  const reservations = await prisma.reservation.findMany({
    where: { status: 'PENDING' },
    include: { user: { select: { id: true, name: true, email: true } }, service: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  response.json({ reservations })
})

app.get('/api/admin/reservations/calendar', async (request, response) => {
  const input = parse(calendarRangeSchema, { from: request.query.from, to: request.query.to })
  try {
    await reconcileGoogleCalendarDeletions()
  } catch (error) {
    console.error('Unable to reconcile Google Calendar deletions:', error instanceof Error ? error.message : error)
  }
  const settings = await prisma.businessSettings.findUnique({ where: { id: 'default' } })
  const timezone = settings?.timezone || 'Europe/Rome'
  const { DateTime } = await import('luxon')
  const from = DateTime.fromISO(input.from, { zone: timezone }).startOf('day').toUTC().toJSDate()
  const to = DateTime.fromISO(input.to, { zone: timezone }).plus({ days: 1 }).startOf('day').toUTC().toJSDate()
  const [reservations, bounds, calendarEvents, linkedCalendarEvents] = await Promise.all([
    prisma.reservation.findMany({
      where: { startAt: { gte: from, lt: to } },
      include: { user: { select: { id: true, name: true, email: true } }, service: true },
      orderBy: { startAt: 'asc' },
    }),
    prisma.reservation.aggregate({ _min: { startAt: true }, _max: { startAt: true } }),
    listCalendarBusyEvents(from, to, timezone).catch((error) => {
      console.error('Unable to load Google Calendar events for the admin calendar:', error instanceof Error ? error.message : error)
      return []
    }),
    prisma.reservation.findMany({ where: { calendarEventId: { not: null } }, select: { calendarEventId: true } }),
  ])
  const linkedEventIds = new Set(linkedCalendarEvents.flatMap(({ calendarEventId }) => calendarEventId ? [calendarEventId] : []))
  response.json({
    reservations,
    calendarEvents: calendarEvents.filter((event) => !linkedEventIds.has(event.id)),
    timezone,
    bounds: { oldestStartAt: bounds._min.startAt, newestStartAt: bounds._max.startAt },
  })
})

app.delete('/api/admin/google-calendar/events/:eventId', async (request, response) => {
  const eventId = String(request.params.eventId)
  const linkedReservation = await prisma.reservation.findFirst({ where: { calendarEventId: eventId }, select: { id: true } })
  if (linkedReservation) {
    return response.status(409).json({
      code: 'CALENDAR_EVENT_LINKED_TO_RESERVATION',
      message: 'This Google Calendar event belongs to a reservation. Cancel the reservation instead.',
    })
  }
  await deleteCalendarEvent(eventId)
  response.status(204).end()
})

app.get('/api/admin/reservations/:id', async (request, response) => {
  const reservation = await prisma.reservation.findUnique({ where: { id: String(request.params.id) }, include: { user: { select: { id: true, name: true, email: true } }, service: true } })
  if (!reservation) return response.status(404).json({ code: 'NOT_FOUND', message: 'Reservation not found.' })
  response.json({ reservation })
})

app.get('/api/admin/reservations', async (request, response) => {
  const { page, pageSize, skip } = pagination(request.query)
  const search = String(request.query.search || '')
  const where: Prisma.ReservationWhereInput = search ? { OR: [{ user: { name: { contains: search, mode: 'insensitive' } } }, { user: { email: { contains: search, mode: 'insensitive' } } }, { service: { name: { contains: search, mode: 'insensitive' } } }] } : {}
  const [items, total] = await Promise.all([prisma.reservation.findMany({ where, include: { user: { select: { id: true, name: true, email: true } }, service: true }, orderBy: { startAt: request.query.sort === 'desc' ? 'desc' : 'asc' }, skip, take: pageSize }), prisma.reservation.count({ where })])
  response.json(pageResult(items, total, page, pageSize))
})

app.post('/api/admin/reservations/:id/confirm', async (request, response) => {
  const id = String(request.params.id)
  const current = await prisma.reservation.findUnique({ where: { id }, include: { user: true, service: true } })
  if (!current) return response.status(404).json({ code: 'NOT_FOUND', message: 'Reservation not found.' })
  if (current.status === 'CANCELLED') return response.status(409).json({ code: 'RESERVATION_CANCELLED', message: 'A cancelled reservation cannot be confirmed.' })

  if (current.status === 'PENDING') await prisma.reservation.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'CONFIRMED' } })
  const settings = await prisma.businessSettings.findUnique({ where: { id: 'default' } })
  const reservation = await prisma.reservation.findUniqueOrThrow({ where: { id }, include: { user: true, service: true } })
  if (reservation.status !== 'CONFIRMED') return response.status(409).json({ code: 'RESERVATION_CANCELLED', message: 'A cancelled reservation cannot be confirmed.' })
  const synced = await syncReservationCalendar(reservation, settings?.timezone || 'Europe/Rome')
  response.json({ reservation: synced })
})

app.post('/api/admin/reservations/:id/calendar-sync', async (request, response) => {
  const reservation = await prisma.reservation.findUnique({ where: { id: String(request.params.id) }, include: { user: true, service: true } })
  if (!reservation) return response.status(404).json({ code: 'NOT_FOUND', message: 'Reservation not found.' })
  if (reservation.status !== 'CONFIRMED') return response.status(409).json({ code: 'RESERVATION_NOT_CONFIRMED', message: 'Only confirmed reservations can be synchronized.' })
  const settings = await prisma.businessSettings.findUnique({ where: { id: 'default' } })
  const synced = await syncReservationCalendar(reservation, settings?.timezone || 'Europe/Rome')
  response.json({ reservation: synced })
})

app.post('/api/admin/reservations/:id/cancel', async (request, response) => {
  const reservation = await prisma.reservation.findUnique({ where: { id: request.params.id }, include: { user: true, service: true } })
  if (!reservation) return response.status(404).json({ code: 'NOT_FOUND', message: 'Reservation not found.' })
  const updated = await cancelReservationRecord(reservation)
  response.json({ reservation: updated })
})

app.get('/api/admin/services', async (request, response) => {
  const { page, pageSize, skip } = pagination(request.query); const search = String(request.query.search || '')
  const where: Prisma.ServiceWhereInput = search ? { name: { contains: search, mode: 'insensitive' } } : {}
  const [items, total] = await Promise.all([prisma.service.findMany({ where, orderBy: { name: 'asc' }, skip, take: pageSize }), prisma.service.count({ where })])
  response.json(pageResult(items, total, page, pageSize))
})
app.post('/api/admin/services', async (request, response) => response.status(201).json({ service: await prisma.service.create({ data: parse(serviceSchema, request.body) }) }))
app.put('/api/admin/services/:id', async (request, response) => response.json({ service: await prisma.service.update({ where: { id: request.params.id }, data: parse(serviceSchema, request.body) }) }))
app.patch('/api/admin/services/:id/status', async (request, response) => response.json({ service: await prisma.service.update({ where: { id: request.params.id }, data: { enabled: Boolean(request.body.enabled) } }) }))

app.get('/api/admin/availability/weekly', async (_request, response) => response.json({ days: await prisma.weeklyAvailability.findMany({ orderBy: { weekday: 'asc' } }) }))
app.put('/api/admin/availability/weekly', async (request, response) => {
  const input = parse(weeklySchema, request.body)
  await prisma.$transaction(input.days.map((day) => prisma.weeklyAvailability.upsert({ where: { weekday: day.weekday }, update: { enabled: day.enabled, intervals: day.intervals }, create: { weekday: day.weekday, enabled: day.enabled, intervals: day.intervals } })))
  response.json({ days: await prisma.weeklyAvailability.findMany({ orderBy: { weekday: 'asc' } }) })
})
app.get('/api/admin/availability/exceptions', async (_request, response) => response.json({ exceptions: await prisma.availabilityException.findMany({ orderBy: { date: 'asc' } }) }))
app.post('/api/admin/availability/exceptions', async (request, response) => {
  const input = parse(exceptionSchema, request.body); const date = new Date(`${input.date}T00:00:00.000Z`)
  const exception = await prisma.availabilityException.upsert({ where: { date }, update: { type: input.type, reason: input.reason, intervals: input.intervals }, create: { date, type: input.type, reason: input.reason, intervals: input.intervals } })
  response.status(201).json({ exception })
})
app.delete('/api/admin/availability/exceptions/:id', async (request, response) => { await prisma.availabilityException.delete({ where: { id: request.params.id } }); response.status(204).end() })

app.get('/api/admin/invitations', async (request, response) => {
  const { page, pageSize, skip } = pagination(request.query); const search = String(request.query.search || '')
  const where: Prisma.InvitationWhereInput = search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : {}
  const [rows, total] = await Promise.all([prisma.invitation.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }), prisma.invitation.count({ where })])
  response.json(pageResult(rows.map((row) => invitationDto(row)), total, page, pageSize))
})
app.post('/api/admin/invitations', async (request, response) => {
  const input = parse(invitationSchema, request.body); const token = newInvitationToken()
  const contact = input.contactId ? await prisma.externalContact.findUnique({ where: { id: input.contactId } }) : null
  if (input.contactId && !contact) return response.status(404).json({ code: 'CONTACT_NOT_FOUND', message: 'Contact not found.' })
  const invitation = await prisma.invitation.create({ data: { ...input, contactId: input.contactId || null, email: input.email?.toLowerCase(), expiresAt: input.expiresAt ? new Date(input.expiresAt) : null, tokenHash: hashInvitationToken(token), tokenEncrypted: encryptToken(token) }, include: { contact: true } })
  void sendInvitationCreatedNotification({ id: invitation.id, contactName: invitation.contact?.name, contactPhone: invitation.contact?.phoneNumber, role: invitation.role, type: invitation.type }).catch((error) => { console.error('Unable to send invitation notification:', error instanceof Error ? error.message : error) })
  response.status(201).json({ invitation: invitationDto(invitation, true) })
})
app.get('/api/admin/invitations/:id', async (request, response) => {
  const invitation = await prisma.invitation.findUniqueOrThrow({ where: { id: request.params.id } }); response.json({ invitation: invitationDto(invitation, true) })
})
app.post('/api/admin/invitations/:id/revoke', async (request, response) => response.json({ invitation: invitationDto(await prisma.invitation.update({ where: { id: request.params.id }, data: { revokedAt: new Date() } })) }))
app.post('/api/admin/invitations/:id/regenerate', async (request, response) => {
  const token = newInvitationToken(); const invitation = await prisma.invitation.update({ where: { id: request.params.id }, data: { tokenHash: hashInvitationToken(token), tokenEncrypted: encryptToken(token), revokedAt: null, usedAt: null } })
  response.json({ invitation: invitationDto(invitation, true) })
})
app.get('/api/admin/invitations/:id/qr.:format', async (request, response) => {
  const invitation = await prisma.invitation.findUniqueOrThrow({ where: { id: request.params.id } })
  const url = `${process.env.PUBLIC_APP_URL || 'http://localhost:5173'}/invite/${decryptToken(invitation.tokenEncrypted)}`
  if (request.params.format === 'svg') { response.type('image/svg+xml').send(await QRCode.toString(url, { type: 'svg', margin: 2 })); return }
  if (request.params.format === 'png') { response.type('image/png').send(await QRCode.toBuffer(url, { type: 'png', width: 640, margin: 2 })); return }
  response.status(404).json({ code: 'NOT_FOUND', message: 'QR format not found.' })
})

app.get('/api/admin/users', async (request, response) => {
  const { page, pageSize, skip } = pagination(request.query); const search = String(request.query.search || '')
  const where: Prisma.UserWhereInput = search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : {}
  const [rows, total] = await Promise.all([prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }), prisma.user.count({ where })])
  response.json(pageResult(rows.map(publicUser), total, page, pageSize))
})
app.patch('/api/admin/users/:id/status', async (request, response) => {
  const input = parse(userStatusSchema, request.body)
  if (request.params.id === request.user!.id && input.status === 'DISABLED') return response.status(400).json({ code: 'SELF_DISABLE', message: 'You cannot disable your own account.' })
  response.json({ user: publicUser(await prisma.user.update({ where: { id: request.params.id }, data: input })) })
})

app.get('/api/admin/settings', async (_request, response) => response.json({ settings: await prisma.businessSettings.findUnique({ where: { id: 'default' } }) }))
const googleOAuthStates = new Map<string, { userId: string; expires: number }>()
function googleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) throw Object.assign(new Error('Google OAuth client credentials are not configured.'), { status: 503, code: 'CALENDAR_NOT_CONFIGURED' })
  const redirect = new URL('/google-oauth-callback.html', process.env.PUBLIC_ADMIN_URL || 'http://localhost:5174').toString()
  return new google.auth.OAuth2(clientId, clientSecret, redirect)
}
app.post('/api/admin/settings/google-calendar/oauth/start', (request, response) => {
  const client = googleOAuthClient()
  const state = randomBytes(32).toString('base64url')
  for (const [key, value] of googleOAuthStates) if (value.expires < Date.now()) googleOAuthStates.delete(key)
  googleOAuthStates.set(state, { userId: request.user!.id, expires: Date.now() + 10 * 60_000 })
  const scopes = ['https://www.googleapis.com/auth/calendar.events']
  if (process.env.GOOGLE_CONTACTS_ENABLED?.toLowerCase() === 'true') scopes.push('https://www.googleapis.com/auth/contacts.readonly')
  response.json({ url: client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: scopes, state }) })
})
app.post('/api/admin/settings/google-calendar/oauth/complete', async (request, response) => {
  const { state, code } = request.body || {}
  if (typeof state !== 'string' || typeof code !== 'string' || code.length > 4096) return response.status(400).json({ message: 'Invalid OAuth response.' })
  const pending = googleOAuthStates.get(state)
  googleOAuthStates.delete(state)
  if (!pending || pending.userId !== request.user!.id || pending.expires < Date.now()) return response.status(400).json({ message: 'OAuth session expired or invalid.' })
  const client = googleOAuthClient()
  const { tokens } = await client.getToken(code)
  if (!tokens.refresh_token) return response.status(400).json({ message: 'Google did not provide a refresh token. Please try again.' })
  client.setCredentials(tokens)
  await google.calendar({ version: 'v3', auth: client }).events.list({ calendarId: process.env.GOOGLE_CALENDAR_ID?.trim() || 'primary', maxResults: 1 })
  const refreshTokenEncrypted = encryptToken(tokens.refresh_token)
  await prisma.googleOAuthCredential.upsert({ where: { id: 'default' }, create: { id: 'default', refreshTokenEncrypted }, update: { refreshTokenEncrypted } })
  response.json({ status: 'CONNECTED' })
})

app.get('/api/admin/settings/google-calendar', async (_request, response) => response.json(await checkCalendarConnection()))
app.put('/api/admin/settings', async (request, response) => {
  const input = parse(settingsSchema, request.body)
  response.json({ settings: await prisma.businessSettings.upsert({ where: { id: 'default' }, update: input, create: input }) })
})

app.use((_request, response) => response.status(404).json({ code: 'NOT_FOUND', message: 'Endpoint not found.' }))
app.use((error: AppError, _request: Request, response: Response, _next: NextFunction) => {
  const prismaNotFound = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
  const status = prismaNotFound ? 404 : error.status || 500
  if (status >= 500) console.error(error)
  response.status(status).json({ code: prismaNotFound ? 'NOT_FOUND' : error.code || 'INTERNAL_ERROR', message: prismaNotFound ? 'Record not found.' : error.status ? error.message : 'Something went wrong on the server.', fieldErrors: error.fieldErrors })
})

export default app
