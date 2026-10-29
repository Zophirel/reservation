<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { MoreHorizontal } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'
import InvitationForm from '@/components/invitations/InvitationForm.vue'
import InvitationQrDialog from '@/components/invitations/InvitationQrDialog.vue'
import InvitationStatusBadge from '@/components/invitations/InvitationStatusBadge.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/services/api'
import type { Invitation, Page } from '@/types'

const items = ref<Invitation[]>([]); const search = ref(''); const qr = ref<Invitation | null>(null); const pending = ref<{ invitation: Invitation; action: 'revoke' | 'regenerate' } | null>(null)
const { t } = useI18n()
async function load() { items.value = (await api<Page<Invitation>>(`/admin/invitations?pageSize=100&search=${encodeURIComponent(search.value)}`)).items }
async function details(item: Invitation) { return (await api<{ invitation: Invitation }>(`/admin/invitations/${item.id}`)).invitation }
async function copy(item: Invitation) { const invitation = await details(item); await navigator.clipboard.writeText(invitation.url || ''); toast.success(t('invitations.copied')) }
async function showQr(item: Invitation) { qr.value = await details(item) }
async function execute() { const operation = pending.value; if (!operation) return; try { const result = await api<{ invitation: Invitation }>(`/admin/invitations/${operation.invitation.id}/${operation.action}`, { method: 'POST' }); if (operation.action === 'regenerate' && result.invitation.url) await navigator.clipboard.writeText(result.invitation.url); toast.success(operation.action === 'revoke' ? t('invitations.revoked') : t('invitations.regenerated')); await load() } catch (error) { toast.error(error instanceof Error ? error.message : t('invitations.updateError')) } }
function created(invitation: Invitation) { items.value.unshift(invitation); if (invitation.url) navigator.clipboard.writeText(invitation.url); toast.success(t('invitations.copied')) }
onMounted(load)
</script>
<template><PageHeader :title="t('nav.invitations')" :description="t('invitations.description')"><InvitationForm @created="created" /></PageHeader><div class="mb-4 flex gap-2"><Input v-model="search" class="max-w-sm" :placeholder="t('invitations.placeholder')" @keyup.enter="load" /><Button variant="outline" @click="load">{{ t('common.filter') }}</Button></div><div class="rounded-xl border bg-card"><Table><TableHeader><TableRow><TableHead>{{ t('common.name') }}</TableHead><TableHead>{{ t('common.type') }}</TableHead><TableHead>{{ t('invitations.user') }}</TableHead><TableHead>{{ t('invitations.uses') }}</TableHead><TableHead>{{ t('common.status') }}</TableHead><TableHead /></TableRow></TableHeader><TableBody><TableRow v-for="item in items" :key="item.id"><TableCell>{{ item.name || item.description || t('invitations.invitation') }}</TableCell><TableCell>{{ item.type === 'ONE_TIME' ? t('common.oneTime') : t('common.permanent') }}</TableCell><TableCell>{{ item.email || item.phoneNumber || '—' }}</TableCell><TableCell>{{ item.type === 'ONE_TIME' ? `${item.useCount} / 1` : item.useCount }}</TableCell><TableCell><InvitationStatusBadge :status="item.status" /></TableCell><TableCell><DropdownMenu><DropdownMenuTrigger as-child><Button variant="ghost" size="icon"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem @click="copy(item)">{{ t('invitations.copy') }}</DropdownMenuItem><DropdownMenuItem v-if="item.type === 'PERMANENT'" @click="showQr(item)">{{ t('invitations.showQr') }}</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem @click="pending = { invitation: item, action: 'regenerate' }">{{ t('invitations.regenerate') }}</DropdownMenuItem><DropdownMenuItem class="text-destructive" @click="pending = { invitation: item, action: 'revoke' }">{{ t('invitations.revoke') }}</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell></TableRow><TableRow v-if="!items.length"><TableCell colspan="6" class="h-36 text-center text-muted-foreground">{{ t('invitations.empty') }}</TableCell></TableRow></TableBody></Table></div><InvitationQrDialog :invitation="qr" @close="qr = null" /><AlertDialog :open="Boolean(pending)" @update:open="(open) => { if (!open) pending = null }"><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{{ pending?.action === 'revoke' ? t('invitations.revokeTitle') : t('invitations.regenerateTitle') }}</AlertDialogTitle><AlertDialogDescription>{{ pending?.action === 'revoke' ? t('invitations.revokeDescription') : t('invitations.regenerateDescription') }}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel><AlertDialogAction @click="execute">{{ t('common.continue') }}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></template>
