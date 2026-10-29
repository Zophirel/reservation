import { DateTime } from 'luxon'
import { z } from 'zod'

const emptyStringToUndefined = (value: unknown) => typeof value === 'string' && value.trim() === '' ? undefined : value
const optionalTrimmedString = (max: number) => z.preprocess(emptyStringToUndefined, z.string().trim().max(max).optional())

export const loginSchema = z.object({ email: z.email(), password: z.string().min(8).max(200) })
export const registerSchema = z.object({ token: z.string().min(20), name: z.string().trim().min(2).max(80), email: z.email(), phoneNumber: z.string().trim().max(30).optional(), password: z.string().min(8).max(200) })
export const profileSchema = z.object({ name: z.string().trim().min(2).max(80), phoneNumber: z.string().trim().max(30).nullable().optional() })
export const serviceSchema = z.object({ name: z.string().trim().min(2).max(100), description: z.string().trim().max(500).nullable().optional(), durationMinutes: z.number().int().min(5).max(480), enabled: z.boolean().default(true) })
export const reservationSchema = z.object({ serviceId: z.uuid(), startAt: z.iso.datetime() })
export const calendarRangeSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
}).refine((value) => value.from <= value.to, { path: ['to'], message: 'End date must not be before start date.' })
export const invitationSchema = z.object({
  type: z.enum(['ONE_TIME', 'PERMANENT']),
  name: optionalTrimmedString(100),
  email: z.preprocess(emptyStringToUndefined, z.email().optional()),
  phoneNumber: optionalTrimmedString(30),
  role: z.enum(['ADMIN', 'CUSTOMER']).default('CUSTOMER'),
  description: optionalTrimmedString(500),
  expiresAt: z.iso.datetime().nullable().optional(),
  contactId: z.uuid().nullable().optional(),
}).superRefine((value, context) => {
  if (value.type === 'ONE_TIME' && !value.email && !value.phoneNumber) context.addIssue({ code: 'custom', path: ['email'], message: 'Email or telephone is required.' })
  if (value.type === 'PERMANENT' && !value.name) context.addIssue({ code: 'custom', path: ['name'], message: 'Name is required.' })
})

export const intervalSchema = z.object({ start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }).refine((value) => value.start < value.end, 'End must be after start.')
export const daySchema = z.object({ weekday: z.number().int().min(1).max(7), enabled: z.boolean(), intervals: z.array(intervalSchema).max(8) }).superRefine((value, context) => {
  const sorted = [...value.intervals].sort((a, b) => a.start.localeCompare(b.start))
  if (sorted.some((interval, index) => index > 0 && interval.start < sorted[index - 1]!.end)) context.addIssue({ code: 'custom', path: ['intervals'], message: 'Intervals cannot overlap.' })
})
export const weeklySchema = z.object({ days: z.array(daySchema).length(7) })
export const exceptionSchema = z.object({ date: z.iso.date(), type: z.enum(['DAY_OFF', 'SPECIAL_HOURS']), reason: z.string().trim().max(200).optional(), intervals: z.array(intervalSchema).max(8).default([]) }).superRefine((value, context) => {
  if (value.type === 'SPECIAL_HOURS' && value.intervals.length === 0) context.addIssue({ code: 'custom', path: ['intervals'], message: 'Special hours require an interval.' })
})
export const settingsSchema = z.object({ businessName: z.string().trim().min(2).max(100), timezone: z.string().refine((zone) => DateTime.now().setZone(zone).isValid, 'Invalid IANA timezone.'), slotIntervalMinutes: z.number().int().min(5).max(120), bookingWindow: z.enum(['WEEK', 'MONTH']).default('MONTH') })
export const userStatusSchema = z.object({ status: z.enum(['ACTIVE', 'DISABLED']) })
export const pushTokenSchema = z.object({ token: z.string().trim().min(20).max(4096), platform: z.literal('WEB').default('WEB') })
export const externalContactsSchema = z.object({ contacts: z.array(z.object({ externalId: z.string().trim().min(1).max(300), name: z.string().trim().min(1).max(200), phoneNumber: z.string().trim().min(3).max(50) })).max(2000) })
export const contactAssociationSchema = z.object({ userId: z.uuid() })
