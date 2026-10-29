<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import luxonPlugin from '@fullcalendar/luxon3'
import timeGridPlugin from '@fullcalendar/timegrid'
import type { CalendarApi, CalendarOptions, DatesSetArg, DayCellContentArg, DayHeaderContentArg, EventClickArg, EventContentArg } from '@fullcalendar/core'
import { CalendarDate, type DateValue } from '@internationalized/date'
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsUpDown, GalleryVertical, Table2, Tally3 } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { CalendarBusyEvent, Reservation } from '@/types'

export type CalendarView = 'month' | 'week' | 'day'
export type CalendarRange = { from: string; to: string }
export type CalendarBounds = { oldestStartAt: string | null; newestStartAt: string | null }

const props = defineProps<{
  reservations: Reservation[]
  calendarEvents: CalendarBusyEvent[]
  timezone: string
  bounds: CalendarBounds
  loading: boolean
}>()

const emit = defineEmits<{
  select: [value: Reservation]
  'select-calendar-event': [value: CalendarBusyEvent]
  'select-day': [date: string]
  'range-change': [range: CalendarRange]
}>()

const { t, locale } = useI18n()
const calendar = ref<InstanceType<typeof FullCalendar> | null>(null)
const calendarStage = ref<HTMLElement | null>(null)
const initialCalendarView = window.matchMedia('(max-width: 639px)').matches ? 'timeGridDay' : 'timeGridWeek'
const currentView = ref<CalendarView>(initialCalendarView === 'timeGridDay' ? 'day' : 'week')
const viewedDate = ref(new Date())
const datePickerOpen = ref(false)
const changingView = ref(false)
const showLoading = ref(false)
let loadingTimer: number | undefined

