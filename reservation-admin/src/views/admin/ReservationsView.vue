<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CalendarClock, Check, ChevronLeft, ChevronRight, Clock3, ExternalLink, MapPin, Mail, RefreshCw, SlidersHorizontal, UserRound, Wrench } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import EventCalendar, { type CalendarBounds, type CalendarRange } from '@/components/reservations/EventCalendar.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/services/api'
import type { CalendarBusyEvent, Page, Reservation, Service, User } from '@/types'

const { t, locale } = useI18n()
const route = useRoute(); const router = useRouter()
const items = ref<Reservation[]>([])
const calendarEvents = ref<CalendarBusyEvent[]>([])
const timezone = ref('Europe/Rome')
const calendarBounds = ref<CalendarBounds>({ oldestStartAt: null, newestStartAt: null })
const loading = ref(false)
const customerId = ref('')
const serviceId = ref('')
const status = ref<'ALL' | 'PENDING' | 'CONFIRMED' | 'CANCELLED'>('ALL')
const filtersOpen = ref(false)
const draftCustomerId = ref('')
const draftServiceId = ref('')
const draftStatus = ref<'ALL' | 'PENDING' | 'CONFIRMED' | 'CANCELLED'>('ALL')
const expandedFilter = ref<'customers' | 'services' | null>(null)
const filterNavigationDirection = ref<'forward' | 'back'>('forward')
const customers = ref<User[]>([])
const services = ref<Service[]>([])
const filterOptionsLoading = ref(false)
const selected = ref<Reservation | null>(null)
const selectedCalendarEvent = ref<CalendarBusyEvent | null>(null)
const selectedDay = ref<string | null>(null)
const cancelId = ref<string | null>(null)
const acting = ref(false)
const deletingCalendarEvent = ref(false)
const openingReservationId = ref<string | null>(null)
let reservationDialogLockUntil = 0
let activeRange: CalendarRange | null = null
let calendarRefreshPoll: number | null = null
let silentCalendarRefreshInFlight = false
let calendarLoadSequence = 0
const reservationDialogDebugPrefix = '[reservio:reservation-dialog]'

function reservationDateKey(value: string) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: timezone.value, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

const filteredItems = computed(() => {
  return items.value.filter((item) => {
    if (status.value !== 'ALL' && item.status !== status.value) return false
    if (customerId.value && item.user?.id !== customerId.value) return false
    if (serviceId.value && item.service.id !== serviceId.value) return false
    return true
  })
})
const activeFilterCount = computed(() => Number(Boolean(customerId.value)) + Number(Boolean(serviceId.value)) + Number(status.value !== 'ALL'))
const selectedCustomerName = computed(() => customers.value.find((customer) => customer.id === draftCustomerId.value)?.name)
const selectedServiceName = computed(() => services.value.find((service) => service.id === draftServiceId.value)?.name)

const selectedDayItems = computed(() => selectedDay.value
  ? filteredItems.value.filter((item) => reservationDateKey(item.startAt) === selectedDay.value)
  : [])

async function load(range = activeRange, silent = false) {
  if (!range) return
  if (silent && silentCalendarRefreshInFlight) return
  activeRange = range
  if (silent) silentCalendarRefreshInFlight = true
  else loading.value = true
  const requestSequence = ++calendarLoadSequence
  try {
    const result = await api<{ reservations: Reservation[]; calendarEvents: CalendarBusyEvent[]; timezone: string; bounds: CalendarBounds }>(`/admin/reservations/calendar?from=${range.from}&to=${range.to}`)
    if (requestSequence !== calendarLoadSequence) return
    items.value = result.reservations
    calendarEvents.value = result.calendarEvents
    if (selectedCalendarEvent.value) {
      selectedCalendarEvent.value = result.calendarEvents.find((event) => event.id === selectedCalendarEvent.value?.id) || null
    }
    if (selected.value) {
      const refreshedSelection = result.reservations.find((reservation) => reservation.id === selected.value?.id)
      if (refreshedSelection) selected.value = refreshedSelection
    }
    timezone.value = result.timezone
    if (calendarBounds.value.oldestStartAt !== result.bounds.oldestStartAt || calendarBounds.value.newestStartAt !== result.bounds.newestStartAt) {
      calendarBounds.value = result.bounds
    }
  } catch (error) {
    if (!silent) toast.error(error instanceof Error ? error.message : t('calendar.loadError'))
  } finally {
    if (silent) silentCalendarRefreshInFlight = false
    else if (requestSequence === calendarLoadSequence) loading.value = false
  }
}

