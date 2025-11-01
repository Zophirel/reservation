import { computed, reactive } from 'vue';
import { defineStore } from 'pinia';

export interface ReservationEntry {
  date: string;
  slots: string[];
}

const STORAGE_KEY = 'reservation-app-reservations';

function loadFromStorage(): Record<string, string[]> {
  if (typeof window === 'undefined') return {};
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as ReservationEntry[];
    return parsed.reduce<Record<string, string[]>>((acc, entry) => {
      acc[entry.date] = entry.slots;
      return acc;
    }, {});
  } catch (error) {
    console.warn('Failed to parse stored reservations', error);
    return {};
  }
}

function persistToStorage(reservations: Record<string, string[]>) {
  if (typeof window === 'undefined') return;
  const payload: ReservationEntry[] = Object.entries(reservations).map(([date, slots]) => ({
    date,
    slots: [...slots]
  }));
  payload.sort((a, b) => a.date.localeCompare(b.date));
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export const useReservationStore = defineStore('reservations', () => {
  const reservations = reactive<Record<string, string[]>>(loadFromStorage());

  function syncFromStorage() {
    const next = loadFromStorage();
    Object.keys(reservations).forEach((key) => {
      if (!(key in next)) {
        delete reservations[key];
      }
    });
    Object.entries(next).forEach(([date, slots]) => {
      reservations[date] = [...slots];
    });
  }

  function setSlots(date: string, slots: string[]) {
    if (!date) return;
    reservations[date] = [...new Set(slots)].sort();
    persistToStorage(reservations);
  }

  function addSlots(date: string, slots: string[]) {
    const next = new Set(reservations[date] ?? []);
    slots.forEach((slot) => next.add(slot));
    setSlots(date, Array.from(next));
  }

  function removeSlot(date: string, slot: string) {
    const existing = reservations[date];
    if (!existing) return;
    reservations[date] = existing.filter((item) => item !== slot);
    if (reservations[date].length === 0) {
      delete reservations[date];
    }
    persistToStorage(reservations);
  }

  const list = computed<ReservationEntry[]>(() =>
    Object.entries(reservations)
      .map(([date, slots]) => ({ date, slots: [...slots] }))
      .sort((a, b) => a.date.localeCompare(b.date))
  );

  const getForDate = (date: string) => reservations[date] ?? [];

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY) {
        syncFromStorage();
      }
    });
  }

  return {
    reservations,
    list,
    getForDate,
    addSlots,
    setSlots,
    removeSlot,
    syncFromStorage
  };
});
