<template>
  <section class="calendar-layout">
    <div class="calendar-card">
      <header class="calendar-header">
        <button type="button" class="nav" @click="goToPreviousMonth">‹</button>
        <div class="month-title">
          <h2>{{ monthLabel }}</h2>
          <span>{{ year }}</span>
        </div>
        <button type="button" class="nav" @click="goToNextMonth">›</button>
      </header>

      <div class="weekdays">
        <span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span>
      </div>

      <div class="calendar-grid">
        <button
          v-for="day in calendarDays"
          :key="day.iso"
          type="button"
          class="calendar-cell"
          :class="{
            'other-month': !day.isCurrentMonth,
            today: day.isToday,
            selected: selectedDayIso === day.iso
          }"
          @click="selectDay(day)"
        >
          <span>{{ day.label }}</span>
        </button>
      </div>
    </div>

    <div class="slot-card">
      <h3>Available time slots</h3>
      <p v-if="!selectedDayIso" class="helper">Pick a day to see available times.</p>
      <div v-else class="slots">
        <button
          v-for="slot in timeSlots"
          :key="slot"
          type="button"
          class="slot"
          :class="{ reserved: isReserved(slot), selected: selectedSlots.includes(slot) }"
          :disabled="isReserved(slot)"
          @click="toggleSlot(slot)"
        >
          {{ slot }}
        </button>
      </div>

      <div v-if="selectedSlots.length > 0" class="selection-summary">
        <h4>Selection summary</h4>
        <p>
          {{ formattedSelectedDay }} ·
          <span>{{ selectedSlots.join(', ') }}</span>
        </p>
        <button type="button" class="primary" @click="saveReservation">Confirm reservation</button>
      </div>

      <div v-if="reservationsForSelectedDay.length" class="reservation-list">
        <h4>Existing reservations</h4>
        <ul>
          <li v-for="slot in reservationsForSelectedDay" :key="slot">{{ slot }}</li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useReservationStore } from '../stores/reservations';

interface CalendarDay {
  date: Date;
  label: number;
  iso: string;
  isToday: boolean;
  isCurrentMonth: boolean;
}

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const timeSlots = [
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00'
];

const today = new Date();
const focusDate = ref(new Date(today.getFullYear(), today.getMonth(), 1));
const selectedDayIso = ref<string>('');
const selectedSlots = ref<string[]>([]);
const reservationStore = useReservationStore();

function formatISO(date: Date) {
  return date.toISOString().split('T')[0];
}

const monthLabel = computed(() =>
  focusDate.value.toLocaleString(undefined, { month: 'long' })
);
const year = computed(() => focusDate.value.getFullYear());

const calendarDays = computed<CalendarDay[]>(() => {
  const startOfMonth = new Date(focusDate.value);
  const startWeekday = (startOfMonth.getDay() + 6) % 7; // convert so Monday = 0
  const days: CalendarDay[] = [];

  const gridStart = new Date(startOfMonth);
  gridStart.setDate(gridStart.getDate() - startWeekday);

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    const iso = formatISO(date);
    const isToday = iso === formatISO(today);
    days.push({
      date,
      iso,
      label: date.getDate(),
      isToday,
      isCurrentMonth: date.getMonth() === focusDate.value.getMonth()
    });
  }

  return days;
});

const reservationsForSelectedDay = computed(() =>
  selectedDayIso.value ? reservationStore.getForDate(selectedDayIso.value) : []
);
const formattedSelectedDay = computed(() => {
  if (!selectedDayIso.value) return '';
  const date = new Date(selectedDayIso.value);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
});

function goToPreviousMonth() {
  const current = focusDate.value;
  focusDate.value = new Date(current.getFullYear(), current.getMonth() - 1, 1);
}

function goToNextMonth() {
  const current = focusDate.value;
  focusDate.value = new Date(current.getFullYear(), current.getMonth() + 1, 1);
}

