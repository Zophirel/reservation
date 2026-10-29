import 'dotenv/config'
import { PrismaClient, UserRole } from '@prisma/client'
import { hashPassword } from '../src/auth.js'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.SEED_ADMIN_PASSWORD
  const name = process.env.SEED_ADMIN_NAME?.trim() || 'Administrator'
  if (!email || !password || password.length < 8) throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (8+ characters).')

  const passwordHash = await hashPassword(password)
  await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: UserRole.ADMIN, status: 'ACTIVE' },
    create: { name, email, passwordHash, role: UserRole.ADMIN },
  })

  await prisma.businessSettings.upsert({ where: { id: 'default' }, update: {}, create: {} })
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    await prisma.weeklyAvailability.upsert({
      where: { weekday },
      update: {},
      create: { weekday, enabled: weekday <= 5, intervals: weekday <= 5 ? [{ start: '09:00', end: '17:00' }] : [] },
    })
  }
  console.log(`Administrator ready: ${email}`)
}

main().finally(() => prisma.$disconnect())