function monthKey(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value
  const parts = new Intl.DateTimeFormat('en', { timeZone: props.timezone, year: 'numeric', month: '2-digit' }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || ''
  return `${part('year')}-${part('month')}`
}

function nextMonth(value: string) {
  const [year, month] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year!, month!, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

const currentMonth = computed(() => monthKey(new Date()))
const oldestMonth = computed(() => props.bounds.oldestStartAt ? monthKey(props.bounds.oldestStartAt) : currentMonth.value)
const newestMonth = computed(() => props.bounds.newestStartAt ? monthKey(props.bounds.newestStartAt) : currentMonth.value)
const minimumMonth = computed(() => oldestMonth.value < currentMonth.value ? oldestMonth.value : currentMonth.value)
const maximumMonth = computed(() => newestMonth.value > currentMonth.value ? newestMonth.value : currentMonth.value)
const validRange = computed(() => ({ start: `${minimumMonth.value}-01`, end: `${nextMonth(maximumMonth.value)}-01` }))
const pickerMinimum = computed(() => {
  const [year, month] = minimumMonth.value.split('-').map(Number)
  return new CalendarDate(year!, month!, 1)
})
const pickerMaximum = computed(() => {
  const [year, month] = maximumMonth.value.split('-').map(Number)
  return new CalendarDate(year!, month!, new Date(year!, month!, 0).getDate())
})
const pickerValue = computed(() => new CalendarDate(
  viewedDate.value.getFullYear(),
  viewedDate.value.getMonth() + 1,
  viewedDate.value.getDate(),
))
const pickerLabel = computed(() => new Intl.DateTimeFormat(locale.value, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(viewedDate.value))

function api(): CalendarApi | undefined {
  return calendar.value?.getApi()
}

function previousDateKey(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day! - 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function onDatesSet(info: DatesSetArg) {
  viewedDate.value = info.view.currentStart
  currentView.value = info.view.type === 'timeGridDay' ? 'day' : info.view.type === 'dayGridMonth' ? 'month' : 'week'
  emit('range-change', { from: info.startStr.slice(0, 10), to: previousDateKey(info.endStr) })
}

function nextPaint() {
  return new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())))
}

async function transitionCalendar(update: () => void) {
  if (changingView.value) return
  const stage = calendarStage.value
  if (!stage || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update()
    return
  }

  changingView.value = true
  try {
    await stage.animate(
      [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0.72, transform: 'translateY(2px)' }],
      { duration: 80, easing: 'ease-out', fill: 'forwards' },
    ).finished
    update()
    await nextPaint()
    await stage.animate(
      [{ opacity: 0.72, transform: 'translateY(2px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 150, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' },
    ).finished
  } catch {
    // Animations can be cancelled when the component unmounts.
  } finally {
    stage.getAnimations().forEach((animation) => animation.cancel())
    changingView.value = false
  }
}

function moveCalendar(direction: 'previous' | 'next' | 'today') {
  void transitionCalendar(() => {
    if (direction === 'previous') api()?.prev()
    else if (direction === 'next') api()?.next()
    else api()?.today()
  })
}

function setView(view: CalendarView) {
  if (view === currentView.value) return
  const target = view === 'day' ? 'timeGridDay' : view === 'month' ? 'dayGridMonth' : 'timeGridWeek'
  void transitionCalendar(() => api()?.changeView(target))
}

function selectCalendarDate(value: DateValue | undefined) {
  if (!value) return
  datePickerOpen.value = false
  void transitionCalendar(() => api()?.gotoDate(new Date(value.year, value.month - 1, value.day)))
}

watch(() => props.loading, (loading) => {
  window.clearTimeout(loadingTimer)
  if (loading) loadingTimer = window.setTimeout(() => { showLoading.value = true }, 180)
  else showLoading.value = false
}, { immediate: true })

onBeforeUnmount(() => {
  window.clearTimeout(loadingTimer)
  calendarStage.value?.getAnimations().forEach((animation) => animation.cancel())
})

function eventColor(item: Reservation) {
  if (item.status === 'CANCELLED') return '#e2e8f0'
  if (item.status === 'PENDING') return '#fed7aa'
  const colors = ['#bbf7d0', '#bfdbfe', '#ddd6fe', '#fde68a']
  const index = [...item.service.id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % colors.length
  return colors[index]
}

const events = computed(() => [...props.reservations.map((reservation) => ({
  id: reservation.id,
  title: reservation.user?.name || reservation.service.name,
  start: reservation.startAt,
  end: reservation.endAt,
  backgroundColor: eventColor(reservation),
  borderColor: '#111827',
  textColor: reservation.status === 'CANCELLED' ? '#64748b' : '#111827',
  classNames: reservation.status === 'CANCELLED' ? ['reservation-event--cancelled'] : [],
  extendedProps: { reservation },
})), ...props.calendarEvents.map((event) => ({
  id: `google:${event.id}`,
  title: t('calendar.googleEvent', { title: event.title }),
  start: event.startAt,
  end: event.endAt,
  backgroundColor: '#e0e7ff',
  borderColor: '#6366f1',
  textColor: '#312e81',
  classNames: ['calendar-event--google'],
  extendedProps: { calendarEvent: event },
}))])

function onEventClick(info: EventClickArg) {
  const reservation = info.event.extendedProps.reservation as Reservation | undefined
  if (reservation) emit('select', reservation)
  const calendarEvent = info.event.extendedProps.calendarEvent as CalendarBusyEvent | undefined
  if (calendarEvent) emit('select-calendar-event', calendarEvent)
}

function onDateClick(info: { dateStr: string }) {
  emit('select-day', info.dateStr.slice(0, 10))
}

const options = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, luxonPlugin],
  initialView: initialCalendarView,
  headerToolbar: false,
  timeZone: props.timezone,
  locale: locale.value,
  firstDay: locale.value.toLowerCase().startsWith('it') ? 1 : 0,
  validRange: validRange.value,
  events: events.value,
  slotMinTime: '09:00:00',
  slotMaxTime: '22:00:00',
  slotDuration: '00:30:00',
  slotLabelInterval: '01:00:00',
  allDaySlot: false,
  nowIndicator: true,
  editable: false,
  selectable: false,
  displayEventEnd: true,
  dayMaxEvents: 3,
  height: 'clamp(28rem, 55vh, 42rem)',
  expandRows: true,
  rerenderDelay: 30,
  eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
  slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
  datesSet: onDatesSet,
  eventClick: onEventClick,
  dateClick: onDateClick,
}))

function headerWeekday(info: DayHeaderContentArg) {
  return new Intl.DateTimeFormat(locale.value, { weekday: 'short', timeZone: props.timezone }).format(info.date)
}

function eventTimes(info: EventContentArg) {
  const [start = '', end = ''] = info.timeText.split(' - ')
  return { start, end }
}
</script>

