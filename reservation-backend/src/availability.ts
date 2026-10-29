import type { PrismaClient, Prisma } from '@prisma/client'
import { DateTime } from 'luxon'
import { listCalendarBusyIntervals } from './google-calendar.js'

export type TimeInterval = { start: string; end: string }
export type AvailableSlot = { startAt: string; endAt: string; label: string }

function asIntervals(value: Prisma.JsonValue): TimeInterval[] {
  return Array.isArray(value) ? value.filter((item): item is TimeInterval => Boolean(item && typeof item === 'object' && 'start' in item && 'end' in item)) : []
}

export function getBookingDateRange(timezone: string, bookingWindow: 'WEEK' | 'MONTH'): { from: string; to: string } {
  const from = DateTime.now().setZone(timezone).startOf('day')
  const to = bookingWindow === 'WEEK' ? from.plus({ days: 6 }) : from.plus({ months: 1 }).minus({ days: 1 })
  return { from: from.toISODate()!, to: to.toISODate()! }
}

export async function calculateAvailableDates(db: PrismaClient | Prisma.TransactionClient, month: string): Promise<string[]> {
  const settings = await db.businessSettings.findUnique({ where: { id: 'default' } })
  const timezone = settings?.timezone || 'Europe/Rome'
  const { from: bookingFromDate, to: bookingToDate } = getBookingDateRange(timezone, settings?.bookingWindow || 'MONTH')
  const monthStart = DateTime.fromFormat(month, 'yyyy-MM', { zone: timezone }).startOf('month')
  if (!monthStart.isValid || monthStart.toFormat('yyyy-MM') !== month) throw Object.assign(new Error('Invalid month.'), { status: 400, code: 'INVALID_MONTH' })

  const monthEnd = monthStart.endOf('month')
  const rangeStartUtc = monthStart.toUTC().toJSDate()
  const rangeEndUtc = monthEnd.plus({ days: 1 }).startOf('day').toUTC().toJSDate()
  const [services, weeklyDays, exceptions, reservations, calendarBusy] = await Promise.all([
    db.service.findMany({ where: { enabled: true }, select: { durationMinutes: true } }),
    db.weeklyAvailability.findMany(),
    db.availabilityException.findMany({
      where: { date: { gte: new Date(`${monthStart.toISODate()}T00:00:00.000Z`), lte: new Date(`${monthEnd.toISODate()}T00:00:00.000Z`) } },
    }),
    db.reservation.findMany({
      where: { status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { lt: rangeEndUtc }, endAt: { gt: rangeStartUtc } },
      select: { startAt: true, endAt: true },
    }),
    listCalendarBusyIntervals(rangeStartUtc, rangeEndUtc, timezone),
  ])
  if (!services.length) return []

  const weeklyByDay = new Map(weeklyDays.map((day) => [day.weekday, day]))
  const exceptionsByDate = new Map(exceptions.map((exception) => [exception.date.toISOString().slice(0, 10), exception]))
  const now = Date.now()
  const step = settings?.slotIntervalMinutes || 30
  const availableDates: string[] = []
  const busyIntervals = [...reservations, ...calendarBusy]

  for (let day = monthStart; day <= monthEnd; day = day.plus({ days: 1 })) {
    const date = day.toISODate()!
    if ((bookingFromDate && date < bookingFromDate) || (bookingToDate && date > bookingToDate)) continue
    const exception = exceptionsByDate.get(date)
    const weekly = weeklyByDay.get(day.weekday)
    const intervals = exception
      ? exception.type === 'DAY_OFF' ? [] : asIntervals(exception.intervals)
      : weekly?.enabled ? asIntervals(weekly.intervals) : []
    if (!intervals.length) continue

    const hasSlot = services.some((service) => intervals.some((interval) => {
      let cursor = DateTime.fromISO(`${date}T${interval.start}`, { zone: timezone })
      const intervalEnd = DateTime.fromISO(`${date}T${interval.end}`, { zone: timezone })
      while (cursor.plus({ minutes: service.durationMinutes }) <= intervalEnd) {
        const end = cursor.plus({ minutes: service.durationMinutes })
        const startMillis = cursor.toUTC().toMillis()
        const endMillis = end.toUTC().toMillis()
        const overlaps = busyIntervals.some((item) => item.startAt.getTime() < endMillis && item.endAt.getTime() > startMillis)
        if (cursor.toMillis() > now && !overlaps) return true
        cursor = cursor.plus({ minutes: step })
      }
      return false
    }))
    if (hasSlot) availableDates.push(date)
  }

  return availableDates
}

