<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { CalendarDays, LogOut, UserRound } from '@lucide/vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import BrandMark from './BrandMark.vue'
import LocaleSwitcher from './LocaleSwitcher.vue'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore(); const router = useRouter()
const { t } = useI18n()
const props = defineProps<{ businessName?: string }>()
const bottomNavHidden = ref(false)
let lastScrollY = 0
let scrollFrame: number | null = null

function updateBottomNav() {
  const currentScrollY = Math.max(window.scrollY, 0)
  const distance = currentScrollY - lastScrollY

  if (currentScrollY <= 24) bottomNavHidden.value = false
  else if (Math.abs(distance) >= 6) bottomNavHidden.value = distance > 0

  lastScrollY = currentScrollY
  scrollFrame = null
}

function handleScroll() {
  if (scrollFrame === null) scrollFrame = window.requestAnimationFrame(updateBottomNav)
}

onMounted(() => {
  lastScrollY = Math.max(window.scrollY, 0)
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
  if (scrollFrame !== null) window.cancelAnimationFrame(scrollFrame)
})

function logout() { auth.logout(); router.push('/auth') }
function initials(name?: string | null) { return name?.trim().split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 1).join('').toUpperCase() || 'A' }
</script>

<template><div class="shell"><header class="topbar"><div class="header-brand-group"><RouterLink to="/book" class="brand"><BrandMark /><span>reservio</span></RouterLink><span v-if="props.businessName" class="header-divider" aria-hidden="true"></span><span v-if="props.businessName" class="header-business-name">{{ props.businessName }}</span></div><div class="header-actions"><LocaleSwitcher /><span class="header-divider" aria-hidden="true"></span><RouterLink to="/account" class="account-link"><Avatar class="account-avatar"><AvatarFallback>{{ initials(auth.user?.name) }}</AvatarFallback></Avatar><span class="hidden sm:inline">{{ t('nav.account') }}</span></RouterLink></div></header><main class="shell-content"><slot /></main><nav class="bottom-nav" :class="{ 'bottom-nav--hidden': bottomNavHidden }" :aria-hidden="bottomNavHidden" :inert="bottomNavHidden"><RouterLink to="/book"><CalendarDays :size="21" /><span>{{ t('nav.book') }}</span></RouterLink><RouterLink to="/account"><UserRound :size="21" /><span>{{ t('nav.account') }}</span></RouterLink><button type="button" @click="logout"><LogOut :size="21" /><span>{{ t('nav.logout') }}</span></button></nav></div></template>
