import { google, type calendar_v3 } from 'googleapis'
import { DateTime } from 'luxon'
import { prisma } from './prisma.js'
import { decryptToken } from './auth.js'

export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

type CalendarReservation = {
  id: string
  startAt: Date
  endAt: Date
  user: { name: string; email: string; phoneNumber?: string | null }
  service: { name: string }
}

type CalendarConfig = {
  clientId: string
  clientSecret: string
  refreshToken: string
  calendarId: string
  reminderMinutes: number
  reminderMethod: 'popup' | 'email'
}

export class CalendarConfigError extends Error {
  code = 'CALENDAR_NOT_CONFIGURED'
}

async function readConfig(): Promise<CalendarConfig | null> {
  if (process.env.GOOGLE_CALENDAR_ENABLED?.toLowerCase() !== 'true') return null
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) throw new CalendarConfigError('Google Calendar is enabled but its OAuth credentials are incomplete.')
  const stored = await prisma.googleOAuthCredential.findUnique({ where: { id: 'default' } })
  const refreshToken = stored ? decryptToken(stored.refreshTokenEncrypted) : process.env.GOOGLE_REFRESH_TOKEN?.trim()
  const calendarId = process.env.GOOGLE_CALENDAR_ID?.trim() || 'primary'
  const reminderMinutes = Number(process.env.GOOGLE_CALENDAR_REMINDER_MINUTES || 60)
  const reminderMethod = process.env.GOOGLE_CALENDAR_REMINDER_METHOD?.trim().toLowerCase() || 'popup'
  if (!clientId || !clientSecret || !refreshToken) throw new CalendarConfigError('Google Calendar is enabled but its OAuth credentials are incomplete.')
  if (!Number.isInteger(reminderMinutes) || reminderMinutes < 0 || reminderMinutes > 40320) throw new CalendarConfigError('Google Calendar reminder minutes must be an integer between 0 and 40320.')
  if (reminderMethod !== 'popup' && reminderMethod !== 'email') throw new CalendarConfigError('Google Calendar reminder method must be popup or email.')
  return { clientId, clientSecret, refreshToken, calendarId, reminderMinutes, reminderMethod }
}

export function isCalendarEnabled() {
  return process.env.GOOGLE_CALENDAR_ENABLED?.toLowerCase() === 'true'
}

export type CalendarConnectionStatus = 'CONNECTED' | 'DISABLED' | 'NOT_CONFIGURED' | 'ERROR'

export async function checkCalendarConnection(): Promise<{ status: CalendarConnectionStatus; calendarId?: string; message?: string }> {
  if (!isCalendarEnabled()) return { status: 'DISABLED', message: 'Google Calendar synchronization is disabled.' }
  try {
    const config = await readConfig()
    if (!config) return { status: 'NOT_CONFIGURED', message: 'Google Calendar OAuth credentials are incomplete.' }
    await calendarClient(config).events.list({ calendarId: config.calendarId, maxResults: 1, showDeleted: false })
    return { status: 'CONNECTED', calendarId: config.calendarId }
  } catch (error) {
    return { status: 'ERROR', message: error instanceof Error ? error.message.slice(0, 500) : 'Google Calendar connection failed.' }
  }
}

function calendarClient(config: CalendarConfig) {
  const auth = new google.auth.OAuth2(config.clientId, config.clientSecret)
  auth.setCredentials({ refresh_token: config.refreshToken })
  return google.calendar({ version: 'v3', auth })
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 500)
  return 'Google Calendar request failed.'
}

export function isCalendarNotFound(error: unknown) {
  return calendarErrorStatus(error) === 404
}

function calendarErrorStatus(error: unknown) {
  if (typeof error !== 'object' || error === null) return null
  if ('code' in error && Number.isFinite(Number((error as { code?: unknown }).code))) return Number((error as { code?: unknown }).code)
  if ('response' in error) {
    const response = (error as { response?: { status?: unknown } }).response
    if (Number.isFinite(Number(response?.status))) return Number(response?.status)
  }
  return null
}

export function isCalendarSyncTokenExpired(error: unknown) {
  return calendarErrorStatus(error) === 410
}

export type CalendarEventSnapshot = { id: string; status: string | null }
export type CalendarBusyInterval = { startAt: Date; endAt: Date }
export type CalendarBusyEvent = CalendarBusyInterval & {
  id: string
  title: string
  description: string | null
  location: string | null
  htmlLink: string | null
  allDay: boolean
}

