<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Cloud, Link2, Phone, RefreshCw, Smartphone, Unlink2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/layout/PageHeader.vue'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { api } from '@/services/api'
import type { User } from '@/types'

type Contact = { id: string; source: 'DEVICE' | 'GOOGLE'; name: string; phoneNumber: string; matchedUser?: Pick<User, 'id' | 'name' | 'email' | 'phoneNumber'> | null }
const contacts = ref<Contact[]>([])
const search = ref('')
const loading = ref(false)
const syncing = ref(false)
const users = ref<User[]>([])
const selectedContact = ref<Contact | null>(null)
const userSearch = ref('')
const associating = ref(false)
const dissociating = ref(false)
const associationDialogOpen = ref(false)
const dissociationDialogOpen = ref(false)
const { t } = useI18n()
async function load() { loading.value = true; try { contacts.value = (await api<{ contacts: Contact[] }>(`/admin/contacts?search=${encodeURIComponent(search.value)}`)).contacts } catch (error) { toast.error(error instanceof Error ? error.message : t('contacts.loadError')) } finally { loading.value = false } }
async function loadUsers() { try { users.value = (await api<{ items: User[] }>('/admin/users?pageSize=100')).items } catch (error) { toast.error(error instanceof Error ? error.message : t('contacts.usersLoadError')) } }
async function syncGoogle() { syncing.value = true; try { await api('/admin/contacts/google/sync', { method: 'POST' }); toast.success(t('contacts.synced')); await load() } catch (error) { toast.error(error instanceof Error ? error.message : t('contacts.syncError')) } finally { syncing.value = false } }
function openAssociation(contact: Contact) { selectedContact.value = contact; userSearch.value = ''; associationDialogOpen.value = true }
function openDissociation(contact: Contact) { selectedContact.value = contact; dissociationDialogOpen.value = true }
async function associate(user: User) { if (!selectedContact.value) return; associating.value = true; try { await api(`/admin/contacts/${selectedContact.value.id}/associate`, { method: 'POST', body: JSON.stringify({ userId: user.id }) }); toast.success(t('contacts.associated')); associationDialogOpen.value = false; selectedContact.value = null; await load() } catch (error) { toast.error(error instanceof Error ? error.message : t('contacts.associateError')) } finally { associating.value = false } }
async function dissociate() { if (!selectedContact.value) return; dissociating.value = true; try { await api(`/admin/contacts/${selectedContact.value.id}/associate`, { method: 'DELETE' }); toast.success(t('contacts.dissociated')); dissociationDialogOpen.value = false; selectedContact.value = null; await load() } catch (error) { toast.error(error instanceof Error ? error.message : t('contacts.dissociateError')) } finally { dissociating.value = false } }
const filteredUsers = computed(() => { const query = userSearch.value.trim().toLowerCase(); if (!query) return users.value; return users.value.filter((user) => `${user.name} ${user.email} ${user.phoneNumber || ''}`.toLowerCase().includes(query)) })
function initials(name: string) { return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() }
onMounted(async () => { await Promise.all([load(), loadUsers()]) })
</script>
<template>
  <div class="w-full min-w-0 overflow-x-hidden">
    <PageHeader :title="t('nav.contacts')" :description="t('contacts.description')" />
    <div class="mb-4 flex min-w-0 flex-wrap gap-2"><Input v-model="search" class="min-w-0 max-w-sm flex-1" :placeholder="t('contacts.placeholder')" @keyup.enter="load" /><Button variant="outline" @click="load">{{ t('common.filter') }}</Button><Button variant="outline" :disabled="syncing" @click="syncGoogle"><RefreshCw class="size-4" :class="syncing ? 'animate-spin' : ''" />{{ t('contacts.syncGoogle') }}</Button></div>
    <Card class="w-full min-w-0 overflow-hidden">
      <CardHeader class="min-w-0 border-b bg-muted/20">
        <CardTitle>{{ t('contacts.addressBook') }}</CardTitle>
        <CardDescription>{{ contacts.length }} {{ t('contacts.addressBookCount') }}</CardDescription>
      </CardHeader>
      <CardContent class="min-w-0 p-4">
        <div v-if="loading" class="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3"><div v-for="index in 6" :key="index" class="h-44 min-w-0 animate-pulse rounded-xl bg-muted/50" /></div>
        <div v-else-if="contacts.length" class="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Card v-for="contact in contacts" :key="contact.id" class="w-full min-w-0 shadow-none transition-colors hover:border-primary/40">
            <CardContent class="min-w-0 p-4">
              <div class="flex min-w-0 items-start gap-3">
              <Avatar class="size-11 bg-accent text-accent-foreground"><AvatarFallback class="bg-accent font-semibold">{{ initials(contact.name) }}</AvatarFallback></Avatar>
              <div class="min-w-0 flex-1">
                <div class="flex min-w-0 items-start justify-between gap-2"><h3 class="min-w-0 flex-1 truncate font-semibold">{{ contact.name }}</h3><Badge variant="outline" class="max-w-[45%] shrink-0 sm:max-w-none"><Cloud v-if="contact.source === 'GOOGLE'" /> <Smartphone v-else /><span class="min-w-0 truncate">{{ contact.source === 'GOOGLE' ? t('contacts.google') : t('contacts.device') }}</span></Badge></div>
                <a class="mt-1 flex min-w-0 items-center gap-1.5 truncate text-sm text-muted-foreground hover:text-foreground" :href="`tel:${contact.phoneNumber}`"><Phone class="size-3.5" />{{ contact.phoneNumber }}</a>
              </div>
              </div>
              <Separator class="my-4" />
              <div class="flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span v-if="contact.matchedUser" class="min-w-0 text-xs text-muted-foreground"><span class="block">{{ t('contacts.associatedWith') }}</span><strong class="block truncate text-foreground">{{ contact.matchedUser.name }}</strong></span>
                <span v-else class="text-xs text-muted-foreground">{{ t('contacts.unmatched') }}</span>
                <Button variant="outline" size="sm" class="w-full shrink-0 sm:w-auto" @click="contact.matchedUser ? openDissociation(contact) : openAssociation(contact)"><Unlink2 v-if="contact.matchedUser" class="size-4" /><Link2 v-else class="size-4" />{{ contact.matchedUser ? t('contacts.dissociate') : t('contacts.associate') }}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <p v-else class="py-12 text-center text-sm text-muted-foreground">{{ t('contacts.empty') }}</p>
      </CardContent>
    </Card>
    <Dialog :open="associationDialogOpen" @update:open="(open) => { associationDialogOpen = open; if (!open) selectedContact = null }"><DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{{ t('contacts.associateTitle') }}</DialogTitle><DialogDescription>{{ selectedContact?.name }} · {{ selectedContact?.phoneNumber }}</DialogDescription></DialogHeader><Input v-model="userSearch" :placeholder="t('contacts.userSearch')" /><div class="grid max-h-96 gap-2 overflow-y-auto pr-1"><Button v-for="user in filteredUsers" :key="user.id" variant="outline" class="h-auto justify-start px-3 py-3 text-left" :disabled="associating" @click="associate(user)"><span class="min-w-0"><strong class="block truncate">{{ user.name }}</strong><span class="block truncate text-xs text-muted-foreground">{{ user.email }}<span v-if="user.phoneNumber"> · {{ user.phoneNumber }}</span></span></span></Button><p v-if="!filteredUsers.length" class="py-8 text-center text-sm text-muted-foreground">{{ t('contacts.noUsers') }}</p></div></DialogContent></Dialog>
    <AlertDialog :open="dissociationDialogOpen" @update:open="(open) => { dissociationDialogOpen = open; if (!open) selectedContact = null }"><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{{ t('contacts.dissociateTitle') }}</AlertDialogTitle><AlertDialogDescription>{{ t('contacts.dissociateQuestion') }}</AlertDialogDescription></AlertDialogHeader><div v-if="selectedContact" class="rounded-lg border bg-muted/40 p-4 text-sm"><p class="font-semibold">{{ selectedContact.name }}</p><p class="text-muted-foreground">{{ selectedContact.phoneNumber }}</p><p v-if="selectedContact.matchedUser" class="mt-2 text-muted-foreground">{{ selectedContact.matchedUser.name }} · {{ selectedContact.matchedUser.email }}</p></div><AlertDialogFooter><AlertDialogCancel :disabled="dissociating">{{ t('common.cancel') }}</AlertDialogCancel><AlertDialogAction :disabled="dissociating" @click="dissociate">{{ t('contacts.confirmDissociate') }}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>
</template>
