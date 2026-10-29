<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Bell, CalendarClock, CalendarRange, ContactRound, LayoutDashboard, Link2, LogOut, Settings, Users, Wrench } from '@lucide/vue'
import BrandMark from '@/components/BrandMark.vue'
import LocaleSwitcher from '@/components/LocaleSwitcher.vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/services/api'
import { listenForAdminPushMessages, registerGrantedAdminPush } from '@/services/push'

const route = useRoute(); const router = useRouter(); const auth = useAuthStore()
const { t, locale } = useI18n()
const clientUrl = import.meta.env.VITE_CLIENT_URL || 'http://localhost:5173'
const notificationsOpen = ref(false)
const queuedReservation = ref<PendingReservationPreview | null>(null)
const pendingReservations = ref<PendingReservationPreview[]>([])
const pendingRequestCount = computed(() => pendingReservations.value.length)
const items = [
  { to: '/', label: 'nav.dashboard', icon: LayoutDashboard }, { to: '/reservations', label: 'nav.reservations', icon: CalendarClock }, { to: '/availability', label: 'nav.availability', icon: CalendarRange }, { to: '/services', label: 'nav.services', icon: Wrench }, { to: '/invitations', label: 'nav.invitations', icon: Link2 }, { to: '/users', label: 'nav.users', icon: Users }, { to: '/contacts', label: 'nav.contacts', icon: ContactRound }, { to: '/settings', label: 'nav.settings', icon: Settings },
]
let stopPushListener: () => void = () => undefined
let pendingPoll: number | null = null
let notificationOpenTimer: number | null = null
let pendingCheckInFlight = false
let pendingRefreshQueued = false
let pendingSnapshotInitialized = false
const notifiedRequests = new Set<string>()
const foregroundNotifications = new Map<string, Notification>()
const notificationDebugPrefix = '[reservio:notifications]'

type PendingReservationPreview = { id: string; startAt: string; user?: { name: string }; service: { name: string } }

function selectPendingReservation(event: Event, reservation: PendingReservationPreview) {
  // Reka closes the menu after emitting `select`. Keep that close controlled so
  // the reservation dialog is not mounted while the dropdown still owns focus.
  event.preventDefault()
  console.log(notificationDebugPrefix, 'notification list item selected', {
    reservationId: reservation.id,
    currentRoute: router.currentRoute.value.fullPath,
    dropdownOpen: notificationsOpen.value,
  })
  queuedReservation.value = reservation
  notificationsOpen.value = false
}

function onNotificationsCloseAutoFocus(event: Event) {
  const reservation = queuedReservation.value
  console.log(notificationDebugPrefix, 'dropdown close autofocus reached', {
    reservationId: reservation?.id,
    currentRoute: router.currentRoute.value.fullPath,
  })
  if (!reservation) return

  // Do not restore focus to the bell immediately before opening another modal.
  event.preventDefault()
  queuedReservation.value = null
  if (notificationOpenTimer !== null) window.clearTimeout(notificationOpenTimer)
  notificationOpenTimer = window.setTimeout(() => {
    notificationOpenTimer = null
    console.log(notificationDebugPrefix, 'dropdown fully closed; opening reservation', { reservationId: reservation.id })
    void openNotificationTarget(`${window.location.origin}/reservations?reservation=${encodeURIComponent(reservation.id)}`, reservation.id).catch((error) => {
      console.error(notificationDebugPrefix, 'failed to open notification list item', {
        reservationId: reservation.id,
        currentRoute: router.currentRoute.value.fullPath,
        error,
      })
    })
  }, 0)
}

