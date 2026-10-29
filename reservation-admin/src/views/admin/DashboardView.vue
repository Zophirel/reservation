<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { CalendarClock, Link2, Users, Wrench } from '@lucide/vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/services/api'

const metrics = ref<Record<string, number> | null>(null)
const { t } = useI18n()
const cards = [{ key: 'pendingReservations', label: 'dashboard.pendingReservations', icon: CalendarClock }, { key: 'upcomingReservations', label: 'dashboard.upcomingReservations', icon: CalendarClock }, { key: 'activeServices', label: 'dashboard.activeServices', icon: Wrench }, { key: 'activeUsers', label: 'dashboard.activeUsers', icon: Users }, { key: 'activeInvitations', label: 'dashboard.activeInvitations', icon: Link2 }]
onMounted(async () => { metrics.value = (await api<{ metrics: Record<string, number> }>('/admin/dashboard')).metrics })
</script>
<template><PageHeader :title="t('nav.dashboard')" :description="t('dashboard.description')" /><div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Card v-for="card in cards" :key="card.key"><CardHeader class="flex-row items-center justify-between"><CardTitle class="text-sm font-medium">{{ t(card.label) }}</CardTitle><component :is="card.icon" class="size-4 text-muted-foreground" /></CardHeader><CardContent><Skeleton v-if="!metrics" class="h-9 w-20" /><p v-else class="text-3xl font-bold">{{ metrics[card.key] }}</p></CardContent></Card></div></template>
