<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import TimeInterval from './TimeInterval.vue'
import type { Interval, ScheduleDay } from '@/types'

const props = defineProps<{ modelValue: ScheduleDay; label: string }>()
const { t } = useI18n()
const emit = defineEmits<{ 'update:modelValue': [value: ScheduleDay] }>()
function setEnabled(enabled: boolean) { emit('update:modelValue', { ...props.modelValue, enabled }) }
function setInterval(index: number, value: Interval) { const intervals = [...props.modelValue.intervals]; intervals[index] = value; emit('update:modelValue', { ...props.modelValue, intervals }) }
function add() { emit('update:modelValue', { ...props.modelValue, intervals: [...props.modelValue.intervals, { start: '09:00', end: '17:00' }] }) }
function remove(index: number) { emit('update:modelValue', { ...props.modelValue, intervals: props.modelValue.intervals.filter((_, itemIndex) => itemIndex !== index) }) }
</script>
<template><Card class="gap-4 py-4"><CardHeader class="flex flex-row items-center justify-between px-4"><CardTitle class="text-base">{{ label }}</CardTitle><Switch class="ml-auto" :model-value="modelValue.enabled" @update:model-value="setEnabled" /></CardHeader><CardContent v-if="modelValue.enabled" class="space-y-3 px-4"><TimeInterval v-for="(interval, index) in modelValue.intervals" :key="index" :model-value="interval" @update:model-value="setInterval(index, $event)" @remove="remove(index)" /><Button variant="ghost" size="sm" @click="add"><Plus />{{ t('common.addInterval') }}</Button></CardContent></Card></template>