async function openReservationById(reservationId: string, clearRoute = false) {
  console.log(reservationDialogDebugPrefix, 'open by id requested', {
    reservationId,
    clearRoute,
    currentRoute: route.fullPath,
    openingReservationId: openingReservationId.value,
    selectedReservationId: selected.value?.id,
  })
  if (!reservationId) {
    console.warn(reservationDialogDebugPrefix, 'open ignored because reservation id is missing')
    return
  }
  if (openingReservationId.value === reservationId) {
    console.log(reservationDialogDebugPrefix, 'open ignored because this reservation is already loading', { reservationId })
    return
  }
  if (selected.value?.id === reservationId) {
    console.log(reservationDialogDebugPrefix, 'open ignored because this reservation is already selected', { reservationId })
    return
  }
  openingReservationId.value = reservationId
  try {
    const cached = items.value.find((item) => item.id === reservationId)
    console.log(reservationDialogDebugPrefix, cached ? 'reservation found in calendar cache' : 'reservation not cached; loading from API', { reservationId })
    const loaded = cached || (await api<{ reservation: Reservation }>(`/admin/reservations/${encodeURIComponent(reservationId)}`)).reservation
    console.log(reservationDialogDebugPrefix, 'reservation loaded', {
      reservationId,
      status: loaded.status,
      source: cached ? 'calendar-cache' : 'api',
    })
    if (clearRoute && route.query.reservation === reservationId) {
      console.log(reservationDialogDebugPrefix, 'clearing reservation query parameter', { reservationId })
      await router.replace({ query: { ...route.query, reservation: undefined } })
      console.log(reservationDialogDebugPrefix, 'reservation query parameter cleared', {
        reservationId,
        currentRoute: route.fullPath,
      })
    }
    selectedDay.value = null
    selected.value = loaded
    reservationDialogLockUntil = Date.now() + 1000
    await nextTick()
    console.log(reservationDialogDebugPrefix, 'dialog state committed', {
      reservationId,
      dialogOpen: Boolean(selected.value),
      selectedReservationId: selected.value?.id,
      lockUntil: reservationDialogLockUntil,
    })
  } catch (error) {
    console.error(reservationDialogDebugPrefix, 'failed to load or open reservation', {
      reservationId,
      clearRoute,
      currentRoute: route.fullPath,
      error,
    })
    toast.error(error instanceof Error ? error.message : t('calendar.loadError'))
  } finally {
    openingReservationId.value = null
    console.log(reservationDialogDebugPrefix, 'open by id finished', {
      reservationId,
      selectedReservationId: selected.value?.id,
    })
  }
}

async function openReservationFromNotification() {
  const queryValue = route.query.reservation
  const reservationId = typeof queryValue === 'string' ? queryValue : ''
  console.log(reservationDialogDebugPrefix, 'route query inspected', {
    queryValue,
    reservationId,
    currentRoute: route.fullPath,
  })
  if (!reservationId) return
  await openReservationById(reservationId, true)
}

function onExternalReservationOpen(event: Event) {
  const reservationId = (event as CustomEvent<{ reservationId?: string }>).detail?.reservationId
  console.log(reservationDialogDebugPrefix, 'direct open event received', {
    reservationId,
    currentRoute: route.fullPath,
  })
  if (reservationId) void openReservationById(reservationId)
}

function openReservation(reservation: Reservation) {
  selectedDay.value = null
  selected.value = reservation
  reservationDialogLockUntil = Date.now() + 1000
}

function openCalendarEvent(event: CalendarBusyEvent) {
  selectedDay.value = null
  selectedCalendarEvent.value = event
}

async function removeCalendarEvent() {
  const event = selectedCalendarEvent.value
  if (!event) return
  deletingCalendarEvent.value = true
  try {
    await api(`/admin/google-calendar/events/${encodeURIComponent(event.id)}`, { method: 'DELETE' })
    calendarEvents.value = calendarEvents.value.filter((item) => item.id !== event.id)
    selectedCalendarEvent.value = null
    toast.success(t('calendar.googleEventRemoved'))
    await load(activeRange, true)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('calendar.googleEventRemoveError'))
  } finally {
    deletingCalendarEvent.value = false
  }
}

function notifyReservationStatusChanged(reservation: Reservation) {
  window.dispatchEvent(new CustomEvent('reservio-reservation-status-changed', {
    detail: { reservationId: reservation.id, status: reservation.status },
  }))
}

