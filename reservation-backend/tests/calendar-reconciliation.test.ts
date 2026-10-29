import { describe, expect, it } from 'vitest'
import { deletedCalendarEventIds } from '../src/calendar-reconciliation.js'

describe('Google Calendar deletion reconciliation', () => {
  it('returns only explicit deletions during an incremental sync', () => {
    expect(deletedCalendarEventIds([
      { id: 'active-event', status: 'confirmed' },
      { id: 'deleted-event', status: 'cancelled' },
    ], [
      { calendarEventId: 'active-event' },
      { calendarEventId: 'deleted-event' },
      { calendarEventId: 'unchanged-event' },
    ], false)).toEqual(['deleted-event'])
  })

  it('also detects missing events during a full sync', () => {
    expect(new Set(deletedCalendarEventIds([
      { id: 'active-event', status: 'confirmed' },
      { id: 'deleted-event', status: 'cancelled' },
    ], [
      { calendarEventId: 'active-event' },
      { calendarEventId: 'deleted-event' },
      { calendarEventId: 'missing-event' },
      { calendarEventId: null },
    ], true))).toEqual(new Set(['deleted-event', 'missing-event']))
  })
})
