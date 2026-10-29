<script setup lang="ts">
import { X } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Interval } from '@/types'

const props = defineProps<{ modelValue: Interval }>()
const { t } = useI18n()
const emit = defineEmits<{ 'update:modelValue': [value: Interval]; remove: [] }>()
function update(key: keyof Interval, value: string) { emit('update:modelValue', { ...props.modelValue, [key]: value }) }
</script>
<template><div class="flex items-center gap-2"><Input type="time" :model-value="modelValue.start" @update:model-value="update('start', String($event))" /><span class="text-muted-foreground">{{ t('common.to') }}</span><Input type="time" :model-value="modelValue.end" @update:model-value="update('end', String($event))" /><Button type="button" variant="ghost" size="icon" @click="$emit('remove')"><X /></Button></div></template>
