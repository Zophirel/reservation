<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { LockKeyhole } from '@lucide/vue'
import { toast } from 'vue-sonner'
import BrandMark from '@/components/BrandMark.vue'
import LocaleSwitcher from '@/components/LocaleSwitcher.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/auth'

const email = ref(''); const password = ref(''); const loading = ref(false); const auth = useAuthStore(); const router = useRouter()
const { t } = useI18n()
async function submit() { loading.value = true; try { await auth.login(email.value, password.value); await router.push('/') } catch (error) { toast.error(error instanceof Error ? error.message : t('login.error')) } finally { loading.value = false } }
</script>
<template><main class="relative grid min-h-screen place-items-center bg-muted/40 p-5"><div class="absolute right-4 top-4"><LocaleSwitcher /></div><Card class="w-full max-w-md"><CardHeader class="space-y-4"><div class="brand"><BrandMark /><span>reservio admin</span></div><div><CardTitle>{{ t('login.title') }}</CardTitle><CardDescription>{{ t('login.description') }}</CardDescription></div></CardHeader><CardContent><form class="grid gap-4" @submit.prevent="submit"><Label>{{ t('common.email') }}<Input v-model="email" type="email" autocomplete="username" required /></Label><Label>{{ t('common.password') }}<Input v-model="password" type="password" autocomplete="current-password" minlength="8" required /></Label><Button :disabled="loading"><LockKeyhole />{{ loading ? t('login.signingIn') : t('login.submit') }}</Button></form></CardContent></Card></main></template>
