<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'
import { RefreshCw } from '@lucide/vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { api } from '@/services/api'
import { enableAdminPushNotifications } from '@/services/push'
import type { Settings } from '@/types'

const form = reactive<Settings>({ businessName: '', timezone: 'Europe/Rome', slotIntervalMinutes: 30, bookingWindow: 'MONTH' }); const loading = ref(true); const saving = ref(false)
type CalendarConnection = { status: 'CONNECTED' | 'DISABLED' | 'NOT_CONFIGURED' | 'ERROR'; calendarId?: string; message?: string }
const calendarConnection = ref<CalendarConnection | null>(null); const calendarLoading = ref(false)
type PushConfig = { enabled: boolean; firebase: unknown | null }
type PushStatus = { enabled: boolean; registered: number }
const pushConfig = ref<PushConfig | null>(null); const pushStatusServer = ref<PushStatus | null>(null); const pushLoading = ref(false); const pushTestLoading = ref(false)
const pushPermission = ref(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
const pushStatus = computed(() => {
  if (!pushConfig.value?.enabled) return 'NOT_CONFIGURED'
  if (pushPermission.value === 'granted') return 'ENABLED'
  if (pushPermission.value === 'denied') return 'BLOCKED'
  return 'READY'
})
const { t } = useI18n()
onMounted(async () => { try { const [settings, connection, push, pushStatusResult] = await Promise.all([api<{ settings: Settings }>('/admin/settings'), api<CalendarConnection>('/admin/settings/google-calendar'), api<PushConfig>('/push/config'), api<PushStatus>('/admin/push/status')]); Object.assign(form, settings.settings); calendarConnection.value = connection; pushConfig.value = push; pushStatusServer.value = pushStatusResult } catch (error) { toast.error(error instanceof Error ? error.message : t('settings.saveError')) } finally { loading.value = false } })
async function save() { saving.value = true; try { Object.assign(form, (await api<{ settings: Settings }>('/admin/settings', { method: 'PUT', body: JSON.stringify(form) })).settings); toast.success(t('settings.updated')) } catch (error) { toast.error(error instanceof Error ? error.message : t('settings.saveError')) } finally { saving.value = false } }
async function refreshCalendarConnection() { calendarLoading.value = true; try { calendarConnection.value = await api<CalendarConnection>('/admin/settings/google-calendar') } catch (error) { toast.error(error instanceof Error ? error.message : t('settings.calendarCheckError')) } finally { calendarLoading.value = false } }
async function enablePush() { pushLoading.value = true; try { await enableAdminPushNotifications(); pushPermission.value = 'granted'; pushStatusServer.value = await api<PushStatus>('/admin/push/status'); window.dispatchEvent(new Event('reservio-push-enabled')); toast.success(t('settings.pushEnabled')) } catch (error) { pushPermission.value = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission; toast.error(error instanceof Error ? error.message : t('settings.pushEnableError')) } finally { pushLoading.value = false } }
async function testPush() { pushTestLoading.value = true; try { const result = await api<{ sent: number; failed: number; errors: string[] }>('/admin/push/test', { method: 'POST' }); if (result.sent) toast.success(t('settings.pushTestSent')); else toast.error(`${t('settings.pushTestError')}${result.errors.length ? ` (${result.errors.join(', ')})` : ''}`) } catch (error) { toast.error(error instanceof Error ? error.message : t('settings.pushTestError')) } finally { pushTestLoading.value = false } }
</script>
<template>
  <PageHeader :title="t('nav.settings')" :description="t('settings.description')" />
  <div class="grid max-w-2xl gap-4">
    <Card>
      <CardHeader><CardTitle>{{ t('settings.title') }}</CardTitle><CardDescription>{{ t('settings.timezoneDescription') }}</CardDescription></CardHeader>
      <CardContent><form class="grid gap-5" @submit.prevent="save"><Label>{{ t('settings.businessName') }}<Input v-model="form.businessName" :disabled="loading" required /></Label><Label>{{ t('settings.timezone') }}<Input v-model="form.timezone" :disabled="loading" placeholder="Europe/Rome" required /></Label><Label>{{ t('settings.slotInterval') }}<Input v-model.number="form.slotIntervalMinutes" :disabled="loading" type="number" min="5" max="120" step="5" required /></Label><Label>{{ t('settings.bookingWindow') }}<NativeSelect v-model="form.bookingWindow" :disabled="loading"><NativeSelectOption value="WEEK">{{ t('settings.bookingWindows.week') }}</NativeSelectOption><NativeSelectOption value="MONTH">{{ t('settings.bookingWindows.month') }}</NativeSelectOption></NativeSelect></Label><p class="text-sm text-muted-foreground">{{ t('settings.bookingWindowDescription') }}</p><Button class="w-fit" :disabled="loading || saving">{{ saving ? t('common.saving') : t('settings.save') }}</Button></form></CardContent>
    </Card>
    <Card>
      <CardHeader class="flex-row items-start justify-between gap-4"><div><CardTitle>{{ t('settings.calendarTitle') }}</CardTitle><CardDescription>{{ t('settings.calendarDescription') }}</CardDescription></div><Badge v-if="calendarConnection" :variant="calendarConnection.status === 'CONNECTED' ? 'default' : calendarConnection.status === 'ERROR' ? 'destructive' : 'secondary'">{{ t(`settings.calendarStatuses.${calendarConnection.status.toLowerCase()}`) }}</Badge></CardHeader>
      <CardContent class="flex flex-wrap items-center justify-between gap-3"><div class="text-sm text-muted-foreground"><p v-if="calendarConnection?.calendarId">{{ t('settings.calendarId') }}: {{ calendarConnection.calendarId }}</p><p v-if="calendarConnection?.message">{{ calendarConnection.message }}</p></div><Button variant="outline" :disabled="calendarLoading" @click="refreshCalendarConnection"><RefreshCw class="size-4" :class="calendarLoading ? 'animate-spin' : ''" />{{ t('settings.calendarCheck') }}</Button></CardContent>
    </Card>
    <Card>
      <CardHeader class="flex-row items-start justify-between gap-4"><div><CardTitle>{{ t('settings.pushTitle') }}</CardTitle><CardDescription>{{ t('settings.pushDescription') }}</CardDescription></div><Badge v-if="pushConfig" :variant="pushStatus === 'ENABLED' ? 'default' : pushStatus === 'BLOCKED' ? 'destructive' : 'secondary'">{{ t(`settings.pushStatuses.${pushStatus.toLowerCase()}`) }}</Badge></CardHeader>
      <CardContent class="flex flex-wrap items-center justify-between gap-3"><div class="text-sm text-muted-foreground"><p>{{ pushStatus === 'BLOCKED' ? t('settings.pushBlocked') : t('settings.pushHelp') }}</p><p v-if="pushStatusServer" class="mt-1 text-xs">{{ t('settings.pushRegistered', { count: pushStatusServer.registered }) }}</p></div><div class="flex flex-wrap gap-2"><Button v-if="pushStatus !== 'ENABLED'" variant="outline" :disabled="pushLoading || pushStatus === 'NOT_CONFIGURED' || pushStatus === 'BLOCKED'" @click="enablePush">{{ pushLoading ? t('settings.pushEnabling') : t('settings.pushEnable') }}</Button><Button v-if="pushStatus === 'ENABLED'" variant="outline" :disabled="pushTestLoading" @click="testPush">{{ pushTestLoading ? t('settings.pushTesting') : t('settings.pushTest') }}</Button></div></CardContent>
    </Card>
  </div>
</template>
