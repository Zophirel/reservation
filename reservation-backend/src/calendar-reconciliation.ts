import { isCalendarEnabled, isCalendarSyncTokenExpired, listCalendarEvents, type CalendarEventSnapshot } from './google-calendar.js'
import { prisma } from './prisma.js'

type KnownCalendarReservation = { calendarEventId: string | null }

export function deletedCalendarEventIds(events: CalendarEventSnapshot[], reservations: KnownCalendarReservation[], fullSync: boolean) {
  const cancelledIds = new Set(events.filter((event) => event.status === 'cancelled').map((event) => event.id))
  if (!fullSync) return Array.from(cancelledIds)

  const activeIds = new Set(events.filter((event) => event.status !== 'cancelled').map((event) => event.id))
  for (const reservation of reservations) {
    if (reservation.calendarEventId && !activeIds.has(reservation.calendarEventId)) cancelledIds.add(reservation.calendarEventId)
  }
  return Array.from(cancelledIds)
}

type ReconciliationResult = {
  configured: boolean
  fullSync: boolean
  checked: number
  cancelled: number
}

let reconciliationInFlight: Promise<ReconciliationResult> | null = null

export function reconcileGoogleCalendarDeletions() {
  if (!reconciliationInFlight) {
    reconciliationInFlight = runReconciliation().finally(() => {
      reconciliationInFlight = null
    })
  }
  return reconciliationInFlight
}

async function runReconciliation(): Promise<ReconciliationResult> {
  if (!isCalendarEnabled()) return { configured: false, fullSync: false, checked: 0, cancelled: 0 }

  const previous = await prisma.calendarSyncState.findUnique({ where: { id: 'google' } })
  let syncToken = previous?.syncToken || undefined
  let fullSync = !syncToken
  let snapshot

  try {
    snapshot = await listCalendarEvents(syncToken)
    if (previous && previous.calendarId !== snapshot.calendarId) {
      syncToken = undefined
      fullSync = true
      snapshot = await listCalendarEvents()
    }
  } catch (error) {
    if (syncToken && isCalendarSyncTokenExpired(error)) {
      fullSync = true
      snapshot = await listCalendarEvents()
    } else {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'Google Calendar reverse synchronization failed.'
      if (previous) await prisma.calendarSyncState.update({ where: { id: 'google' }, data: { lastError: message } })
      throw error
    }
  }

  const reservations = await prisma.reservation.findMany({
    where: { status: 'CONFIRMED', calendarEventId: { not: null } },
    select: { calendarEventId: true },
  })
  const deletedIds = deletedCalendarEventIds(snapshot.events, reservations, fullSync)
  const now = new Date()
  let cancelled = 0

  for (let offset = 0; offset < deletedIds.length; offset += 500) {
    const ids = deletedIds.slice(offset, offset + 500)
    const result = await prisma.reservation.updateMany({
      where: { status: 'CONFIRMED', calendarEventId: { in: ids } },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
        calendarSyncStatus: 'DELETED',
        calendarSyncError: null,
        calendarSyncedAt: now,
      },
    })
    cancelled += result.count
  }

  await prisma.calendarSyncState.upsert({
    where: { id: 'google' },
    update: { calendarId: snapshot.calendarId, syncToken: snapshot.nextSyncToken, lastSyncedAt: now, lastError: null },
    create: { id: 'google', calendarId: snapshot.calendarId, syncToken: snapshot.nextSyncToken, lastSyncedAt: now },
  })

  return { configured: true, fullSync, checked: snapshot.events.length, cancelled }
}
