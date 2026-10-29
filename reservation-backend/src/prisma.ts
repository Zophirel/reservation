import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

export async function ensureDefaults() {
  await prisma.businessSettings.upsert({ where: { id: 'default' }, update: {}, create: {} })
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    await prisma.weeklyAvailability.upsert({
      where: { weekday },
      update: {},
      create: { weekday, enabled: false, intervals: [] },
    })
  }
}