function selectDay(day: CalendarDay) {
  selectedDayIso.value = day.iso;
  selectedSlots.value = [];
}

function isReserved(slot: string) {
  return reservationsForSelectedDay.value.includes(slot);
}

function toggleSlot(slot: string) {
  if (!selectedDayIso.value) return;
  selectedSlots.value = selectedSlots.value.includes(slot)
    ? selectedSlots.value.filter((item) => item !== slot)
    : [...selectedSlots.value, slot].sort();
}

function saveReservation() {
  if (!selectedDayIso.value || selectedSlots.value.length === 0) return;
  reservationStore.addSlots(selectedDayIso.value, selectedSlots.value);
  selectedSlots.value = [];
}

// Preselect today if it belongs to the current grid
const todayIso = formatISO(today);
if (calendarDays.value.some((day) => day.iso === todayIso)) {
  selectedDayIso.value = todayIso;
}
</script>

<style scoped>
.calendar-layout {
  width: min(1080px, 100%);
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.calendar-card,
.slot-card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 24px;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
  padding: 2rem;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.month-title {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.month-title h2 {
  margin: 0;
  font-size: 1.5rem;
  letter-spacing: -0.015em;
}

.month-title span {
  color: #64748b;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.2em;
}

.nav {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  border: none;
  background: #e0e7ff;
  color: #312e81;
  font-size: 1.5rem;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.nav:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(99, 102, 241, 0.25);
}

.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.75rem;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.4rem;
}

.calendar-cell {
  aspect-ratio: 1;
  border-radius: 18px;
  border: none;
  background: #eef2ff;
  color: #3730a3;
  font-weight: 600;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.calendar-cell.other-month {
  background: #f8fafc;
  color: #94a3b8;
}

.calendar-cell.today {
  border: 2px solid #6366f1;
}

.calendar-cell.selected {
  background: linear-gradient(135deg, #6366f1, #4338ca);
  color: #fff;
  box-shadow: 0 12px 24px rgba(99, 102, 241, 0.35);
}

.calendar-cell:hover {
  transform: translateY(-1px);
}

.slot-card h3 {
  margin-top: 0;
  margin-bottom: 1rem;
  font-size: 1.3rem;
}

.helper {
  margin: 0;
  color: #64748b;
}

.slots {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.slot {
  flex: 0 1 calc(33% - 0.4rem);
  padding: 0.75rem 0.5rem;
  border-radius: 12px;
  border: 1px solid rgba(99, 102, 241, 0.3);
  background: #f5f3ff;
  color: #3730a3;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.slot:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(79, 70, 229, 0.25);
}

.slot.selected {
  background: linear-gradient(135deg, #6366f1, #4c1d95);
  color: #fff;
  border-color: transparent;
}

.slot.reserved {
  background: #c7d2fe;
  color: #312e81;
  cursor: not-allowed;
  border-color: transparent;
}

.selection-summary {
  margin-top: 1.5rem;
  padding: 1rem 1.25rem;
  border-radius: 16px;
  background: rgba(59, 130, 246, 0.08);
  color: #1d4ed8;
}

.selection-summary h4 {
  margin: 0 0 0.4rem;
}

.selection-summary p {
  margin: 0 0 1rem;
  font-weight: 600;
}

.primary {
  padding: 0.75rem 1.25rem;
  border-radius: 999px;
  border: none;
  background: linear-gradient(135deg, #2563eb, #4338ca);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.3);
}

.reservation-list {
  margin-top: 1.5rem;
}

.reservation-list h4 {
  margin: 0 0 0.75rem;
}

.reservation-list ul {
  margin: 0;
  padding-left: 1.25rem;
  color: #334155;
  font-weight: 600;
}

@media (max-width: 720px) {
  .calendar-card,
  .slot-card {
    padding: 1.5rem;
  }

  .slot {
    flex: 0 1 calc(50% - 0.4rem);
  }
}
</style>
