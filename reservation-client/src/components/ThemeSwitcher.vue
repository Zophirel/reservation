<script setup lang="ts">
import { Moon, Sun } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { theme, toggleTheme } from '@/theme'
const { locale } = useI18n()
</script>
<template>
  <Button type="button" variant="ghost" size="icon" class="theme-switcher" :aria-label="theme === 'dark' ? (locale === 'it' ? 'Attiva tema chiaro' : 'Switch to light theme') : (locale === 'it' ? 'Attiva tema scuro' : 'Switch to dark theme')" @click="toggleTheme">
    <Sun v-if="theme === 'dark'" :size="18" /><Moon v-else :size="18" />
  </Button>
</template>
