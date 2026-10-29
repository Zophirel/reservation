<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { getLocalTimeZone, today, type DateValue } from '@internationalized/date'
import { CalendarIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'
import DaySchedule from '@/components/availability/DaySchedule.vue'
import TimeInterval from '@/components/availability/TimeInterval.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/services/api'
import type { AvailabilityException, Interval, ScheduleDay } from '@/types'

const { t, tm, locale } = useI18n()
const names = () => tm('availability.days') as string[]
const days = ref<ScheduleDay[]>([]); const exceptions = ref<AvailabilityException[]>([]); const dialog = ref(false); const saving = ref(false)
const exceptionDate = ref(''); const exceptionType = ref<'DAY_OFF' | 'SPECIAL_HOURS'>('DAY_OFF'); const reason = ref(''); const intervals = ref<Interval[]>([{ start: '09:00', end: '13:00' }])
const exceptionCalendar = ref<DateValue>(today(getLocalTimeZone()))
watch(exceptionCalendar, (value) => { exceptionDate.value = value.toString() }, { immediate: true })
async function load() { const [weekly, exceptionData] = await Promise.all([api<{ days: ScheduleDay[] }>('/admin/availability/weekly'), api<{ exceptions: AvailabilityException[] }>('/admin/availability/exceptions')]); days.value = weekly.days; exceptions.value = exceptionData.exceptions }
async function saveWeekly() { saving.value = true; try { await api('/admin/availability/weekly', { method: 'PUT', body: JSON.stringify({ days: days.value }) }); toast.success(t('availability.updated')) } catch (error) { toast.error(error instanceof Error ? error.message : t('availability.saveError')) } finally { saving.value = false } }
async function saveException() { try { await api('/admin/availability/exceptions', { method: 'POST', body: JSON.stringify({ date: exceptionDate.value, type: exceptionType.value, reason: reason.value, intervals: exceptionType.value === 'SPECIAL_HOURS' ? intervals.value : [] }) }); toast.success(t('availability.exceptionSaved')); dialog.value = false; await load() } catch (error) { toast.error(error instanceof Error ? error.message : t('availability.exceptionError')) } }
async function removeException(id: string) { await api(`/admin/availability/exceptions/${id}`, { method: 'DELETE' }); toast.success(t('availability.removed')); await load() }
function updateInterval(index: number, value: Interval) { intervals.value[index] = value }
onMounted(load)
</script>
<template><PageHeader :title="t('nav.availability')" :description="t('availability.description')"><Button @click="dialog = true">{{ t('availability.addException') }}</Button></PageHeader><div class="grid items-start gap-6 xl:grid-cols-[1fr_360px]"><div><div class="grid items-start gap-3 md:grid-cols-2"><DaySchedule v-for="(day, index) in days" :key="day.weekday" v-model="days[index]!" :label="names()[day.weekday - 1]!" /></div><Button class="mt-4" :disabled="saving" @click="saveWeekly">{{ saving ? t('common.saving') : t('availability.saveWeekly') }}</Button></div><Card><CardHeader><CardTitle>{{ t('availability.exceptions') }}</CardTitle></CardHeader><CardContent class="space-y-3"><div v-for="exception in exceptions" :key="exception.id" class="flex items-center justify-between rounded-lg border p-3"><div><p class="font-medium">{{ new Date(exception.date).toLocaleDateString(locale) }}</p><p class="text-sm text-muted-foreground">{{ exception.reason || t('availability.noReason') }}</p><Badge class="mt-2" variant="secondary">{{ exception.type === 'DAY_OFF' ? t('availability.dayOff') : t('availability.specialHours') }}</Badge></div><Button variant="ghost" size="sm" @click="removeException(exception.id)">{{ t('common.remove') }}</Button></div><p v-if="!exceptions.length" class="py-8 text-center text-sm text-muted-foreground">{{ t('availability.none') }}</p></CardContent></Card></div><Dialog v-model:open="dialog"><DialogContent><DialogHeader><DialogTitle>{{ t('availability.exceptionTitle') }}</DialogTitle><DialogDescription>{{ t('availability.exceptionDescription') }}</DialogDescription></DialogHeader><form class="grid gap-4" @submit.prevent="saveException"><Label>{{ t('common.date') }}<Popover><PopoverTrigger as-child><Button type="button" variant="outline" class="justify-start"><CalendarIcon />{{ exceptionDate }}</Button></PopoverTrigger><PopoverContent class="w-auto p-0"><Calendar :key="locale" v-model="exceptionCalendar" :locale="locale" :min-value="today(getLocalTimeZone())" /></PopoverContent></Popover></Label><Label>{{ t('common.type') }}<Select v-model="exceptionType"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DAY_OFF">{{ t('availability.dayOff') }}</SelectItem><SelectItem value="SPECIAL_HOURS">{{ t('availability.specialHours') }}</SelectItem></SelectContent></Select></Label><Label>{{ t('availability.reason') }}<Input v-model="reason" :placeholder="t('availability.holiday')" /></Label><div v-if="exceptionType === 'SPECIAL_HOURS'" class="space-y-2"><TimeInterval v-for="(interval, index) in intervals" :key="index" :model-value="interval" @update:model-value="updateInterval(index, $event)" @remove="intervals.splice(index, 1)" /><Button type="button" variant="ghost" @click="intervals.push({ start: '09:00', end: '13:00' })">{{ t('common.addInterval') }}</Button></div><DialogFooter><Button type="button" variant="outline" @click="dialog = false">{{ t('common.cancel') }}</Button><Button>{{ t('availability.saveException') }}</Button></DialogFooter></form></DialogContent></Dialog></template>
