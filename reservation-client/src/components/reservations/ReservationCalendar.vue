<script setup lang="ts">
import { computed, ref } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import italianLocale from '@fullcalendar/core/locales/it'
import type { CalendarOptions, DatesSetArg, DayCellContentArg, DayHeaderContentArg, EventClickArg, EventContentArg } from '@fullcalendar/core'
import { CalendarDate, type DateValue } from '@internationalized/date'
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsUpDown } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Reservation } from '@/types'

const props = defineProps<{ reservations: Reservation[] }>()
const emit = defineEmits<{ select: [reservation: Reservation] }>()
const { locale } = useI18n()
const calendar = ref<InstanceType<typeof FullCalendar> | null>(null)
const viewedDate = ref(new Date())
const pickerOpen = ref(false)
const pickerValue = computed(() => new CalendarDate(viewedDate.value.getFullYear(), viewedDate.value.getMonth() + 1, viewedDate.value.getDate()))
const pickerLabel = computed(() => new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric' }).format(viewedDate.value))
function selectDate(value: DateValue | undefined) {
  if (!value) return
  pickerOpen.value = false
  calendar.value?.getApi().gotoDate(new Date(value.year, value.month - 1, value.day))
}
function eventClick(info: EventClickArg) {
  const reservation = props.reservations.find((item) => item.id === info.event.id)
  if (reservation) emit('select', reservation)
}
function eventColor(item: Reservation) {
  if (item.status === 'CANCELLED') return '#e2e8f0'
  if (item.status === 'PENDING') return '#fed7aa'
  const colors = ['#bbf7d0', '#bfdbfe', '#ddd6fe', '#fde68a']
  return colors[[...item.service.id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % colors.length]
}
const options = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin], initialView: 'dayGridMonth', headerToolbar: false,
  locale: locale.value.toLowerCase().startsWith('it') ? italianLocale : 'en',
  firstDay: locale.value.toLowerCase().startsWith('it') ? 1 : 0,
  events: props.reservations.map((item) => ({
    id: item.id, title: item.service.name, start: item.startAt, end: item.endAt, display: 'block',
    backgroundColor: eventColor(item), borderColor: '#111827',
    textColor: item.status === 'CANCELLED' ? '#64748b' : '#111827',
    classNames: item.status === 'CANCELLED' ? ['reservation-event--cancelled'] : [],
  })),
  displayEventEnd: true, eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
  dayMaxEvents: 3, height: 'clamp(28rem, 55vh, 42rem)', expandRows: true,
  datesSet: (info: DatesSetArg) => { viewedDate.value = info.view.currentStart }, eventClick,
}))
</script>

<template>
  <div class="reservation-calendar">
    <div class="calendar-toolbar">
      <Button variant="ghost" size="icon" :aria-label="locale === 'it' ? 'Mese precedente' : 'Previous month'" @click="calendar?.getApi().prev()"><ChevronLeft :size="16" /></Button>
      <Popover v-model:open="pickerOpen">
        <PopoverTrigger as-child>
          <Button variant="outline" role="combobox" class="calendar-picker" :aria-label="locale === 'it' ? 'Seleziona data' : 'Select date'"><span><CalendarDays :size="16" />{{ pickerLabel }}</span><ChevronsUpDown :size="14" /></Button>
        </PopoverTrigger>
        <PopoverContent class="w-auto p-0" align="center">
          <Calendar :key="`${locale}-${pickerValue.toString()}`" :model-value="pickerValue" :default-placeholder="pickerValue" :locale="locale" :week-starts-on="locale.toLowerCase().startsWith('it') ? 1 : 0" layout="month-and-year" fixed-weeks prevent-deselect @update:model-value="selectDate($event as DateValue | undefined)" />
        </PopoverContent>
      </Popover>
      <Button variant="ghost" size="icon" :aria-label="locale === 'it' ? 'Mese successivo' : 'Next month'" @click="calendar?.getApi().next()"><ChevronRight :size="16" /></Button>
    </div>
    <div class="calendar-shell">
      <FullCalendar ref="calendar" :options="options">
        <template #eventContent="info: EventContentArg">
          <div class="calendar-event" :class="{ 'calendar-event--cancelled': info.event.classNames.includes('reservation-event--cancelled') }"><p>{{ info.event.title }}</p><p>{{ info.timeText }}</p></div>
        </template>
        <template #dayHeaderContent="info: DayHeaderContentArg"><span class="weekday">{{ new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(info.date) }}</span></template>
        <template #dayCellContent="info: DayCellContentArg"><span class="day-number" :class="{ 'day-number--today': info.isToday }">{{ info.dayNumberText }}</span></template>
      </FullCalendar>
    </div>
  </div>
