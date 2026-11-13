<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { getLocalTimeZone, parseDate, today, type DateValue } from '@internationalized/date'
import { Check, Loader2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'
import AppShell from '@/components/AppShell.vue'
import BookingCalendar from '@/components/BookingCalendar.vue'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ApiError } from '@/services/api'
import { useReservationStore } from '@/stores/reservations'
import { api } from '@/services/api'
import type { Service, Slot } from '@/types'

const store = useReservationStore()
const { t } = useI18n()
const selectedService = ref<Service | null>(null); const selectedDate = shallowRef<DateValue>(); const selectedSlot = ref<Slot | null>(null); const businessName = ref('')
const slots = ref<Slot[]>([]); const loading = ref(true); const loadingSlots = ref(false); const confirming = ref(false); const dialogOpen = ref(false)
const visibleMonth = shallowRef<DateValue>(today(getLocalTimeZone())); const availableDates = ref<string[]>([]); const availableDatesMonth = ref(''); const bookingFromDate = ref<DateValue>(); const bookingToDate = ref<DateValue>()
const bookingMinDate = computed(() => { const currentDate = today(getLocalTimeZone()); return bookingFromDate.value && bookingFromDate.value.compare(currentDate) > 0 ? bookingFromDate.value : currentDate })
const dateString = computed(() => selectedDate.value?.toString() || '')
let availabilityRefreshPoll: number | null = null
let slotsRequestSequence = 0
let silentSlotsRefreshInFlight = false
onMounted(async () => {
  try { const [settings] = await Promise.all([api<{ settings: { businessName: string; bookingFromDate: string | null; bookingToDate: string | null } }>('/settings/public'), store.loadServices()]); businessName.value = settings.settings.businessName; bookingFromDate.value = settings.settings.bookingFromDate ? parseDate(settings.settings.bookingFromDate.slice(0, 10)) : undefined; bookingToDate.value = settings.settings.bookingToDate ? parseDate(settings.settings.bookingToDate.slice(0, 10)) : undefined; if (bookingFromDate.value && visibleMonth.value.compare(bookingFromDate.value) < 0) visibleMonth.value = bookingFromDate.value } catch { toast.error(t('booking.servicesError')) } finally { loading.value = false }
  document.addEventListener('visibilitychange', onVisibilityChange)
  availabilityRefreshPoll = window.setInterval(() => { if (document.visibilityState === 'visible') void refreshAvailability() }, 15000)
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  if (availabilityRefreshPoll !== null) window.clearInterval(availabilityRefreshPoll)
})
watch([selectedService, dateString], () => { void loadSlots() })
watch(() => visibleMonth.value.toString().slice(0, 7), () => { void loadAvailableDates() }, { immediate: true })
async function loadAvailableDates(silent = false) { const month = visibleMonth.value.toString().slice(0, 7); if (!silent) availableDatesMonth.value = ''; try { availableDates.value = await store.getAvailableDates(month); availableDatesMonth.value = month } catch { if (!silent) { availableDates.value = []; toast.error(t('booking.availabilityError')) } } }
async function loadSlots(preserveSelection = false, silent = false) {
  const serviceId = selectedService.value?.id
  const requestedDate = dateString.value
  const previousStart = preserveSelection ? selectedSlot.value?.startAt : undefined
  const requestSequence = ++slotsRequestSequence
  if (!preserveSelection) selectedSlot.value = null
  if (!serviceId || !requestedDate) { slots.value = []; return }
  if (!silent) loadingSlots.value = true
  try {
    const refreshedSlots = await store.getAvailability(serviceId, requestedDate)
    if (requestSequence !== slotsRequestSequence || serviceId !== selectedService.value?.id || requestedDate !== dateString.value) return
    slots.value = refreshedSlots
    if (preserveSelection && previousStart) {
      const refreshedSelection = refreshedSlots.find((slot) => slot.startAt === previousStart) || null
      selectedSlot.value = refreshedSelection
      if (!refreshedSelection) {
        dialogOpen.value = false
        toast.warning(t('booking.slotUnavailable'))
      }
    }
  } catch (error) {
    if (!silent) toast.error(t('booking.availabilityError'))
  } finally {
    if (!silent && requestSequence === slotsRequestSequence) loadingSlots.value = false
  }
}
async function refreshAvailability() {
  const updates: Promise<void>[] = [loadAvailableDates(true)]
  if (!loadingSlots.value && !silentSlotsRefreshInFlight && selectedService.value && dateString.value) {
    silentSlotsRefreshInFlight = true
    updates.push(loadSlots(true, true).finally(() => { silentSlotsRefreshInFlight = false }))
  }
  await Promise.all(updates)
}
function onVisibilityChange() { if (document.visibilityState === 'visible') void refreshAvailability() }
async function confirmBooking() { if (!selectedService.value || !selectedSlot.value) return; confirming.value = true; try { await store.addReservation(selectedService.value.id, selectedSlot.value.startAt); dialogOpen.value = false; toast.success(t('booking.submitted')); await Promise.all([loadSlots(), loadAvailableDates()]) } catch (error) { if (error instanceof ApiError && error.code === 'SLOT_UNAVAILABLE') { toast.error(t('booking.conflict')); dialogOpen.value = false; await Promise.all([loadSlots(), loadAvailableDates()]) } else toast.error(error instanceof Error ? error.message : t('booking.bookingError')) } finally { confirming.value = false } }
</script>

<template>
  <AppShell :business-name="businessName">
    <section class="page-heading booking-page-heading">
      <div>
        <p class="eyebrow">{{ t('booking.eyebrow') }}</p>
        <h1>{{ t('booking.title') }}</h1>
        <p>{{ t('booking.description') }}</p>
      </div>
    </section>

    <section class="booking-workspace">
      <BookingCalendar
        v-model="selectedDate"
        v-model:visible-month="visibleMonth"
        v-model:selected-service="selectedService"
        v-model:selected-slot="selectedSlot"
        :min-value="bookingMinDate"
        :max-value="bookingToDate"
        :available-dates="availableDates"
        :available-dates-month="availableDatesMonth"
        :services="store.services"
        :slots="slots"
        :loading-services="loading"
        :loading-slots="loadingSlots"
        @review="dialogOpen = true"
      />
    </section>

    <section class="booking-benefits" aria-label="Booking benefits">
      <Card v-for="benefit in ['easyCancellation', 'noCard', 'reminders']" :key="benefit" class="booking-benefit-card">
        <CardContent class="p-5 text-center"><p class="font-medium">{{ t(`booking.${benefit}`) }}</p><p class="mt-1 text-sm text-muted-foreground">{{ t(`booking.${benefit}Description`) }}</p></CardContent>
      </Card>
    </section>

    <AlertDialog v-model:open="dialogOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('booking.confirmTitle') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('booking.confirmDescription') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <Card class="border-0 shadow-none">
          <CardContent class="space-y-3 py-0 px-2">
            <div>
              <p class="font-semibold">{{ selectedService?.name }}</p>
              <p class="text-sm text-muted-foreground">{{ dateString }} {{ t('booking.at') }} {{ selectedSlot?.label }}</p>
            </div>
            <Separator />
            <div class="flex justify-between text-sm">
              <span>{{ t('booking.duration') }}</span>
              <span>{{ t('common.minutes', { count: selectedService?.durationMinutes }) }}</span>
            </div>
          </CardContent>
        </Card>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
          <AlertDialogAction :disabled="confirming" @click="confirmBooking">
            <Loader2 v-if="confirming" class="animate-spin" />
            <Check v-else />
            {{ t('common.confirm') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </AppShell>
</template>