function onReservationDialogOpenChange(open: boolean) {
  console.log(reservationDialogDebugPrefix, 'dialog open state change requested', {
    open,
    selectedReservationId: selected.value?.id,
    lockActive: Date.now() < reservationDialogLockUntil,
    lockUntil: reservationDialogLockUntil,
  })
  if (!open && Date.now() < reservationDialogLockUntil) {
    console.warn(reservationDialogDebugPrefix, 'premature dialog close blocked', { selectedReservationId: selected.value?.id })
    return
  }
  if (!open) selected.value = null
}

watch(() => route.query.reservation, (value, previousValue) => {
  console.log(reservationDialogDebugPrefix, 'reservation query changed', {
    previousValue,
    value,
    currentRoute: route.fullPath,
  })
  void openReservationFromNotification()
}, { immediate: true })
onMounted(() => {
  console.log(reservationDialogDebugPrefix, 'reservations view mounted', { currentRoute: route.fullPath })
  window.addEventListener('reservio-open-reservation', onExternalReservationOpen)
  document.addEventListener('visibilitychange', onCalendarVisibilityChange)
  calendarRefreshPoll = window.setInterval(() => {
    if (document.visibilityState === 'visible' && !loading.value) void load(activeRange, true)
  }, 15000)
  void openReservationFromNotification()
})
onBeforeUnmount(() => {
  console.log(reservationDialogDebugPrefix, 'reservations view unmounting', { currentRoute: route.fullPath })
  window.removeEventListener('reservio-open-reservation', onExternalReservationOpen)
  document.removeEventListener('visibilitychange', onCalendarVisibilityChange)
  if (calendarRefreshPoll !== null) window.clearInterval(calendarRefreshPoll)
})

function onCalendarVisibilityChange() {
  if (document.visibilityState === 'visible' && !loading.value) void load(activeRange, true)
}

function onRangeChange(range: CalendarRange) {
  void load(range)
}

function openFilters() {
  draftCustomerId.value = customerId.value
  draftServiceId.value = serviceId.value
  draftStatus.value = status.value
  expandedFilter.value = null
  filtersOpen.value = true
  void loadFilterOptions()
}

function applyFilters() {
  customerId.value = draftCustomerId.value
  serviceId.value = draftServiceId.value
  status.value = draftStatus.value
  filtersOpen.value = false
}

function resetFilters() {
  draftCustomerId.value = ''
  draftServiceId.value = ''
  draftStatus.value = 'ALL'
}

function openFilterPanel(panel: 'customers' | 'services') {
  filterNavigationDirection.value = 'forward'
  expandedFilter.value = panel
}

function returnToFilters() {
  filterNavigationDirection.value = 'back'
  expandedFilter.value = null
}

function selectCustomer(id: string) {
  draftCustomerId.value = id
  returnToFilters()
}

function selectService(id: string) {
  draftServiceId.value = id
  returnToFilters()
}

async function fetchAll<T>(path: string) {
  const first = await api<Page<T>>(`${path}?page=1&pageSize=100`)
  if (first.pagination.pageCount <= 1) return first.items
  const pages = await Promise.all(Array.from({ length: first.pagination.pageCount - 1 }, (_, index) =>
    api<Page<T>>(`${path}?page=${index + 2}&pageSize=100`),
  ))
  return [first, ...pages].flatMap((page) => page.items)
}

async function loadFilterOptions() {
  filterOptionsLoading.value = true
  try {
    const [allUsers, allServices] = await Promise.all([
      fetchAll<User>('/admin/users'),
      fetchAll<Service>('/admin/services'),
    ])
    customers.value = allUsers.filter((user) => user.role === 'CUSTOMER').sort((left, right) => left.name.localeCompare(right.name, locale.value))
    services.value = allServices.sort((left, right) => left.name.localeCompare(right.name, locale.value))
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('common.error'))
  } finally {
    filterOptionsLoading.value = false
  }
}

async function cancel() {
  const reservationId = cancelId.value
  if (!reservationId) return
  try {
    const result = await api<{ reservation: Reservation }>(`/admin/reservations/${reservationId}/cancel`, { method: 'POST' })
    toast.success(t('reservations.cancelled'))
    notifyReservationStatusChanged(result.reservation)
    if (selected.value?.id === reservationId) selected.value = result.reservation
    await load()
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('reservations.cancelError'))
  }
}

