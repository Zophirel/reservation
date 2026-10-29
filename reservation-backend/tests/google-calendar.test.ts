import { afterEach, describe, expect, it } from 'vitest'
import { CalendarConfigError, calendarEventBusyInterval, createCalendarEvent } from '../src/google-calendar.js'

const originalEnvironment = {
  enabled: process.env.GOOGLE_CALENDAR_ENABLED,
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
}

afterEach(() => {
  for (const [key, value] of Object.entries({
    GOOGLE_CALENDAR_ENABLED: originalEnvironment.enabled,
    GOOGLE_CLIENT_ID: originalEnvironment.clientId,
    GOOGLE_CLIENT_SECRET: originalEnvironment.clientSecret,
    GOOGLE_REFRESH_TOKEN: originalEnvironment.refreshToken,
  })) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('Google Calendar configuration', () => {
  it('does not call Google when synchronization is disabled', async () => {
    process.env.GOOGLE_CALENDAR_ENABLED = 'false'
    await expect(createCalendarEvent({ id: 'reservation-1', startAt: new Date(), endAt: new Date(), user: { name: 'Test', email: 'test@example.com' }, service: { name: 'Consultation' } }, 'Europe/Rome')).rejects.toBeInstanceOf(CalendarConfigError)
  })

  it('rejects incomplete OAuth configuration without exposing credentials', async () => {
    process.env.GOOGLE_CALENDAR_ENABLED = 'true'
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
    delete process.env.GOOGLE_REFRESH_TOKEN
    await expect(createCalendarEvent({ id: 'reservation-1', startAt: new Date(), endAt: new Date(), user: { name: 'Test', email: 'test@example.com' }, service: { name: 'Consultation' } }, 'Europe/Rome')).rejects.toMatchObject({ code: 'CALENDAR_NOT_CONFIGURED' })
  })
})

describe('Google Calendar busy intervals', () => {
  it('maps timed and all-day busy events to UTC intervals', () => {
    expect(calendarEventBusyInterval({
      status: 'confirmed',
      start: { dateTime: '2026-09-22T13:00:00+02:00' },
      end: { dateTime: '2026-09-22T14:00:00+02:00' },
    }, 'Europe/Rome')).toEqual({
      startAt: new Date('2026-09-22T11:00:00.000Z'),
      endAt: new Date('2026-09-22T12:00:00.000Z'),
    })

    expect(calendarEventBusyInterval({
      status: 'confirmed',
      start: { date: '2026-09-22' },
      end: { date: '2026-09-23' },
    }, 'Europe/Rome')).toEqual({
      startAt: new Date('2026-09-21T22:00:00.000Z'),
      endAt: new Date('2026-09-22T22:00:00.000Z'),
    })
  })

  it('does not block cancelled, free, or working-location events', () => {
    const range = { start: { dateTime: '2026-09-22T13:00:00Z' }, end: { dateTime: '2026-09-22T14:00:00Z' } }
    expect(calendarEventBusyInterval({ ...range, status: 'cancelled' }, 'Europe/Rome')).toBeNull()
    expect(calendarEventBusyInterval({ ...range, transparency: 'transparent' }, 'Europe/Rome')).toBeNull()
    expect(calendarEventBusyInterval({ ...range, eventType: 'workingLocation' }, 'Europe/Rome')).toBeNull()
  })
})
