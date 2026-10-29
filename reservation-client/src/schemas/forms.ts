import { z } from 'zod'

export const invitationFormSchema = z.object({
  type: z.enum(['ONE_TIME', 'PERMANENT']),
  name: z.string().trim().optional(),
  email: z.union([z.email(), z.literal('')]).optional(),
  phoneNumber: z.string().trim().optional(),
  role: z.enum(['ADMIN', 'CUSTOMER']),
  expiresAt: z.string().optional(),
  description: z.string().max(500).optional(),
}).superRefine((value, context) => {
  if (value.type === 'PERMANENT' && !value.name) context.addIssue({ code: 'custom', path: ['name'], message: 'Name is required.' })
  if (value.type === 'ONE_TIME' && !value.email && !value.phoneNumber) context.addIssue({ code: 'custom', path: ['email'], message: 'Email or telephone is required.' })
})

export const scheduleDaySchema = z.object({
  weekday: z.number().int().min(1).max(7),
  enabled: z.boolean(),
  intervals: z.array(z.object({ start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) }).refine((value) => value.start < value.end)),
})
