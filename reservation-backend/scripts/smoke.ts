import 'dotenv/config'

process.env.DATABASE_URL ||= 'postgresql://reservation:reservation@localhost:5432/reservation?schema=public'

const base = process.env.API_URL || 'http://localhost:3000/api'
const suffix = Date.now().toString()

async function call<T>(path: string, options: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...requestOptions } = options
  const response = await fetch(`${base}${path}`, { ...requestOptions, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) } })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw Object.assign(new Error(data?.message), { status: response.status, data })
  return data
}

const admin = await call<any>('/auth/login', { method: 'POST', body: JSON.stringify({ email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com', password: process.env.SEED_ADMIN_PASSWORD || 'change-me-now' }) })
const days = Array.from({ length: 7 }, (_, index) => ({ weekday: index + 1, enabled: true, intervals: [{ start: '09:00', end: '17:00' }] }))
await call('/admin/availability/weekly', { method: 'PUT', token: admin.token, body: JSON.stringify({ days }) })
const { service } = await call<any>('/admin/services', { method: 'POST', token: admin.token, body: JSON.stringify({ name: `Consultation ${suffix}`, durationMinutes: 60, enabled: true }) })

async function makeCustomer(number: number) {
  const email = `customer-${suffix}-${number}@example.com`
  const { invitation } = await call<any>('/admin/invitations', { method: 'POST', token: admin.token, body: JSON.stringify({ type: 'ONE_TIME', email, role: 'CUSTOMER' }) })
  const invitationToken = invitation.url.split('/').pop()
  return call<any>('/auth/register', { method: 'POST', body: JSON.stringify({ token: invitationToken, name: `Customer ${number}`, email, password: 'customer-pass-123' }) })
}

const first = await makeCustomer(1)
const second = await makeCustomer(2)
const { slots } = await call<any>(`/availability?serviceId=${service.id}&date=2099-12-21`)
if (!slots.length) throw new Error('Expected at least one available slot.')
const attempts = await Promise.allSettled([
  call<any>('/reservations', { method: 'POST', token: first.token, body: JSON.stringify({ serviceId: service.id, startAt: slots[0].startAt }) }),
  call<any>('/reservations', { method: 'POST', token: second.token, body: JSON.stringify({ serviceId: service.id, startAt: slots[0].startAt }) }),
])
const winner = attempts.find((attempt): attempt is PromiseFulfilledResult<any> => attempt.status === 'fulfilled')
const loser = attempts.find((attempt): attempt is PromiseRejectedResult => attempt.status === 'rejected')
const conflict = { status: (loser?.reason as any)?.status, code: (loser?.reason as any)?.data?.code }
if (!winner || attempts.filter((attempt) => attempt.status === 'fulfilled').length !== 1) throw new Error('Exactly one concurrent reservation must succeed.')
if (conflict.status !== 409 || conflict.code !== 'SLOT_UNAVAILABLE') throw new Error('Expected the overlapping reservation to return SLOT_UNAVAILABLE.')
if (winner.value.reservation.status !== 'PENDING') throw new Error('A new reservation must wait for administrator approval.')
const afterPending = await call<any>(`/availability?serviceId=${service.id}&date=2099-12-21`)
if (afterPending.slots.some((slot: any) => slot.startAt === slots[0].startAt)) throw new Error('A pending reservation must block its slot.')
const approved = await call<any>(`/admin/reservations/${winner.value.reservation.id}/confirm`, { method: 'POST', token: admin.token })
if (approved.reservation.status !== 'CONFIRMED') throw new Error('Administrator approval must confirm the reservation.')
const cancelled = await call<any>(`/admin/reservations/${winner.value.reservation.id}/cancel`, { method: 'POST', token: admin.token })
if (cancelled.reservation.status !== 'CANCELLED') throw new Error('Administrator cancellation must cancel the reservation.')
console.log(JSON.stringify({ admin: admin.user.role, service: service.name, slots: slots.length, reservation: { pending: winner.value.reservation.status, approved: approved.reservation.status, cancelled: cancelled.reservation.status }, conflict }, null, 2))

const { PrismaClient } = await import('@prisma/client')
const prisma = new PrismaClient()
await prisma.reservation.deleteMany({ where: { serviceId: service.id } })
await prisma.user.deleteMany({ where: { email: { contains: suffix } } })
await prisma.invitation.deleteMany({ where: { email: { contains: suffix } } })
await prisma.service.delete({ where: { id: service.id } })
await prisma.$disconnect()
