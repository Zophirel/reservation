import { google } from 'googleapis'
import { prisma } from './prisma.js'
import { decryptToken } from './auth.js'

type GoogleContactsConfig = { clientId: string; clientSecret: string; refreshToken: string }

export class GoogleContactsConfigError extends Error {
  code = 'GOOGLE_CONTACTS_NOT_CONFIGURED'
}

async function readConfig(): Promise<GoogleContactsConfig> {
  if (process.env.GOOGLE_CONTACTS_ENABLED?.toLowerCase() !== 'true') throw new GoogleContactsConfigError('Google Contacts synchronization is disabled.')
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  const stored = await prisma.googleOAuthCredential.findUnique({ where: { id: 'default' } })
  const refreshToken = stored ? decryptToken(stored.refreshTokenEncrypted) : process.env.GOOGLE_REFRESH_TOKEN?.trim()
  if (!clientId || !clientSecret || !refreshToken) throw new GoogleContactsConfigError('Google Contacts OAuth credentials are incomplete.')
  return { clientId, clientSecret, refreshToken }
}

export async function listGoogleContacts() {
  const config = await readConfig()
  const auth = new google.auth.OAuth2(config.clientId, config.clientSecret)
  auth.setCredentials({ refresh_token: config.refreshToken })
  const people = google.people({ version: 'v1', auth })
  const contacts: { externalId: string; name: string; phoneNumber: string }[] = []
  let pageToken: string | undefined
  do {
    const response = await people.people.connections.list({ resourceName: 'people/me', pageSize: 1000, pageToken, personFields: 'names,phoneNumbers' })
    for (const person of response.data.connections || []) {
      const phoneNumber = person.phoneNumbers?.find((phone) => phone.value)?.value
      if (!phoneNumber) continue
      contacts.push({ externalId: person.resourceName || `google-${contacts.length}`, name: person.names?.[0]?.displayName || phoneNumber, phoneNumber })
    }
    pageToken = response.data.nextPageToken || undefined
  } while (pageToken)
  return contacts
}