import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/services/api'
import type { Reservation, Service, Slot } from '@/types'

export const useReservationStore = defineStore('reservations', () => {
  const reservations = ref<Reservation[]>([])
  const services = ref<Service[]>([])
  const loading = ref(false)
  const upcoming = computed(() => reservations.value.filter((item) => ['PENDING', 'CONFIRMED'].includes(item.status) && new Date(item.startAt) >= new Date()).sort((a, b) => a.startAt.localeCompare(b.startAt)))
  async function loadServices() { services.value = (await api<{ services: Service[] }>('/services')).services }
  async function loadReservations() { loading.value = true; try { reservations.value = (await api<{ reservations: Reservation[] }>('/reservations')).reservations } finally { loading.value = false } }
  async function getAvailability(serviceId: string, date: string) { return (await api<{ slots: Slot[] }>(`/availability?serviceId=${encodeURIComponent(serviceId)}&date=${date}`)).slots }
  async function getAvailableDates(month: string) { return (await api<{ availableDates: string[] }>(`/availability/dates?month=${encodeURIComponent(month)}`)).availableDates }
  async function addReservation(serviceId: string, startAt: string) { const result = await api<{ reservation: Reservation }>('/reservations', { method: 'POST', body: JSON.stringify({ serviceId, startAt }) }); reservations.value.push(result.reservation); return result.reservation }
  async function cancelReservation(id: string) { const result = await api<{ reservation: Reservation }>(`/reservations/${id}/cancel`, { method: 'POST' }); const index = reservations.value.findIndex((item) => item.id === id); if (index >= 0) reservations.value[index] = result.reservation }
  return { reservations, services, upcoming, loading, loadServices, loadReservations, getAvailability, getAvailableDates, addReservation, cancelReservation }
})
