import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'

export type ContactSource = 'DEVICE' | 'GOOGLE'

export function normalizePhone(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const country = (process.env.DEFAULT_PHONE_COUNTRY?.trim().toUpperCase() || 'IT') as CountryCode
  const parsed = parsePhoneNumberFromString(trimmed, country)
  if (parsed?.isValid()) return parsed.number
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return ''
  return digits.startsWith('00') ? `+${digits.slice(2)}` : `${trimmed.startsWith('+') ? '+' : ''}${digits}`
}