export async function calculateAvailability(db: PrismaClient | Prisma.TransactionClient, serviceId: string, date: string): Promise<AvailableSlot[]> {
  const [service, settings] = await Promise.all([
    db.service.findFirst({ where: { id: serviceId, enabled: true } }),
    db.businessSettings.findUnique({ where: { id: 'default' } }),
  ])
  if (!service) throw Object.assign(new Error('Service not found.'), { status: 404, code: 'SERVICE_NOT_FOUND' })
  const timezone = settings?.timezone || 'Europe/Rome'
  const { from: bookingFromDate, to: bookingToDate } = getBookingDateRange(timezone, settings?.bookingWindow || 'MONTH')
  if ((bookingFromDate && date < bookingFromDate) || (bookingToDate && date > bookingToDate)) return []
  const day = DateTime.fromISO(date, { zone: timezone }).startOf('day')
  if (!day.isValid) throw Object.assign(new Error('Invalid date.'), { status: 400, code: 'INVALID_DATE' })

  const exceptionDate = new Date(`${date}T00:00:00.000Z`)
  const [exception, weekly] = await Promise.all([
    db.availabilityException.findUnique({ where: { date: exceptionDate } }),
    db.weeklyAvailability.findUnique({ where: { weekday: day.weekday } }),
  ])
  let intervals: TimeInterval[] = []
  if (exception) intervals = exception.type === 'DAY_OFF' ? [] : asIntervals(exception.intervals)
  else if (weekly?.enabled) intervals = asIntervals(weekly.intervals)
  if (!intervals.length) return []

  const dayStartUtc = day.toUTC().toJSDate()
  const dayEndUtc = day.plus({ days: 1 }).toUTC().toJSDate()
  const [reservations, calendarBusy] = await Promise.all([
    db.reservation.findMany({ where: { status: { in: ['PENDING', 'CONFIRMED'] }, startAt: { lt: dayEndUtc }, endAt: { gt: dayStartUtc } }, select: { startAt: true, endAt: true } }),
    listCalendarBusyIntervals(dayStartUtc, dayEndUtc, timezone),
  ])
  const step = settings?.slotIntervalMinutes || 30
  const slots: AvailableSlot[] = []
  const busyIntervals = [...reservations, ...calendarBusy]
  for (const interval of intervals) {
    let cursor = DateTime.fromISO(`${date}T${interval.start}`, { zone: timezone })
    const intervalEnd = DateTime.fromISO(`${date}T${interval.end}`, { zone: timezone })
    while (cursor.plus({ minutes: service.durationMinutes }) <= intervalEnd) {
      const end = cursor.plus({ minutes: service.durationMinutes })
      const startMillis = cursor.toUTC().toMillis()
      const endMillis = end.toUTC().toMillis()
      const overlaps = busyIntervals.some((item) => item.startAt.getTime() < endMillis && item.endAt.getTime() > startMillis)
      if (cursor.toMillis() > Date.now() && !overlaps) slots.push({ startAt: cursor.toUTC().toISO()!, endAt: end.toUTC().toISO()!, label: cursor.toFormat('HH:mm') })
      cursor = cursor.plus({ minutes: step })
    }
  }
  return slots
}
