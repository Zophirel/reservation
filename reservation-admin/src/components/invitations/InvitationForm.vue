<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'
import { api } from '@/services/api'
import { invitationFormSchema } from '@/schemas/forms'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Cloud, Smartphone, UserRound, X } from '@lucide/vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Invitation } from '@/types'

const emit = defineEmits<{ created: [invitation: Invitation] }>()
const { t } = useI18n()
const open = ref(false); const saving = ref(false)
type Contact = { id: string; name: string; phoneNumber: string; source: 'DEVICE' | 'GOOGLE' }
const contacts = ref<Contact[]>([])
const contactsOpen = ref(false); const contactSearch = ref('')
const form = reactive({ type: 'ONE_TIME', name: '', email: '', phoneNumber: '', role: 'CUSTOMER', expiresAt: '', description: '', contactId: '' })
async function loadContacts() { try { contacts.value = (await api<{ contacts: Contact[] }>('/admin/contacts')).contacts } catch { /* Contact selection remains optional. */ } }
const filteredContacts = computed(() => { const query = contactSearch.value.trim().toLowerCase(); if (!query) return contacts.value; return contacts.value.filter((contact) => `${contact.name} ${contact.phoneNumber}`.toLowerCase().includes(query)) })
const selectedContact = computed(() => contacts.value.find((contact) => contact.id === form.contactId) || null)
function chooseContact(contact: Contact) { form.contactId = contact.id; form.phoneNumber = contact.phoneNumber; contactsOpen.value = false; contactSearch.value = '' }
function clearContact() { form.contactId = ''; form.phoneNumber = '' }
async function submit() { const selectedContact = contacts.value.find((contact) => contact.id === form.contactId); const valuesToValidate = { ...form, name: form.name || (form.type === 'PERMANENT' ? selectedContact?.name : ''), phoneNumber: form.phoneNumber || selectedContact?.phoneNumber }; const validation = invitationFormSchema.safeParse(valuesToValidate); if (!validation.success) { toast.error(t('invitations.checkFields')); return } saving.value = true; try { const values = validation.data; const result = await api<{ invitation: Invitation }>('/admin/invitations', { method: 'POST', body: JSON.stringify({ type: values.type, role: values.role, name: values.type === 'PERMANENT' ? values.name : undefined, email: values.type === 'ONE_TIME' ? values.email : undefined, phoneNumber: values.phoneNumber, contactId: values.contactId || null, expiresAt: values.type === 'ONE_TIME' && values.expiresAt ? new Date(values.expiresAt).toISOString() : null, description: values.description }) }); emit('created', result.invitation); open.value = false; toast.success(t('invitations.created')) } catch (error) { toast.error(error instanceof Error ? error.message : t('invitations.createError')) } finally { saving.value = false } }
onMounted(loadContacts)
</script>
<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child><Button>{{ t('invitations.create') }}</Button></DialogTrigger>
    <DialogContent class="flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] flex-col overflow-hidden p-0 sm:h-[min(42rem,calc(100dvh-2rem))] sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg">
      <Transition name="contact-view" mode="out-in">
        <form v-if="!contactsOpen" key="form" class="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-8 sm:py-6" @submit.prevent="submit">
          <DialogHeader><DialogTitle>{{ t('invitations.create') }}</DialogTitle><DialogDescription>{{ t('invitations.createDescription') }}</DialogDescription></DialogHeader>
          <Label>{{ t('invitations.invitationType') }}<Select v-model="form.type"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ONE_TIME">{{ t('common.oneTime') }}</SelectItem><SelectItem value="PERMANENT">{{ t('common.permanent') }}</SelectItem></SelectContent></Select></Label>
          <div class="grid gap-2"><div class="flex items-center justify-between gap-3"><Label>{{ t('invitations.contact') }}</Label><Button v-if="selectedContact" type="button" variant="ghost" size="sm" class="h-auto px-2 py-1 text-xs" @click="clearContact"><X class="size-3.5" />{{ t('invitations.removeContact') }}</Button></div><Button type="button" variant="outline" class="h-auto min-h-10 justify-start px-3 py-2 text-left" @click="contactsOpen = true"><template v-if="selectedContact"><Cloud v-if="selectedContact.source === 'GOOGLE'" class="size-4 shrink-0 text-muted-foreground" /><Smartphone v-else class="size-4 shrink-0 text-muted-foreground" /><span class="min-w-0"><strong class="block truncate">{{ selectedContact.name }}</strong><span class="block truncate text-xs text-muted-foreground">{{ selectedContact.phoneNumber }}</span></span></template><span v-else class="text-muted-foreground">{{ t('invitations.chooseContact') }}</span></Button></div>
          <Label v-if="form.type === 'PERMANENT'">{{ t('common.name') }}<Input v-model="form.name" required /></Label>
          <template v-else><Label>{{ t('common.email') }}<Input v-model="form.email" type="email" /></Label><Label>{{ t('invitations.expiration') }}<Input v-model="form.expiresAt" type="datetime-local" /></Label></template>
          <Label>{{ t('invitations.optionalTelephone') }}<Input v-model="form.phoneNumber" type="tel" :readonly="Boolean(selectedContact)" /></Label><Label>{{ t('common.role') }}<Select v-model="form.role"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CUSTOMER">{{ t('common.customer') }}</SelectItem><SelectItem value="ADMIN">{{ t('common.administrator') }}</SelectItem></SelectContent></Select></Label><Label>{{ t('common.description') }}<Input v-model="form.description" /></Label>
          <DialogFooter><Button type="button" variant="outline" @click="open = false">{{ t('common.cancel') }}</Button><Button type="submit" :disabled="saving">{{ saving ? t('invitations.creating') : t('invitations.create') }}</Button></DialogFooter>
        </form>
        <div v-else key="contacts" class="grid min-h-0 flex-1 grid-rows-[auto_auto_minmax(0,1fr)] gap-5 overflow-hidden px-6 py-5 sm:px-8 sm:py-6">
          <DialogHeader><Button type="button" variant="ghost" class="-ml-2 w-fit px-2" @click="contactsOpen = false"><ArrowLeft class="size-4" />{{ t('common.back') }}</Button><DialogTitle>{{ t('invitations.chooseContact') }}</DialogTitle><DialogDescription>{{ t('invitations.chooseContactDescription') }}</DialogDescription></DialogHeader>
          <Input v-model="contactSearch" :placeholder="t('invitations.searchContacts')" />
          <div class="min-h-0 space-y-2 overflow-y-auto pr-1"><Button v-for="contact in filteredContacts" :key="contact.id" type="button" variant="outline" class="h-auto w-full justify-start px-3 py-3 text-left" @click="chooseContact(contact)"><Cloud v-if="contact.source === 'GOOGLE'" class="size-4 shrink-0 text-muted-foreground" /><Smartphone v-else class="size-4 shrink-0 text-muted-foreground" /><span class="min-w-0"><strong class="block truncate">{{ contact.name }}</strong><span class="block truncate text-xs text-muted-foreground">{{ contact.phoneNumber }}</span></span></Button><div v-if="!filteredContacts.length" class="grid justify-items-center gap-2 py-10 text-center text-sm text-muted-foreground"><UserRound class="size-5" />{{ t('invitations.noContacts') }}</div></div>
        </div>
      </Transition>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.contact-view-enter-active,
.contact-view-leave-active {
  transition: transform 220ms ease, opacity 220ms ease;
}

.contact-view-enter-from {
  opacity: 0;
  transform: translateX(2rem);
}

.contact-view-leave-to {
  opacity: 0;
  transform: translateX(-2rem);
}
</style>
