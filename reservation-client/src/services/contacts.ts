import { Capacitor } from '@capacitor/core'
import { Contacts } from '@capacitor-community/contacts'
import { api } from '@/services/api'

export async function syncDeviceContacts() {
  if (!Capacitor.isNativePlatform()) throw new Error('Device contacts are available only in the mobile app.')
  const permission = await Contacts.requestPermissions()
  if (permission.contacts !== 'granted' && permission.contacts !== 'limited') throw new Error('Contacts permission was not granted.')
  const result = await Contacts.getContacts({ projection: { name: true, phones: true } })
  const contacts = result.contacts.flatMap((contact) => {
    const name = contact.name?.display || [contact.name?.given, contact.name?.family].filter(Boolean).join(' ')
    return (contact.phones || []).filter((phone) => phone.number && name).map((phone) => ({ externalId: `${contact.contactId}:${phone.number}`, name: name!, phoneNumber: phone.number! }))
  })
  return api<{ contacts: unknown[] }>('/contacts/device', { method: 'POST', body: JSON.stringify({ contacts }) })
}