export function calendarEventBusyInterval(event: calendar_v3.Schema$Event, timezone: string): CalendarBusyInterval | null {
  if (event.status === 'cancelled' || event.transparency === 'transparent' || event.eventType === 'workingLocation') return null

  const start = event.start?.dateTime
    ? DateTime.fromISO(event.start.dateTime, { setZone: true })
    : event.start?.date ? DateTime.fromISO(event.start.date, { zone: timezone }).startOf('day') : null
  const end = event.end?.dateTime
    ? DateTime.fromISO(event.end.dateTime, { setZone: true })
    : event.end?.date ? DateTime.fromISO(event.end.date, { zone: timezone }).startOf('day') : null
  if (!start?.isValid || !end?.isValid || end <= start) return null
  return { startAt: start.toUTC().toJSDate(), endAt: end.toUTC().toJSDate() }
}

export async function listCalendarBusyEvents(timeMin: Date, timeMax: Date, timezone: string) {
  const config = await readConfig()
  if (!config) return []
  const calendar = calendarClient(config)
  const busy: CalendarBusyEvent[] = []
  let pageToken: string | undefined

  do {
    const result = await calendar.events.list({
      calendarId: config.calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      timeZone: timezone,
      singleEvents: true,
      showDeleted: false,
      orderBy: 'startTime',
      maxResults: 2500,
      pageToken,
    })
    for (const event of result.data.items || []) {
      const interval = calendarEventBusyInterval(event, timezone)
      if (event.id && interval) busy.push({
        id: event.id,
        title: event.summary?.trim() || 'Busy',
        description: event.description?.trim() || null,
        location: event.location?.trim() || null,
        htmlLink: event.htmlLink || null,
        allDay: Boolean(event.start?.date),
        ...interval,
      })
    }
    pageToken = result.data.nextPageToken || undefined
  } while (pageToken)

  return busy
}

export async function listCalendarBusyIntervals(timeMin: Date, timeMax: Date, timezone: string) {
  return (await listCalendarBusyEvents(timeMin, timeMax, timezone)).map(({ startAt, endAt }) => ({ startAt, endAt }))
}

export async function listCalendarEvents(syncToken?: string) {
  const config = await readConfig()
  if (!config) throw new CalendarConfigError('Google Calendar synchronization is disabled.')
  const calendar = calendarClient(config)
  const events: CalendarEventSnapshot[] = []
  let pageToken: string | undefined
  let nextSyncToken: string | undefined

  do {
    const result = await calendar.events.list({
      calendarId: config.calendarId,
      maxResults: 2500,
      pageToken,
      ...(syncToken ? { syncToken } : { showDeleted: true }),
    })
    for (const event of result.data.items || []) {
      if (event.id) events.push({ id: event.id, status: event.status || null })
    }
    pageToken = result.data.nextPageToken || undefined
    nextSyncToken = result.data.nextSyncToken || nextSyncToken
  } while (pageToken)

  if (!nextSyncToken) throw new Error('Google Calendar did not return a synchronization token.')
  return { calendarId: config.calendarId, events, nextSyncToken }
}

export async function createCalendarEvent(reservation: CalendarReservation, timezone: string) {
  const config = await readConfig()
  if (!config) throw new CalendarConfigError('Google Calendar synchronization is disabled.')
  const calendar = calendarClient(config)
  const event: calendar_v3.Schema$Event = {
    id: `r${reservation.id.replaceAll('-', '').toLowerCase()}`,
    summary: `${reservation.service.name} — ${reservation.user.name}`,
    description: [
      `Cliente: ${reservation.user.name}`,
      `Email: ${reservation.user.email}`,
      reservation.user.phoneNumber ? `Telefono: ${reservation.user.phoneNumber}` : null,
      `Prenotazione: ${reservation.id}`,
    ].filter(Boolean).join('\n'),
    visibility: 'private',
    reminders: { useDefault: false, overrides: [{ method: config.reminderMethod, minutes: config.reminderMinutes }] },
    start: { dateTime: reservation.startAt.toISOString(), timeZone: timezone },
    end: { dateTime: reservation.endAt.toISOString(), timeZone: timezone },
  }
  try {
    const result = await calendar.events.insert({
      calendarId: config.calendarId,
      requestBody: event,
      sendUpdates: 'none',
    })
    if (!result.data.id) throw new Error('Google Calendar returned an event without an id.')
    return result.data.id
  } catch (error) {
    if (error instanceof CalendarConfigError) throw error
    if (typeof error === 'object' && error !== null && 'code' in error && Number((error as { code?: unknown }).code) === 409) return event.id!
    throw new Error(errorMessage(error))
  }
}

export async function deleteCalendarEvent(eventId: string) {
  const config = await readConfig()
  if (!config) throw new CalendarConfigError('Google Calendar synchronization is disabled.')
  try {
    await calendarClient(config).events.delete({ calendarId: config.calendarId, eventId, sendUpdates: 'none' })
  } catch (error) {
    if (isCalendarNotFound(error)) return
    throw new Error(errorMessage(error))
  }
}
