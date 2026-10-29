import { describe, expect, it } from 'vitest'
import { invitationFormSchema, scheduleDaySchema } from './forms'

describe('invitation form', () => {
  it('requires a permanent invitation name', () => expect(invitationFormSchema.safeParse({ type: 'PERMANENT', role: 'CUSTOMER' }).success).toBe(false))
  it('accepts a one-time email invitation', () => expect(invitationFormSchema.safeParse({ type: 'ONE_TIME', role: 'CUSTOMER', email: 'customer@example.com' }).success).toBe(true))
})

describe('schedule day', () => {
  it('rejects an interval ending before it starts', () => expect(scheduleDaySchema.safeParse({ weekday: 1, enabled: true, intervals: [{ start: '17:00', end: '09:00' }] }).success).toBe(false))
})
