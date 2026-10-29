<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, CalendarDays, CalendarPlus, Check, ChevronRight, ContactRound, Edit3, Heart, History, LogOut, Mail, MapPin, MessageSquare, Phone, Shield, Trash2, UserRound, Zap } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'
import AppShell from '@/components/AppShell.vue'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth'
import { useReservationStore } from '@/stores/reservations'
import { syncDeviceContacts } from '@/services/contacts'

const auth = useAuthStore(); const store = useReservationStore(); const router = useRouter()
const { t, locale } = useI18n()
const name = ref(auth.user?.name || '')
const phoneNumber = ref(auth.user?.phoneNumber || '')
const saved = ref(false); const cancelId = ref<string | null>(null); const editing = ref(false)
const quickBooking = ref(true); const remindersEnabled = ref(true); const syncingContacts = ref(false)
const nextReservation = computed(() => store.upcoming[0] || null)
const completedReservations = computed(() => store.reservations.filter((item) => item.status !== 'CANCELLED' && new Date(item.startAt) < new Date()))
const lastReservation = computed(() => [...completedReservations.value].sort((a, b) => b.startAt.localeCompare(a.startAt))[0] || null)

async function saveProfile() { try { await auth.updateProfile({ name: name.value, phoneNumber: phoneNumber.value || null }); if (syncingContacts.value === false) { try { syncingContacts.value = true; const result = await syncDeviceContacts(); toast.success(t('account.contactsSynced', { count: result.contacts.length })) } catch { /* Contacts are optional on web and denied devices. */ } finally { syncingContacts.value = false } } saved.value = true; editing.value = false; toast.success(t('account.profileUpdated')); setTimeout(() => saved.value = false, 1500) } catch (error) { toast.error(error instanceof Error ? error.message : t('account.saveError')) } }
function logout() { auth.logout(); router.push('/auth') }
async function syncContacts() { syncingContacts.value = true; try { const result = await syncDeviceContacts(); toast.success(t('account.contactsSynced', { count: result.contacts.length })) } catch (error) { toast.error(error instanceof Error ? error.message : t('account.contactsSyncError')) } finally { syncingContacts.value = false } }
async function cancelReservation() { if (!cancelId.value) return; try { await store.cancelReservation(cancelId.value); toast.success(t('account.cancelled')) } catch (error) { toast.error(error instanceof Error ? error.message : t('account.cancelError')) } finally { cancelId.value = null } }
function readableDate(value: string) { return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function readableAppointment(value: string) { return new Intl.DateTimeFormat(locale.value, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(value)) }
function readableTime(value: string) { return new Intl.DateTimeFormat(locale.value, { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
onMounted(async () => { try { await store.loadReservations() } catch { toast.error(t('account.loadError')) } })
</script>

<template>
  <AppShell>
    <section class="profile-page">
      <Card class="profile-hero-card">
        <div class="profile-hero-top">
          <div class="profile-identity">
            <Avatar class="profile-avatar"><AvatarFallback><UserRound :size="25" /></AvatarFallback></Avatar>
            <div class="profile-identity-copy"><h1>{{ auth.user?.name }}</h1><p>{{ auth.user?.email }}</p><span v-if="auth.user?.phoneNumber" class="profile-phone"><Phone :size="13" />{{ auth.user.phoneNumber }}</span></div>
          </div>
          <Button variant="ghost" size="icon" class="profile-edit-button" @click="editing = !editing"><Edit3 :size="18" /></Button>
        </div>
        <div class="profile-status-bar"><span><ContactRound :size="15" />{{ locale === 'it' ? 'Cliente abituale' : 'Regular client' }}</span><small>{{ completedReservations.length }} {{ locale === 'it' ? 'visite completate' : 'completed visits' }}</small></div>
        <form v-if="editing" class="profile-edit-form" @submit.prevent="saveProfile"><Label>{{ t('account.fullName') }}<Input v-model="name" required /></Label><Label>{{ t('account.email') }}<span class="input-with-icon"><Mail :size="17" /><Input :model-value="auth.user?.email" disabled /></span></Label><Label>{{ t('account.telephone') }}<Input v-model="phoneNumber" type="tel" /></Label><Button class="profile-save-button" type="submit"><Check v-if="saved" />{{ saved ? t('account.saved') : t('account.save') }}</Button></form>
      </Card>

      <section class="profile-section appointment-section"><div class="profile-section-heading"><p class="eyebrow">{{ locale === 'it' ? 'Prossimo appuntamento' : 'Next appointment' }}</p><span v-if="nextReservation">{{ locale === 'it' ? 'In arrivo' : 'Upcoming' }}</span></div><Card v-if="nextReservation" class="upcoming-card"><div class="upcoming-top"><Badge class="confirmed-badge">{{ nextReservation.status === 'CONFIRMED' ? (locale === 'it' ? 'Confermato' : 'Confirmed') : t('common.status.pending') }}</Badge><span>{{ locale === 'it' ? 'Senza anticipo' : 'No deposit' }}</span></div><div class="upcoming-datetime"><strong>{{ readableAppointment(nextReservation.startAt) }}</strong><b>{{ readableTime(nextReservation.startAt) }}</b></div><div class="upcoming-service"><span class="upcoming-service-icon"><Zap :size="20" /></span><div><strong>{{ nextReservation.service.name }}</strong><p>{{ t('common.minutes', { count: nextReservation.service.durationMinutes }) }}<span v-if="nextReservation.service.description"> · {{ nextReservation.service.description }}</span></p></div></div><div class="upcoming-location"><MapPin :size="16" />Studio &amp; Barber</div><div class="upcoming-actions"><Button variant="secondary"><CalendarPlus :size="17" />{{ locale === 'it' ? 'Calendario' : 'Calendar' }}</Button><Button variant="secondary"><MapPin :size="17" />{{ locale === 'it' ? 'Indicazioni' : 'Directions' }}</Button></div><Button class="upcoming-manage" @click="router.push('/book')">{{ locale === 'it' ? 'Gestisci o modifica orario' : 'Manage or change time' }}<ChevronRight :size="17" /></Button></Card><Card v-else class="upcoming-card empty-upcoming"><CalendarDays :size="24" /><strong>{{ t('account.emptyTitle') }}</strong><p>{{ t('account.emptyDescription') }}</p><Button as-child><RouterLink to="/book">{{ t('account.bookTime') }}</RouterLink></Button></Card></section>

      <div class="profile-stats"><Card><span>{{ locale === 'it' ? 'Ultimo taglio' : 'Last visit' }}</span><strong>{{ lastReservation ? readableDate(lastReservation.startAt).split(',')[0] : '—' }}</strong><small>{{ lastReservation ? (locale === 'it' ? 'Regolare' : 'On track') : '' }}</small></Card><Card><span>{{ locale === 'it' ? 'Prenotazioni' : 'Bookings' }}</span><strong>{{ store.reservations.length }}</strong><small>{{ locale === 'it' ? 'totali' : 'total' }}</small></Card><Card><span>{{ locale === 'it' ? 'Preferito' : 'Favourite' }}</span><strong>{{ lastReservation?.service.name || '—' }}</strong><small>{{ lastReservation ? t('common.minutes', { count: lastReservation.service.durationMinutes }) : '' }}</small></Card></div>

      <Card class="preferences-card"><p class="profile-card-label">{{ locale === 'it' ? 'Preferenze di prenotazione' : 'Booking preferences' }}</p><button class="preference-row" type="button" :aria-pressed="quickBooking" @click="quickBooking = !quickBooking"><span class="preference-icon preference-icon--positive"><Zap :size="17" /></span><span class="preference-copy"><strong>{{ locale === 'it' ? 'Prenotazione rapida 1-Click' : '1-Click quick booking' }}</strong><small>{{ locale === 'it' ? 'Senza carta di credito né anticipo' : 'No credit card or deposit' }}</small></span><span class="preference-toggle" :class="{ 'preference-toggle--on': quickBooking }"><i></i></span></button><button class="preference-row" type="button" :aria-pressed="remindersEnabled" @click="remindersEnabled = !remindersEnabled"><span class="preference-icon"><MessageSquare :size="17" /></span><span class="preference-copy"><strong>{{ locale === 'it' ? 'Promemoria SMS & WhatsApp' : 'SMS & WhatsApp reminders' }}</strong><small>{{ locale === 'it' ? "24h e 2h prima dell'orario" : '24h and 2h before your appointment' }}</small></span><span class="preference-toggle" :class="{ 'preference-toggle--on': remindersEnabled }"><i></i></span></button></Card>

      <div class="profile-visual-tile" aria-hidden="true"></div>
      <section class="profile-settings"><p class="profile-card-label">{{ locale === 'it' ? 'Impostazioni & account' : 'Settings & account' }}</p><Card class="settings-list"><button type="button" class="settings-row"><span class="settings-icon"><Heart :size="17" /></span><span>{{ locale === 'it' ? 'I miei servizi preferiti' : 'My favourite services' }}</span><ChevronRight :size="18" /></button><button type="button" class="settings-row"><span class="settings-icon"><History :size="17" /></span><span>{{ locale === 'it' ? 'Cronologia appuntamenti passati' : 'Past appointment history' }}</span><ChevronRight :size="18" /></button><button type="button" class="settings-row" :disabled="syncingContacts" @click="syncContacts"><span class="settings-icon"><Bell :size="17" /></span><span>{{ syncingContacts ? '...' : (locale === 'it' ? 'Notifiche e promemoria' : 'Notifications and reminders') }}</span><ChevronRight :size="18" /></button><button type="button" class="settings-row"><span class="settings-icon"><Shield :size="17" /></span><span>{{ locale === 'it' ? 'Privacy e termini del servizio' : 'Privacy and terms of service' }}</span><ChevronRight :size="18" /></button><button type="button" class="settings-row settings-row--logout" @click="logout"><span class="settings-icon"><LogOut :size="17" /></span><span>{{ locale === 'it' ? 'Esci dall’account' : 'Log out' }}</span><ChevronRight :size="18" /></button></Card></section>

      <Card class="reservations-history-card"><div class="section-title"><div><p class="eyebrow">{{ t('account.schedule') }}</p><h2>{{ t('account.reservations') }}</h2></div><span>{{ store.upcoming.length }}</span></div><div v-if="store.loading" class="space-y-3"><Skeleton v-for="n in 3" :key="n" class="h-20" /></div><div v-else-if="store.reservations.length" class="reservation-list"><article v-for="item in store.reservations" :key="item.id" class="reservation-item"><div class="reservation-icon"><CalendarDays /></div><div><strong>{{ item.service.name }}</strong><p>{{ readableDate(item.startAt) }}</p><Badge :variant="item.status === 'CONFIRMED' ? 'default' : 'secondary'" class="mt-2">{{ t(`common.status.${item.status.toLowerCase()}`) }}</Badge></div><Button v-if="['PENDING', 'CONFIRMED'].includes(item.status)" variant="ghost" size="icon" @click="cancelId = item.id"><Trash2 /></Button></article></div></Card>
    </section>
    <AlertDialog :open="Boolean(cancelId)" @update:open="(open) => { if (!open) cancelId = null }"><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{{ t('account.cancelTitle') }}</AlertDialogTitle><AlertDialogDescription>{{ t('account.cancelDescription') }}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{{ t('account.keep') }}</AlertDialogCancel><AlertDialogAction @click="cancelReservation">{{ t('account.cancel') }}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </AppShell>
</template>