</template>

<style scoped>
.reservation-calendar { min-width: 0; }
.calendar-toolbar { display: flex; align-items: center; gap: 4px; margin-bottom: 16px; padding: 8px; border: 1px solid #e9ecef; border-radius: 12px; }
.calendar-picker { min-width: 0; width: 240px; justify-content: space-between; gap: 8px; padding: 0 12px; font-size: 13px; font-weight: 600; text-transform: capitalize; }
.calendar-picker > span { display: flex; min-width: 0; align-items: center; gap: 8px; }
.calendar-shell { --fc-border-color: #e9ecef; --fc-page-bg-color: transparent; --fc-today-bg-color: transparent; min-width: 0; border: 1px solid #e9ecef; border-radius: 12px; padding: 12px; }
.calendar-shell :deep(.fc) { font-size: 12px; }
.calendar-shell :deep(.fc-scrollgrid) { border: 0; }
.calendar-shell :deep(.fc-theme-standard th) { border-right: 0; }
.calendar-shell :deep(.fc-col-header-cell-cushion) { display: flex; min-height: 3.5rem; align-items: center; justify-content: center; color: #374151; text-decoration: none; }
.calendar-shell :deep(.fc-day-today) { background: transparent; }
.calendar-shell :deep(.fc-day-other) { background: #f6f7f8; }
.calendar-shell :deep(.fc-daygrid-day-top) { display: flex; min-height: 2rem; align-items: center; }
.calendar-shell :deep(.fc-daygrid-day-number) { color: #374151; text-decoration: none; }
.calendar-shell :deep(.fc-event) { min-width: 100%; overflow: hidden; border-width: 0 0 0 3px; cursor: pointer; transition: filter .15s, transform .15s; }
.calendar-shell :deep(.fc-event:hover) { filter: brightness(.97); transform: translateY(-1px) scale(1.01); }
.calendar-shell :deep(.reservation-event--cancelled) { opacity: .7; }
.calendar-shell :deep(.fc-more-link) { color: #111827; font-size: .75rem; font-weight: 600; }
.weekday { text-transform: capitalize; }
.day-number { display: grid; width: 28px; height: 28px; place-items: center; border-radius: 50%; font-size: 14px; }
.day-number--today { color: white; background: #111827; }
.calendar-event { width: 100%; overflow: hidden; padding: 2px 4px; font-size: 12px; }
.calendar-event p { overflow: hidden; margin: 0; text-overflow: ellipsis; white-space: nowrap; }
.calendar-event p:first-child { font-weight: 600; }
.calendar-event p:last-child { opacity: .8; }
.calendar-event--cancelled { text-decoration: line-through; }
@media (max-width: 639px) {
  .calendar-toolbar { padding: 0; border: 0; }
  .calendar-picker { flex: 1; width: auto; }
  .calendar-shell { border: 0; padding: 0; }
  .calendar-shell :deep(.fc-col-header-cell-cushion) { min-height: 2.25rem; padding: 0 2px; font-size: .7rem; }
  .calendar-shell :deep(.fc-daygrid-day-frame) { min-height: 3.75rem; }
  .calendar-shell :deep(.fc-daygrid-day-number) { padding: .2rem; }
  .day-number { width: 1.5rem; height: 1.5rem; font-size: .7rem; }
  .calendar-event { padding: 2px; font-size: .6rem; }
}
</style>