function formatPendingDate(value: string) {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function logout() { auth.logout(); router.push('/login') }

async function openNotificationTarget(link?: string, reservationId?: string) {
  console.log(notificationDebugPrefix, 'open target requested', {
    link,
    reservationId,
    currentRoute: router.currentRoute.value.fullPath,
  })
  if (!link) {
    console.warn(notificationDebugPrefix, 'open target ignored because the link is missing', { reservationId })
    return
  }
  try {
    const target = new URL(link, window.location.origin)
    if (reservationId && !target.searchParams.has('reservation')) target.searchParams.set('reservation', reservationId)
    const location = `${target.pathname}${target.search}${target.hash}`
    console.log(notificationDebugPrefix, 'notification target resolved', {
      reservationId,
      location,
      currentRoute: router.currentRoute.value.fullPath,
    })

    if (router.currentRoute.value.fullPath === location && reservationId) {
      // Vue Router ignores navigation to the exact same location. This fallback
      // also covers a repeated click while the deep-link is still in the URL.
      await nextTick()
      console.log(notificationDebugPrefix, 'same route; dispatching direct open event', { reservationId })
      window.dispatchEvent(new CustomEvent('reservio-open-reservation', { detail: { reservationId } }))
      return
    }
    console.log(notificationDebugPrefix, 'starting router navigation', { reservationId, location })
    await router.push(location)
    console.log(notificationDebugPrefix, 'router navigation completed', {
      reservationId,
      currentRoute: router.currentRoute.value.fullPath,
    })
  } catch (error) {
    console.error(notificationDebugPrefix, 'open target failed', {
      link,
      reservationId,
      currentRoute: router.currentRoute.value.fullPath,
      error,
    })
    throw error
  }
}

function showRequestNotice(key: string | null, title: string, body: string, link?: string, reservationId?: string) {
  if (key && notifiedRequests.has(key)) return
  if (key) notifiedRequests.add(key)

  // Keep an in-app fallback visible on mobile browsers, where a foreground
  // Notification may be suppressed even though permission is granted.
  toast.info(title, {
    description: body,
    action: link ? { label: t('push.openRequest'), onClick: () => openNotificationTarget(link, reservationId) } : undefined,
  })
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notification = new Notification(title, { body, tag: key || 'reservio-push' })
      if (key) foregroundNotifications.set(key, notification)
      notification.onclose = () => { if (key) foregroundNotifications.delete(key) }
      notification.onclick = () => {
        window.focus()
        void openNotificationTarget(link, reservationId)
        notification.close()
      }
    } catch {
      // The toast above is the fallback for browsers that disallow foreground notifications.
    }
  }
}

async function refreshPendingReservations() {
  if (pendingCheckInFlight) {
    pendingRefreshQueued = true
    return
  }
  pendingCheckInFlight = true
  try {
    const result = await api<{ reservations: PendingReservationPreview[] }>('/admin/reservations/pending')
    pendingReservations.value = result.reservations
    if (pendingSnapshotInitialized) {
      for (const reservation of result.reservations.slice().reverse()) {
        if (!notifiedRequests.has(reservation.id)) {
          const link = `${window.location.origin}/reservations?reservation=${encodeURIComponent(reservation.id)}`
          showRequestNotice(reservation.id, t('push.newRequest'), `${reservation.user?.name || t('common.customer')} · ${reservation.service.name}`, link, reservation.id)
        }
      }
    }
    pendingSnapshotInitialized = true
  } catch {
    // Push/polling are optional and must not interrupt the admin UI.
  } finally {
    pendingCheckInFlight = false
    if (pendingRefreshQueued) {
      pendingRefreshQueued = false
      void refreshPendingReservations()
    }
  }
}

async function dismissReservationNotifications(reservationId: string) {
  foregroundNotifications.get(reservationId)?.close()
  foregroundNotifications.delete(reservationId)
  try {
    const registrations = await navigator.serviceWorker?.getRegistrations()
    const notifications = await Promise.all((registrations || []).map((registration) => registration.getNotifications()))
    notifications.flat().forEach((notification) => {
      const data = notification.data || {}
      const fcmData = data.FCM_MSG?.data || {}
      if (notification.tag === reservationId || data.reservationId === reservationId || fcmData.reservationId === reservationId) notification.close()
    })
  } catch {
    // Notification cleanup is best-effort and must not affect reservation actions.
  }
}

