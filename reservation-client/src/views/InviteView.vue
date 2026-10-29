<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loader2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import LocaleSwitcher from '@/components/LocaleSwitcher.vue'

type InvitePreview = { type: string; name?: string; email?: string; phoneNumber?: string; role: string; description?: string }
const route = useRoute(); const router = useRouter(); const auth = useAuthStore()
const { t } = useI18n()
const invitation = ref<InvitePreview | null>(null); const loading = ref(true); const submitting = ref(false)
const name = ref(''); const email = ref(''); const phoneNumber = ref(''); const password = ref('')
onMounted(async () => { try { const data = await api<{ invitation: InvitePreview }>(`/invitations/${route.params.token}`); invitation.value = data.invitation; email.value = data.invitation.email || ''; phoneNumber.value = data.invitation.phoneNumber || '' } catch (error) { toast.error(error instanceof Error ? error.message : t('invite.unavailable')) } finally { loading.value = false } })
async function register() { submitting.value = true; try { await auth.register({ token: String(route.params.token), name: name.value, email: email.value, phoneNumber: phoneNumber.value || undefined, password: password.value }); toast.success(t('invite.created')); await router.push('/book') } catch (error) { toast.error(error instanceof Error ? error.message : t('invite.error')) } finally { submitting.value = false } }
</script>

<template><main class="relative min-h-screen grid place-items-center bg-background p-5"><div class="absolute right-4 top-4"><LocaleSwitcher /></div><Card class="w-full max-w-md"><CardHeader><CardTitle>{{ t('invite.title') }}</CardTitle><CardDescription>{{ t('invite.description') }}</CardDescription></CardHeader><CardContent><div v-if="loading" class="flex justify-center p-10"><Loader2 class="animate-spin" /></div><form v-else-if="invitation" class="grid gap-4" @submit.prevent="register"><div class="rounded-lg bg-muted p-3 text-sm"><strong>{{ invitation.name || invitation.email || t('invite.invitation') }}</strong><p class="text-muted-foreground mt-1">{{ t('invite.role', { role: t(`common.role.${invitation.role.toLowerCase()}`) }) }}</p></div><Label>{{ t('invite.fullName') }}<Input v-model="name" required minlength="2" /></Label><Label>{{ t('common.email') }}<Input v-model="email" type="email" required :disabled="Boolean(invitation.email)" /></Label><Label>{{ t('invite.telephone') }}<Input v-model="phoneNumber" type="tel" /></Label><Label>{{ t('common.password') }}<Input v-model="password" type="password" minlength="8" required /></Label><Button type="submit" :disabled="submitting">{{ submitting ? t('invite.creating') : t('invite.create') }}</Button></form><div v-else class="py-8 text-center"><p class="text-muted-foreground">{{ t('invite.invalid') }}</p><Button as-child variant="link"><RouterLink to="/auth">{{ t('invite.return') }}</RouterLink></Button></div></CardContent></Card></main></template>
