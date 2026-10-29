<script setup lang="ts">
import { Languages } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { setLocale, type AppLocale } from '@/i18n'
import { Button } from '@/components/ui/button'

const { locale, t } = useI18n()
function toggle() { setLocale((locale.value === 'it' ? 'en' : 'it') as AppLocale) }
</script>
<template><Button type="button" variant="ghost" size="sm" :aria-label="t('common.changeLanguage')" @click="toggle"><Languages class="size-4" />{{ locale === 'it' ? 'EN' : 'IT' }}</Button></template>
