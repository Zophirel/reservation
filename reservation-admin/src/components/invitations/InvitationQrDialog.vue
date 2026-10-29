<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { Copy, Download } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'
import { apiAsset } from '@/services/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import type { Invitation } from '@/types'

const props = defineProps<{ invitation: Invitation | null }>(); const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const imageUrl = ref('')
function token() { try { return JSON.parse(localStorage.getItem('reservio-admin-session') || 'null')?.token || '' } catch { return '' } }
async function loadQr() { if (!props.invitation) return; const response = await fetch(apiAsset(`/admin/invitations/${props.invitation.id}/qr.svg`), { headers: { Authorization: `Bearer ${token()}` } }); const blob = await response.blob(); imageUrl.value = URL.createObjectURL(blob) }
watch(() => props.invitation, (value) => { if (imageUrl.value) URL.revokeObjectURL(imageUrl.value); imageUrl.value = ''; if (value) loadQr() })
onBeforeUnmount(() => { if (imageUrl.value) URL.revokeObjectURL(imageUrl.value) })
async function copy() { if (props.invitation?.url) { await navigator.clipboard.writeText(props.invitation.url); toast.success(t('invitations.copied')) } }
async function download(format: 'svg' | 'png') { if (!props.invitation) return; const response = await fetch(apiAsset(`/admin/invitations/${props.invitation.id}/qr.${format}`), { headers: { Authorization: `Bearer ${token()}` } }); const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `invitation-${props.invitation.id}.${format}`; anchor.click(); URL.revokeObjectURL(url) }
</script>
<template><Dialog :open="Boolean(invitation)" @update:open="(open) => { if (!open) $emit('close') }"><DialogContent><DialogHeader><DialogTitle>{{ invitation?.name || invitation?.email || t('invitations.qrTitle') }}</DialogTitle><DialogDescription>{{ t('invitations.qrDescription') }}</DialogDescription></DialogHeader><Card><CardContent class="grid place-items-center p-6"><img v-if="imageUrl" :src="imageUrl" :alt="t('invitations.qrAlt')" class="size-64 max-w-full"></CardContent></Card><div class="text-sm"><p>{{ t('invitations.registrations', { count: invitation?.useCount }) }}</p><p>{{ t('common.status') }}: {{ invitation ? t(`common.statuses.${invitation.status.toLowerCase()}`) : '' }}</p></div><Separator /><DialogFooter class="flex-wrap"><Button variant="outline" @click="copy"><Copy />{{ t('invitations.copy') }}</Button><Button variant="outline" @click="download('svg')"><Download />SVG</Button><Button variant="outline" @click="download('png')"><Download />PNG</Button></DialogFooter></DialogContent></Dialog></template>
