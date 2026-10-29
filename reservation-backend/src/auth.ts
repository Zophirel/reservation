import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { User } from '@prisma/client'

const scrypt = promisify(scryptCallback)
const secret = process.env.AUTH_SECRET || 'development-only-change-me'
const encryptionKey = createHash('sha256').update(secret).digest()

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = await scrypt(password, salt, 64) as Buffer
  return `${salt}:${derivedKey.toString('hex')}`
}

export async function verifyPassword(password: string, storedHash: string) {
  const [salt, key] = storedHash.split(':')
  if (!salt || !key) return false
  const storedKey = Buffer.from(key, 'hex')
  const derivedKey = await scrypt(password, salt, storedKey.length) as Buffer
  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey)
}

export function createToken(userId: string) {
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Date.now() + 7 * 86400000 })).toString('base64url')
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function verifyToken(token?: string) {
  if (!token) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = createHmac('sha256', secret).update(payload).digest()
  const received = Buffer.from(signature, 'base64url')
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub: string; exp: number }
    return decoded.exp > Date.now() ? decoded.sub : null
  } catch { return null }
}

export function newInvitationToken() {
  return randomBytes(32).toString('base64url')
}

export function hashInvitationToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function encryptToken(token: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.')
}

export function decryptToken(value: string) {
  const [ivValue, tagValue, dataValue] = value.split('.')
  if (!ivValue || !tagValue || !dataValue) throw new Error('Invalid encrypted token')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(ivValue, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(dataValue, 'base64url')), decipher.final()]).toString('utf8')
}

export function publicUser(user: User) {
  return { id: user.id, name: user.name, email: user.email, phoneNumber: user.phoneNumber, role: user.role, status: user.status, createdAt: user.createdAt }
}