async function confirmReservation() {
  if (!selected.value) return
  acting.value = true
  try {
    const result = await api<{ reservation: Reservation }>(`/admin/reservations/${selected.value.id}/confirm`, { method: 'POST' })
    notifyReservationStatusChanged(result.reservation)
    selected.value = result.reservation
    toast.success(t('reservations.confirmed'))
    await load()
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('reservations.confirmError'))
  } finally {
    acting.value = false
  }
}

async function syncCalendar() {
  if (!selected.value) return
  acting.value = true
  try {
    const result = await api<{ reservation: Reservation }>(`/admin/reservations/${selected.value.id}/calendar-sync`, { method: 'POST' })
    selected.value = result.reservation
    if (result.reservation.calendarSyncStatus === 'SYNCED') toast.success(t('reservations.confirmed'))
    else toast.error(t('reservations.calendarSyncError'))
    await load()
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('reservations.calendarSyncError'))
  } finally {
    acting.value = false
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'full', timeStyle: 'short', timeZone: timezone.value }).format(new Date(value))
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(locale.value, { hour: '2-digit', minute: '2-digit', timeZone: timezone.value }).format(new Date(value))
}

function formatCalendarEventRange(event: CalendarBusyEvent) {
  if (event.allDay) {
    const formatter = new Intl.DateTimeFormat(locale.value, { dateStyle: 'full', timeZone: timezone.value })
    const start = formatter.format(new Date(event.startAt))
    const inclusiveEnd = new Date(new Date(event.endAt).getTime() - 1)
    const end = formatter.format(inclusiveEnd)
    return start === end ? `${start} · ${t('calendar.allDay')}` : `${start} – ${end} · ${t('calendar.allDay')}`
  }
  const formatter = new Intl.DateTimeFormat(locale.value, { dateStyle: 'full', timeStyle: 'short', timeZone: timezone.value })
  return `${formatter.format(new Date(event.startAt))} – ${formatter.format(new Date(event.endAt))}`
}

</script>

