import 'dotenv/config'
import { randomInt } from 'node:crypto'
import { PrismaClient, UserRole, UserStatus } from '@prisma/client'
import { hashPassword } from '../src/auth.js'

const prisma = new PrismaClient()

const names = [
  'Alessandro', 'Andrea', 'Anna', 'Beatrice', 'Carlo', 'Chiara', 'Davide',
  'Elena', 'Federico', 'Francesca', 'Giorgio', 'Giulia', 'Lorenzo', 'Lucia',
  'Marco', 'Martina', 'Matteo', 'Sara', 'Stefano', 'Valentina',
]
const surnames = [
  'Bianchi', 'Bruno', 'Colombo', 'Costa', 'De Luca', 'Esposito', 'Ferrari',
  'Fontana', 'Greco', 'Lombardi', 'Marino', 'Moretti', 'Ricci', 'Rizzo',
  'Romano', 'Rossi', 'Russo', 'Serra', 'Villa', 'Conti',
]

function countFromArgs() {
  const value = Number(process.argv[2] || process.env.BULK_CLIENT_COUNT || 20)
  if (!Number.isInteger(value) || value < 1 || value > 1000) {
    throw new Error('Indica una quantità intera tra 1 e 1000. Esempio: npm run db:seed:clients -- 50')
  }
  return value
}

function slug(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function randomItem<T>(items: T[]) {
  return items[randomInt(items.length)]!
}

function createClient(index: number, batchId: string, passwordHash: string) {
  const name = randomItem(names)
  const surname = randomItem(surnames)
  const fullName = `${name} ${surname}`
  const email = `${slug(name)}.${slug(surname)}.${batchId}.${index}@example.test`
  const phoneNumber = `+39 3${randomInt(100000000, 1000000000)}`

  return {
    name: fullName,
    email,
    phoneNumber,
    passwordHash,
    role: UserRole.CUSTOMER,
    status: UserStatus.ACTIVE,
  }
}

async function main() {
  const count = countFromArgs()
  const password = process.env.BULK_CLIENT_PASSWORD || 'Client123!'
  if (password.length < 8) throw new Error('BULK_CLIENT_PASSWORD deve contenere almeno 8 caratteri.')

  const passwordHash = await hashPassword(password)
  const batchId = `${Date.now()}${randomInt(1000, 9999)}`
  const clients = Array.from({ length: count }, (_, index) => createClient(index + 1, batchId, passwordHash))
  const result = await prisma.user.createMany({ data: clients, skipDuplicates: true })

  console.log(`Inseriti ${result.count} clienti su ${count}.`)
  console.log(`Password comune per i clienti generati: ${password}`)
  console.log('Le email generate usano il dominio example.test e non inviano notifiche.')
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