async function connectPushListener() {
  stopPushListener()
  try {
    await registerGrantedAdminPush()
    stopPushListener = await listenForAdminPushMessages((payload) => {
      const title = payload.notification?.title || payload.data?.title || t('push.newRequest')
      const body = payload.notification?.body || payload.data?.body || t('push.newRequestDescription')
      showRequestNotice(payload.data?.reservationId || null, title, body, payload.data?.link, payload.data?.reservationId)
    })
  } catch {
    // Push is optional and should not affect the admin application.
  }
}
function onPushEnabled() { void connectPushListener() }
function onVisibilityChange() { if (document.visibilityState === 'visible') void refreshPendingReservations() }
function onServiceWorkerMessage(event: MessageEvent<{ type?: string; reservationId?: string; link?: string }>) {
  console.log(notificationDebugPrefix, 'service worker message received', event.data)
  if (event.data?.type === 'RESERVIO_OPEN_RESERVATION') {
    void openNotificationTarget(event.data.link, event.data.reservationId).catch((error) => {
      console.error(notificationDebugPrefix, 'service worker notification could not be opened', { data: event.data, error })
    })
  }
}
function onReservationStatusChanged(event: Event) {
  const reservationId = (event as CustomEvent<{ reservationId?: string }>).detail?.reservationId
  if (!reservationId) return
  pendingReservations.value = pendingReservations.value.filter((reservation) => reservation.id !== reservationId)
  notifiedRequests.add(reservationId)
  void dismissReservationNotifications(reservationId)
  // Reconcile against the server as well, so actions performed from the
  // calendar and concurrent refreshes cannot leave a stale pending snapshot.
  void refreshPendingReservations()
}
watch(notificationsOpen, (open) => {
  console.log(notificationDebugPrefix, 'notification dropdown changed', {
    open,
    currentRoute: router.currentRoute.value.fullPath,
  })
})
let googlePopup: Window | null = null
async function connectGoogleCalendar() {
  googlePopup = window.open('about:blank', 'reservio-google-oauth', 'popup,width=520,height=700')
  if (!googlePopup) { toast.error('Consenti i popup per collegare Google Calendar.'); return }
  try {
    const result = await api<{ url: string }>('/admin/settings/google-calendar/oauth/start', { method: 'POST' })
    googlePopup.location.href = result.url
  } catch {
    googlePopup.close()
    googlePopup = null
    toast.error('Impossibile avviare il collegamento Google. Verifica la configurazione OAuth.')
  }
}
async function onGoogleOAuthMessage(event: MessageEvent) {
  if (event.origin !== window.location.origin || event.source !== googlePopup || event.data?.type !== 'reservio-google-oauth') return
  googlePopup = null
  if (event.data.error || !event.data.code || !event.data.state) { toast.error('Collegamento Google annullato o non riuscito.'); return }
  try {
    await api('/admin/settings/google-calendar/oauth/complete', { method: 'POST', body: JSON.stringify({ code: event.data.code, state: event.data.state }) })
    toast.success('Google Calendar collegato.')
  } catch { toast.error('Impossibile completare il collegamento Google. Riprova.') }
}
onMounted(() => {
  void api<{ status: string }>('/admin/settings/google-calendar').then((connection) => {
    if (connection.status === 'ERROR' || connection.status === 'NOT_CONFIGURED') {
      toast.error('Google Calendar non è disponibile', {
        description: 'Ricollega il tuo account Google per ripristinare il servizio.',
        duration: Infinity,
        action: { label: 'Ricollega', onClick: () => { void connectGoogleCalendar() } },
      })
    }
  }).catch(() => undefined)
  window.addEventListener('message', onGoogleOAuthMessage)
  window.addEventListener('reservio-push-enabled', onPushEnabled)
  document.addEventListener('visibilitychange', onVisibilityChange)
  navigator.serviceWorker?.addEventListener('message', onServiceWorkerMessage)
  window.addEventListener('reservio-reservation-status-changed', onReservationStatusChanged)
  void connectPushListener()
  void refreshPendingReservations()
  pendingPoll = window.setInterval(() => {
    if (document.visibilityState === 'visible') void refreshPendingReservations()
  }, 15000)
})
onBeforeUnmount(() => {
  window.removeEventListener('message', onGoogleOAuthMessage)
  window.removeEventListener('reservio-push-enabled', onPushEnabled)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  navigator.serviceWorker?.removeEventListener('message', onServiceWorkerMessage)
  window.removeEventListener('reservio-reservation-status-changed', onReservationStatusChanged)
  if (pendingPoll !== null) window.clearInterval(pendingPoll)
  if (notificationOpenTimer !== null) window.clearTimeout(notificationOpenTimer)
  stopPushListener()
})
</script>

