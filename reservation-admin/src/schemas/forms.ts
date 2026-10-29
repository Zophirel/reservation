import { z } from 'zod'

const emptyStringToUndefined = (value: unknown) => typeof value === 'string' && value.trim() === '' ? undefined : value

export const invitationFormSchema = z.object({
  type: z.enum(['ONE_TIME', 'PERMANENT']),
  name: z.preprocess(emptyStringToUndefined, z.string().trim().optional()),
  email: z.preprocess(emptyStringToUndefined, z.email().optional()),
  phoneNumber: z.preprocess(emptyStringToUndefined, z.string().trim().max(30).optional()),
  role: z.enum(['ADMIN', 'CUSTOMER']),
  expiresAt: z.string().optional(),
  description: z.preprocess(emptyStringToUndefined, z.string().trim().max(500).optional()),
  contactId: z.preprocess(emptyStringToUndefined, z.uuid().optional()),
}).superRefine((value, context) => {
  if (value.type === 'PERMANENT' && !value.name) context.addIssue({ code: 'custom', path: ['name'], message: 'Name is required.' })
  if (value.type === 'ONE_TIME' && !value.email && !value.phoneNumber) context.addIssue({ code: 'custom', path: ['email'], message: 'Email or telephone is required.' })
})

export const scheduleDaySchema = z.object({
  weekday: z.number().int().min(1).max(7),
  enabled: z.boolean(),
  intervals: z.array(z.object({ start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) }).refine((value) => value.start < value.end)),
})
