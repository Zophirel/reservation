<script setup lang="ts">
import { computed } from 'vue'
import { getLocalTimeZone, type DateValue } from '@internationalized/date'
import { ArrowLeft, CalendarDays, Clock3, Loader2, Scissors } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent } from '@/components/ui/card'
import type { Service, Slot } from '@/types'

const props = defineProps<{
  modelValue?: DateValue
  visibleMonth: DateValue
  minValue: DateValue
  maxValue?: DateValue
  availableDates: string[]
  services: Service[]
  selectedService: Service | null
  selectedSlot: Slot | null
  slots: Slot[]
  loadingServices: boolean
  loadingSlots: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: DateValue | undefined]
  'update:visibleMonth': [value: DateValue]
  'update:selectedService': [value: Service | null]
  'update:selectedSlot': [value: Slot | null]
  review: []
}>()

const { t, locale } = useI18n()
const selectedDate = computed({
  get: () => props.modelValue,
  set: (value: DateValue | undefined) => {
    emit('update:modelValue', value)
    emit('update:selectedSlot', null)
  },
})
const calendarMonth = computed({
  get: () => props.visibleMonth,
  set: (value: DateValue) => emit('update:visibleMonth', value),
})
const availableDateSet = computed(() => new Set(props.availableDates))
const calendarWeeks = computed(() => {
  const viewed = props.visibleMonth.toDate(getLocalTimeZone())
  const year = viewed.getFullYear()
  const month = viewed.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  const weekStartsOn = locale.value.toLowerCase().startsWith('it') ? 1 : 0
  const leadingDays = (firstWeekday - weekStartsOn + 7) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return Math.ceil((leadingDays + daysInMonth) / 7)
})
const calendarLayoutStyle = computed(() => ({ '--calendar-height': `${8.5 + calendarWeeks.value * 4.5}rem` }))
const morningSlots = computed(() => props.slots.filter((slot) => new Date(slot.startAt).getHours() < 12))
const afternoonSlots = computed(() => props.slots.filter((slot) => new Date(slot.startAt).getHours() >= 12))
const selectedDateLabel = computed(() => props.modelValue
  ? new Intl.DateTimeFormat(locale.value, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      .format(props.modelValue.toDate(getLocalTimeZone()))
  : '')
const dateLabel = computed(() => props.modelValue
  ? new Intl.DateTimeFormat(locale.value, { weekday: 'long', day: 'numeric', month: 'long' })
      .format(props.modelValue.toDate(getLocalTimeZone()))
  : t('booking.selectDatePrompt'))

function selectService(service: Service) {
  emit('update:selectedService', service)
  emit('update:selectedSlot', null)
}

function changeService() {
  emit('update:selectedService', null)
  emit('update:selectedSlot', null)
}

function selectSlot(slot: Slot) {
  emit('update:selectedSlot', props.selectedSlot?.startAt === slot.startAt ? null : slot)
}

function isDateDisabled(date: DateValue) {
  const dateString = date.toString()
  return !availableDateSet.value.has(dateString)
}
</script>

<template>
  <Card class="overflow-hidden p-0">
    <CardContent class="p-0">
      <div class="booking-calendar-layout grid items-stretch lg:grid-cols-[minmax(0,1fr)_clamp(18rem,34%,22rem)]" :style="calendarLayoutStyle">
        <div class="booking-calendar-pane grid place-items-center px-4 py-5 sm:px-6 sm:py-6 lg:h-full lg:min-h-0 lg:px-8" :class="{ 'booking-calendar-pane--mobile-hidden': modelValue }">
          <Calendar
            :key="locale"
            v-model="selectedDate"
            v-model:placeholder="calendarMonth"
            :locale="locale"
            :min-value="minValue"
            :max-value="maxValue"
            :is-date-disabled="isDateDisabled"
            class="mx-auto w-full max-w-2xl p-1 [&_[data-slot=calendar-cell-trigger]]:mx-auto [&_[data-slot=calendar-cell-trigger]]:size-10 [&_[data-slot=calendar-cell-trigger]]:text-sm [&_[data-slot=calendar-grid-row]]:mt-2 [&_[data-slot=calendar-head-cell]]:text-xs [&_[data-slot=calendar-heading]]:text-base sm:[&_[data-slot=calendar-cell-trigger]]:size-12 sm:[&_[data-slot=calendar-cell-trigger]]:text-base sm:[&_[data-slot=calendar-grid-row]]:mt-3 sm:[&_[data-slot=calendar-head-cell]]:text-sm lg:[&_[data-slot=calendar-cell-trigger]]:size-16 lg:[&_[data-slot=calendar-cell-trigger]]:text-lg lg:[&_[data-slot=calendar-grid-row]]:mt-5 lg:[&_[data-slot=calendar-head-cell]]:text-base lg:[&_[data-slot=calendar-heading]]:text-xl"
          />
          <div class="booking-calendar-footer flex items-center justify-between border-t px-5 py-3 text-[10px] text-muted-foreground lg:border-t-0">
            <div class="flex items-center gap-4">
              <span class="inline-flex items-center gap-1.5"><i class="booking-legend-dot booking-legend-dot--selected"></i>{{ t('booking.selected') }}</span>
              <span class="inline-flex items-center gap-1.5"><i class="booking-legend-dot booking-legend-dot--available"></i>{{ t('booking.available') }}</span>
            </div>
            <span>{{ t('booking.timezone') }}</span>
          </div>
        </div>

        <div class="booking-selection-panel flex max-h-[30rem] flex-col overflow-hidden border-t bg-[#fcfcfa] lg:h-full lg:max-h-none lg:min-h-0 lg:border-s lg:border-t-0" :class="{ 'booking-selection-panel--mobile-hidden': !modelValue }">
          <div class="border-b px-5 py-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="booking-step-label">{{ !modelValue ? t('booking.stepDate') : t('booking.stepService') }}</p>
                <p class="mt-1 text-sm font-semibold capitalize">{{ dateLabel }}</p>
              </div>
              <span v-if="modelValue && slots.length" class="booking-availability-badge">{{ t('booking.freeTimes', { count: slots.length }) }}</span>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ !modelValue ? t('booking.stepDate') : !selectedService ? t('booking.stepService') : t('booking.availableTimes') }}
            </p>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto" :class="modelValue ? 'px-5 py-4' : 'p-0 lg:px-5 lg:py-4'">
            <div v-if="!modelValue" class="hidden h-full place-items-center text-center text-sm text-muted-foreground lg:grid">
              {{ t('booking.selectDatePrompt') }}
            </div>

            <div v-else-if="!selectedService">
              <div v-if="loadingServices" class="grid min-h-32 place-items-center">
                <Loader2 class="size-5 animate-spin text-muted-foreground" />
              </div>
              <div v-else-if="services.length" class="grid gap-2">
                <Button
                  v-for="service in services"
                  :key="service.id"
                  variant="outline"
                  class="booking-service-option h-auto w-full justify-start px-3 py-3 text-left"
                  @click="selectService(service)"
                >
                  <span class="booking-service-icon"><Scissors class="size-4" /></span>
                  <span class="min-w-0">
                    <span class="block truncate font-medium">{{ service.name }}</span>
                    <span class="block text-xs font-normal text-muted-foreground">
                      {{ t('common.minutes', { count: service.durationMinutes }) }}<span v-if="service.description"> · {{ service.description }}</span>
                    </span>
                  </span>
                </Button>
              </div>
              <p v-else class="grid min-h-32 place-items-center text-center text-sm text-muted-foreground">
                {{ t('booking.noServices') }}
              </p>
            </div>

            <div v-else>
              <div class="booking-selected-service mb-4 flex items-center justify-between gap-3">
                <div class="flex min-w-0 items-center gap-2">
                  <span class="booking-service-icon"><Scissors class="size-4" /></span>
                  <span class="min-w-0">
                    <span class="block truncate text-sm font-medium">{{ selectedService.name }}</span>
                    <span class="block text-xs text-muted-foreground">{{ t('common.minutes', { count: selectedService.durationMinutes }) }}</span>
                  </span>
                </div>
                <Button variant="ghost" size="sm" class="shrink-0 px-2" @click="changeService">{{ t('booking.modify') }}</Button>
              </div>
              <div v-if="loadingSlots" class="grid min-h-28 place-items-center">
                <Loader2 class="size-5 animate-spin text-muted-foreground" />
              </div>
              <div v-else-if="slots.length" class="booking-time-groups">
                <div v-if="morningSlots.length">
                  <p class="booking-time-group-label">{{ t('booking.morning') }}</p>
                    <div class="grid grid-cols-2 gap-2">
                    <Button
                      v-for="slot in morningSlots"
                      :key="slot.startAt"
                      class="booking-time-option w-full"
                      size="sm"
                      :variant="selectedSlot?.startAt === slot.startAt ? 'default' : 'outline'"
                      :aria-pressed="selectedSlot?.startAt === slot.startAt"
                      @click="selectSlot(slot)"
                    >
                      <Clock3 class="size-3.5" />
                      {{ slot.label }}
                    </Button>
                  </div>
                </div>
                <div v-if="afternoonSlots.length">
                  <p class="booking-time-group-label">{{ t('booking.afternoon') }}</p>
                  <div class="grid grid-cols-2 gap-2">
                    <Button
                      v-for="slot in afternoonSlots"
                      :key="slot.startAt"
                      class="booking-time-option w-full"
                      size="sm"
                      :variant="selectedSlot?.startAt === slot.startAt ? 'default' : 'outline'"
                      :aria-pressed="selectedSlot?.startAt === slot.startAt"
                      @click="selectSlot(slot)"
                    >
                      <Clock3 class="size-3.5" />
                      {{ slot.label }}
                    </Button>
                  </div>
                </div>
              </div>
              <p v-else class="grid min-h-28 place-items-center text-center text-sm text-muted-foreground">
                {{ t('booking.none') }}
              </p>
            </div>
          </div>

          <div v-if="modelValue && selectedService" class="booking-selection-footer border-t p-4">
            <div v-if="selectedSlot" class="mb-3 flex items-center gap-2 rounded-md bg-white px-3 py-2 text-xs">
              <CalendarDays class="size-3.5 text-primary" />
              <span>{{ selectedDateLabel }} {{ t('booking.at') }} {{ selectedSlot.label }}</span>
            </div>
            <Button class="booking-review-button w-full" :disabled="!selectedSlot" @click="emit('review')">
              {{ t('booking.review') }}
              <ArrowLeft class="size-4 rotate-180" />
            </Button>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