<template><SidebarProvider><Sidebar collapsible="offcanvas"><SidebarHeader><RouterLink to="/" class="brand px-2 py-2"><BrandMark /><span>reservio admin</span></RouterLink></SidebarHeader><SidebarContent><SidebarGroup><SidebarGroupLabel>{{ t('nav.backoffice') }}</SidebarGroupLabel><SidebarGroupContent><SidebarMenu><SidebarMenuItem v-for="item in items" :key="item.to"><SidebarMenuButton as-child :is-active="route.path === item.to"><RouterLink :to="item.to"><component :is="item.icon" /><span>{{ t(item.label) }}</span></RouterLink></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent><SidebarFooter><SidebarMenu><SidebarMenuItem><SidebarMenuButton as-child><a :href="clientUrl"><CalendarClock /><span>{{ t('nav.customerApplication') }}</span></a></SidebarMenuButton></SidebarMenuItem><SidebarMenuItem><SidebarMenuButton @click="logout"><LogOut /><span>{{ t('nav.logout') }}</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarFooter></Sidebar><SidebarInset><header class="flex h-12 items-center gap-2 border-b px-3 sm:h-14 sm:gap-3 sm:px-4"><SidebarTrigger /><Separator orientation="vertical" class="hidden h-5 sm:block" /><span class="hidden text-sm text-muted-foreground sm:inline">{{ auth.user?.name }}</span><div class="ml-auto flex items-center gap-1 sm:gap-2"><DropdownMenu v-model:open="notificationsOpen"><DropdownMenuTrigger as-child><Button variant="ghost" size="icon" class="relative" :aria-label="t('push.notifications')"><Bell class="size-4" /><Badge v-if="pendingRequestCount" variant="destructive" class="absolute -right-1 -top-1 min-w-4 justify-center px-1 text-[10px] leading-4">{{ pendingRequestCount > 99 ? '99+' : pendingRequestCount }}</Badge></Button></DropdownMenuTrigger><DropdownMenuContent align="end" class="w-[min(92vw,360px)]" @close-auto-focus="onNotificationsCloseAutoFocus"><DropdownMenuLabel>{{ t('push.notifications') }}</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem v-if="!pendingReservations.length" disabled>{{ t('push.noRequests') }}</DropdownMenuItem><DropdownMenuItem v-for="reservation in pendingReservations" :key="reservation.id" class="block whitespace-normal py-3" @select="selectPendingReservation($event, reservation)"><div class="min-w-0"><p class="truncate font-medium">{{ reservation.user?.name || t('common.customer') }} · {{ reservation.service.name }}</p><p class="text-xs text-muted-foreground">{{ formatPendingDate(reservation.startAt) }}</p><p class="mt-1 text-xs text-amber-600">{{ t('common.status') }}: {{ t('common.statuses.pending') }}</p></div></DropdownMenuItem></DropdownMenuContent></DropdownMenu><LocaleSwitcher /><Button variant="outline" size="sm" class="hidden sm:inline-flex" as-child><a :href="clientUrl">{{ t('nav.customerApp') }}</a></Button></div></header><main class="mx-auto w-full max-w-[1680px] flex-1 p-3 sm:p-4 md:p-8"><RouterView v-slot="{ Component }"><Transition name="admin-page" mode="out-in"><div :key="route.path" class="admin-page-view"><component :is="Component" /></div></Transition></RouterView></main></SidebarInset></SidebarProvider></template>