<template>
  <div class="space-y-4">
    <div class="calendar-toolbar flex min-w-full flex-wrap items-center gap-3 bg-transparent p-0 md:justify-between md:gap-2 md:rounded-xl md:border md:bg-card/70 md:p-2 md:shadow-xs">
      <div class="flex w-full min-w-0 flex-row items-center justify-between gap-1 md:w-auto md:justify-start">
        <Button variant="ghost" size="icon" class="size-8 shrink-0 sm:size-9" :aria-label="t('calendar.previousPeriod')" :disabled="changingView" @click="moveCalendar('previous')"><ChevronLeft class="size-4" /></Button>

        <Popover v-model:open="datePickerOpen">
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              role="combobox"
              class="flex h-9 min-w-0 flex-1 justify-between gap-2 px-3 text-xs font-semibold capitalize sm:w-60 sm:flex-none md:text-sm"
              :aria-label="t('common.date')"
            >
              <span class="flex min-w-0 items-center gap-2"><CalendarDays class="size-4 shrink-0" /><span class="truncate">{{ pickerLabel }}</span></span>
              <ChevronsUpDown class="size-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-auto p-0" align="center">
            <Calendar
              :key="`${locale}-${pickerValue.toString()}`"
              :model-value="pickerValue"
              :default-placeholder="pickerValue"
              :locale="locale"
              :min-value="pickerMinimum"
              :max-value="pickerMaximum"
              :week-starts-on="locale.toLowerCase().startsWith('it') ? 1 : 0"
              layout="month-and-year"
              fixed-weeks
              prevent-deselect
              @update:model-value="selectCalendarDate($event as DateValue | undefined)"
            />
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon" class="size-8 shrink-0 sm:size-9" :aria-label="t('calendar.nextPeriod')" :disabled="changingView" @click="moveCalendar('next')"><ChevronRight class="size-4" /></Button>
      </div>

      <div class="flex w-full min-w-0 flex-nowrap items-center justify-center gap-2 md:w-auto">
        <Tabs :model-value="currentView" class="calendar-view-tabs min-w-0 flex-1 gap-0 md:flex-none">
          <TabsList class="flex h-11 w-full p-1 sm:h-9 md:w-auto">
            <TabsTrigger value="day" class="h-9 w-12 min-w-0 px-2 transition-[width,padding] duration-200 sm:h-7 sm:w-auto sm:min-w-24" @click="setView('day')">
              <GalleryVertical class="size-4" /><span class="calendar-view-label sm:inline">{{ t('calendar.views.day') }}</span>
            </TabsTrigger>
            <TabsTrigger value="week" class="h-9 w-12 min-w-0 px-2 transition-[width,padding] duration-200 sm:h-7 sm:w-auto sm:min-w-24" @click="setView('week')">
              <Tally3 class="size-4" /><span class="calendar-view-label sm:inline">{{ t('calendar.views.week') }}</span>
            </TabsTrigger>
            <TabsTrigger value="month" class="h-9 w-12 min-w-0 px-2 transition-[width,padding] duration-200 sm:h-7 sm:w-auto sm:min-w-24" @click="setView('month')">
              <Table2 class="size-4 rotate-90" /><span class="calendar-view-label sm:inline">{{ t('calendar.views.month') }}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <slot name="toolbar-actions" />
      </div>
    </div>

    <Card :class="['calendar-shell relative gap-0 rounded-none border-0 bg-card p-0 shadow-none sm:rounded-xl sm:border sm:p-3 sm:shadow-sm', `calendar-shell--${currentView}`]">
      <div ref="calendarStage" class="calendar-view-stage" :aria-busy="loading">
      <FullCalendar ref="calendar" :options="options">
        <template #eventContent="info: EventContentArg">
          <div class="w-full overflow-hidden px-1 py-0.5 text-[0.6rem] md:text-xs" :class="info.event.extendedProps.reservation?.status === 'CANCELLED' ? 'line-through' : ''">
            <p class="m-0 truncate font-semibold">{{ info.event.title }}</p>
            <p class="m-0 truncate opacity-80">{{ eventTimes(info).start }}<span v-if="eventTimes(info).end"> – {{ eventTimes(info).end }}</span></p>
          </div>
        </template>

        <template #dayHeaderContent="info: DayHeaderContentArg">
          <div v-if="info.view.type === 'timeGridDay'" class="flex h-full items-center text-sm font-semibold capitalize">
            {{ new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: timezone }).format(info.date) }}
          </div>
          <div v-else-if="info.view.type === 'timeGridWeek'" class="flex w-full flex-col items-center space-y-0.5 text-xs sm:text-sm">
            <p class="m-0 font-semibold capitalize">{{ headerWeekday(info) }}</p>
            <span class="grid size-6 place-items-center rounded-full font-light" :class="info.isToday ? 'bg-primary text-primary-foreground' : ''">{{ info.date.getDate() }}</span>
          </div>
          <span v-else class="capitalize">{{ headerWeekday(info) }}</span>
        </template>

        <template #dayCellContent="info: DayCellContentArg">
          <span class="grid size-7 place-items-center rounded-full text-sm" :class="info.isToday ? 'bg-primary text-primary-foreground' : ''">{{ info.dayNumberText }}</span>
        </template>
      </FullCalendar>
      </div>

      <Transition name="calendar-loading">
        <div v-if="showLoading" class="absolute inset-0 z-20 grid place-items-center bg-background/65 backdrop-blur-[1px]">
          <div class="flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm"><span class="size-4 animate-spin rounded-full border-2 border-muted border-t-primary" />{{ t('calendar.loading') }}</div>
        </div>
      </Transition>
    </Card>
  </div>
</template>
