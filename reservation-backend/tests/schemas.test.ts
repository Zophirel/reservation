import { describe, expect, it } from 'vitest'
import { calendarRangeSchema, daySchema, invitationSchema, settingsSchema } from '../src/schemas.js'
import { normalizePhone } from '../src/contacts.js'

describe('schedule validation', () => {
  it('rejects overlapping intervals', () => {
    expect(daySchema.safeParse({ weekday: 1, enabled: true, intervals: [{ start: '09:00', end: '12:00' }, { start: '11:00', end: '13:00' }] }).success).toBe(false)
  })
})

describe('booking window validation', () => {
  it('accepts weekly and monthly booking windows', () => {
    expect(settingsSchema.safeParse({ businessName: 'Reservio', timezone: 'Europe/Rome', slotIntervalMinutes: 30, bookingWindow: 'WEEK' }).success).toBe(true)
    expect(settingsSchema.safeParse({ businessName: 'Reservio', timezone: 'Europe/Rome', slotIntervalMinutes: 30, bookingWindow: 'MONTH' }).success).toBe(true)
  })

  it('rejects unsupported booking windows', () => {
    expect(settingsSchema.safeParse({ businessName: 'Reservio', timezone: 'Europe/Rome', slotIntervalMinutes: 30, bookingWindow: 'YEAR' }).success).toBe(false)
  })
})

describe('calendar range validation', () => {
  it('accepts an ordered date range', () => {
    expect(calendarRangeSchema.safeParse({ from: '2026-09-01', to: '2026-10-12' }).success).toBe(true)
  })

  it('rejects a reversed date range', () => {
    expect(calendarRangeSchema.safeParse({ from: '2026-10-12', to: '2026-09-01' }).success).toBe(false)
  })
})

describe('invitation validation', () => {
  it('requires contact details for a one-time invitation', () => {
    expect(invitationSchema.safeParse({ type: 'ONE_TIME', role: 'CUSTOMER' }).success).toBe(false)
  })

  it('accepts a permanent invitation with an empty email and optional telephone', () => {
    const result = invitationSchema.safeParse({ type: 'PERMANENT', role: 'CUSTOMER', name: 'Front desk', email: '', phoneNumber: '+39 333 1234567' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBeUndefined()
      expect(result.data.phoneNumber).toBe('+39 333 1234567')
    }
  })
})

describe('contact phone matching', () => {
  it('normalizes local and international formats to the same number', () => {
    expect(normalizePhone('333 123 4567')).toBe('+393331234567')
    expect(normalizePhone('0039 333 123 4567')).toBe('+393331234567')
    expect(normalizePhone('+39 333 123 4567')).toBe('+393331234567')
  })
})