<template>
  <PageHeader :title="t('nav.reservations')" :description="t('calendar.description')" />

  <Dialog v-model:open="filtersOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t('reservations.filters') }}</DialogTitle>
        <DialogDescription>{{ t('reservations.filtersDescription') }}</DialogDescription>
      </DialogHeader>
      <form class="overflow-hidden" @submit.prevent="applyFilters">
        <Transition :name="`filter-slide-${filterNavigationDirection}`" mode="out-in">
          <div v-if="!expandedFilter" key="filters-main" class="grid gap-4">
            <div class="grid gap-2">
              <Button type="button" variant="outline" class="h-auto min-w-0 justify-between px-4 py-3" @click="openFilterPanel('customers')">
                <span class="flex min-w-0 items-center gap-3"><UserRound class="size-4 shrink-0" /><span class="min-w-0 text-left"><strong class="block">{{ t('reservations.customers') }}</strong><span v-if="selectedCustomerName" class="block truncate text-xs font-normal text-muted-foreground">{{ selectedCustomerName }}</span></span></span>
                <ChevronRight class="size-4 shrink-0" />
              </Button>
              <Button type="button" variant="outline" class="h-auto min-w-0 justify-between px-4 py-3" @click="openFilterPanel('services')">
                <span class="flex min-w-0 items-center gap-3"><Wrench class="size-4 shrink-0" /><span class="min-w-0 text-left"><strong class="block">{{ t('reservations.services') }}</strong><span v-if="selectedServiceName" class="block truncate text-xs font-normal text-muted-foreground">{{ selectedServiceName }}</span></span></span>
                <ChevronRight class="size-4 shrink-0" />
              </Button>
            </div>

            <Label class="grid gap-2">
              {{ t('common.status') }}
              <Select v-model="draftStatus">
                <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{{ t('calendar.allStatuses') }}</SelectItem>
                  <SelectItem value="PENDING">{{ t('common.statuses.pending') }}</SelectItem>
                  <SelectItem value="CONFIRMED">{{ t('common.statuses.confirmed') }}</SelectItem>
                  <SelectItem value="CANCELLED">{{ t('common.statuses.cancelled') }}</SelectItem>
                </SelectContent>
              </Select>
            </Label>
            <DialogFooter class="gap-2 sm:justify-between">
              <Button type="button" variant="ghost" @click="resetFilters">{{ t('common.reset') }}</Button>
              <div class="flex flex-col-reverse gap-2 sm:flex-row">
                <DialogClose as-child><Button type="button" variant="outline">{{ t('common.cancel') }}</Button></DialogClose>
                <Button type="submit">{{ t('common.apply') }}</Button>
              </div>
            </DialogFooter>
          </div>

          <div v-else :key="expandedFilter" class="grid gap-3">
            <Button type="button" variant="ghost" class="w-fit px-2" @click="returnToFilters">
              <ChevronLeft class="size-4" />{{ t('common.back') }}
            </Button>
            <div class="max-h-72 overflow-y-auto rounded-lg border bg-muted/25 p-1">
              <div v-if="filterOptionsLoading" class="grid min-h-28 place-items-center text-sm text-muted-foreground">{{ t('common.loading') }}</div>
              <template v-else-if="expandedFilter === 'customers'">
                <button type="button" class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent" @click="selectCustomer('')">
                  <Check class="size-4 shrink-0" :class="draftCustomerId ? 'opacity-0' : 'opacity-100'" /><span>{{ t('reservations.allCustomers') }}</span>
                </button>
                <button v-for="customer in customers" :key="customer.id" type="button" class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent" @click="selectCustomer(customer.id)">
                  <Check class="size-4 shrink-0" :class="draftCustomerId === customer.id ? 'opacity-100' : 'opacity-0'" />
                  <span class="min-w-0 flex-1"><strong class="block truncate font-medium">{{ customer.name }}</strong><span class="block truncate text-xs text-muted-foreground">{{ customer.email }}</span></span>
                </button>
                <p v-if="!customers.length" class="p-6 text-center text-sm text-muted-foreground">{{ t('reservations.noCustomers') }}</p>
              </template>
              <template v-else>
                <button type="button" class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent" @click="selectService('')">
                  <Check class="size-4 shrink-0" :class="draftServiceId ? 'opacity-0' : 'opacity-100'" /><span>{{ t('reservations.allServices') }}</span>
                </button>
                <button v-for="service in services" :key="service.id" type="button" class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent" @click="selectService(service.id)">
                  <Check class="size-4 shrink-0" :class="draftServiceId === service.id ? 'opacity-100' : 'opacity-0'" />
                  <span class="min-w-0 flex-1 truncate font-medium">{{ service.name }}</span>
                  <Badge :variant="service.enabled ? 'default' : 'secondary'">{{ service.enabled ? t('common.active') : t('common.disabled') }}</Badge>
                </button>
                <p v-if="!services.length" class="p-6 text-center text-sm text-muted-foreground">{{ t('reservations.noServices') }}</p>
              </template>
            </div>
          </div>
        </Transition>
      </form>
    </DialogContent>
  </Dialog>

  <EventCalendar
    :reservations="filteredItems"
    :calendar-events="calendarEvents"
    :timezone="timezone"
    :bounds="calendarBounds"
    :loading="loading"
    @range-change="onRangeChange"
    @select="openReservation"
    @select-calendar-event="openCalendarEvent"
    @select-day="selectedDay = $event"
  >
    <template #toolbar-actions>
      <Button variant="outline" class="h-11 px-3 sm:h-9" :aria-label="t('reservations.filters')" @click="openFilters">
        <SlidersHorizontal class="size-4" /><span class="hidden min-[360px]:inline">{{ t('reservations.filters') }}</span>
        <Badge v-if="activeFilterCount" variant="secondary" class="ml-1 h-5 min-w-5 justify-center px-1 text-[0.65rem]">{{ activeFilterCount }}</Badge>
      </Button>
    </template>
  </EventCalendar>

  <Dialog :open="Boolean(selected)" @update:open="onReservationDialogOpenChange">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ selected?.service.name }}</DialogTitle>
        <DialogDescription>{{ selected ? formatDateTime(selected.startAt) : '' }}</DialogDescription>
      </DialogHeader>
      <div v-if="selected" class="space-y-4">
        <div class="grid gap-3 rounded-lg border p-4 text-sm">
          <div class="flex items-center gap-3"><UserRound class="size-4 text-muted-foreground" /><span>{{ selected.user?.name }}</span></div>
          <div class="flex items-center gap-3"><Mail class="size-4 text-muted-foreground" /><span>{{ selected.user?.email }}</span></div>
          <div class="flex items-center gap-3"><Wrench class="size-4 text-muted-foreground" /><span>{{ selected.service.name }}</span></div>
          <div class="flex items-center gap-3"><Clock3 class="size-4 text-muted-foreground" /><span>{{ formatTime(selected.startAt) }}–{{ formatTime(selected.endAt) }}</span></div>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm text-muted-foreground">{{ t('common.status') }}</span>
          <Badge :variant="selected.status === 'CONFIRMED' ? 'default' : 'secondary'">{{ t(`common.statuses.${selected.status.toLowerCase()}`) }}</Badge>
        </div>
        <div v-if="selected.status === 'CONFIRMED' && selected.calendarSyncStatus && selected.calendarSyncStatus !== 'SYNCED'" class="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <p>{{ t('reservations.calendarSyncError') }}</p>
          <p v-if="selected.calendarSyncError" class="mt-1 break-words text-xs">{{ selected.calendarSyncError }}</p>
        </div>
      </div>
      <DialogFooter>
        <Button v-if="selected?.status === 'PENDING'" :disabled="acting" @click="confirmReservation"><Check class="size-4" />{{ t('reservations.confirm') }}</Button>
        <Button v-if="selected?.status === 'CONFIRMED' && ['FAILED', 'NOT_CONFIGURED'].includes(selected.calendarSyncStatus || '')" variant="outline" :disabled="acting" @click="syncCalendar"><RefreshCw class="size-4" />{{ t('reservations.calendarSync') }}</Button>
        <Button v-if="selected?.status !== 'CANCELLED'" variant="destructive" @click="cancelId = selected!.id">{{ t('reservations.cancel') }}</Button>
        <DialogClose as-child><Button variant="outline">{{ t('calendar.close') }}</Button></DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <Dialog :open="Boolean(selectedCalendarEvent)" @update:open="(open) => { if (!open && !deletingCalendarEvent) selectedCalendarEvent = null }">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ selectedCalendarEvent?.title }}</DialogTitle>
        <DialogDescription>{{ selectedCalendarEvent ? formatCalendarEventRange(selectedCalendarEvent) : '' }}</DialogDescription>
      </DialogHeader>
      <div v-if="selectedCalendarEvent" class="space-y-3 text-sm">
        <div v-if="selectedCalendarEvent.location" class="flex items-start gap-3 rounded-lg border p-3">
          <MapPin class="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>{{ selectedCalendarEvent.location }}</span>
        </div>
        <div v-if="selectedCalendarEvent.description" class="whitespace-pre-wrap rounded-lg border p-3 text-muted-foreground">{{ selectedCalendarEvent.description }}</div>
        <a v-if="selectedCalendarEvent.htmlLink" :href="selectedCalendarEvent.htmlLink" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 text-primary underline-offset-4 hover:underline">
          <ExternalLink class="size-4" />{{ t('calendar.openInGoogle') }}
        </a>
      </div>
      <DialogFooter>
        <DialogClose as-child><Button variant="outline" :disabled="deletingCalendarEvent">{{ t('calendar.close') }}</Button></DialogClose>
        <Button variant="destructive" :disabled="deletingCalendarEvent" @click="removeCalendarEvent">{{ deletingCalendarEvent ? t('calendar.removingGoogleEvent') : t('common.remove') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <Dialog :open="Boolean(selectedDay)" @update:open="(open) => { if (!open) selectedDay = null }">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="capitalize">{{ selectedDay ? formatDay(selectedDay) : '' }}</DialogTitle>
        <DialogDescription>{{ t('calendar.dayReservations', { count: selectedDayItems.length }) }}</DialogDescription>
      </DialogHeader>
      <div v-if="selectedDayItems.length" class="max-h-96 space-y-2 overflow-y-auto pr-1">
        <button v-for="item in selectedDayItems" :key="item.id" type="button" class="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-muted" @click="openReservation(item)">
            <span class="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">{{ formatTime(item.startAt) }}</span>
            <span class="min-w-0 flex-1"><strong class="block truncate text-sm">{{ item.user?.name }}</strong><span class="block truncate text-xs text-muted-foreground">{{ item.service.name }}</span></span>
            <Badge :variant="item.status === 'CONFIRMED' ? 'default' : 'secondary'">{{ t(`common.statuses.${item.status.toLowerCase()}`) }}</Badge>
        </button>
      </div>
      <div v-else class="grid min-h-32 place-items-center text-center text-sm text-muted-foreground"><CalendarClock class="mb-2 size-8" />{{ t('calendar.noDayReservations') }}</div>
    </DialogContent>
  </Dialog>

  <AlertDialog :open="Boolean(cancelId)" @update:open="(open) => { if (!open) cancelId = null }">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('reservations.cancelTitle') }}</AlertDialogTitle>
        <AlertDialogDescription>{{ t('reservations.cancelDescription') }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t('reservations.keep') }}</AlertDialogCancel>
        <AlertDialogAction @click="cancel">{{ t('reservations.cancel') }}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
