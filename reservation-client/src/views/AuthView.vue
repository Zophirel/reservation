<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ArrowRight, Eye, EyeOff } from '@lucide/vue'
import { toast } from 'vue-sonner'
import BrandMark from '@/components/BrandMark.vue'
import LocaleSwitcher from '@/components/LocaleSwitcher.vue'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore(); const router = useRouter()
const { t } = useI18n()
const email = ref(''); const password = ref(''); const showPassword = ref(false); const submitting = ref(false)
async function submit() {
  submitting.value = true
  try { await auth.login(email.value, password.value); toast.success(t('auth.welcomeToast')); await router.push('/book') }
  catch (error) { toast.error(error instanceof Error ? error.message : t('auth.error')) }
  finally { submitting.value = false }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-intro"><div class="brand brand-light"><BrandMark /><span>reservio</span></div><div class="intro-copy"><p class="eyebrow">{{ t('auth.eyebrow') }}</p><h1>{{ t('auth.title') }}<br><em>{{ t('auth.titleAccent') }}</em></h1><p>{{ t('auth.intro') }}</p></div><p class="intro-footer">{{ t('auth.footer') }}</p></section>
    <section class="auth-panel"><div class="absolute right-4 top-4 flex items-center gap-1"><ThemeSwitcher /><LocaleSwitcher /></div><form class="auth-card" @submit.prevent="submit"><div class="mobile-brand brand"><BrandMark /><span>reservio</span></div><p class="eyebrow">{{ t('auth.welcome') }}</p><h2>{{ t('auth.greeting') }}</h2><p class="muted">{{ t('auth.description') }}</p><Label>{{ t('auth.email') }}<Input v-model="email" type="email" autocomplete="email" placeholder="you@example.com" required /></Label><Label>{{ t('common.password') }}<span class="password-field"><Input v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" minlength="8" required /><Button type="button" variant="ghost" size="icon" @click="showPassword = !showPassword"><EyeOff v-if="showPassword" :size="18" /><Eye v-else :size="18" /></Button></span></Label><Button class="primary-button" type="submit" :disabled="submitting">{{ submitting ? t('auth.signingIn') : t('auth.continue') }}<ArrowRight v-if="!submitting" :size="18" /></Button><p class="terms">{{ t('auth.invitationOnly') }}</p></form></section>
  </main>
</template>
