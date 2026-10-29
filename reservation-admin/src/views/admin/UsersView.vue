<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'
import PageHeader from '@/components/layout/PageHeader.vue'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/services/api'
import type { Page, User } from '@/types'

const users = ref<User[]>([]); const search = ref(''); const selected = ref<User | null>(null)
const { t, locale } = useI18n()
async function load() { users.value = (await api<Page<User>>(`/admin/users?pageSize=100&search=${encodeURIComponent(search.value)}`)).items }
async function toggle() { const user = selected.value; if (!user) return; try { await api(`/admin/users/${user.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' }) }); toast.success(t('users.updated')); await load() } catch (error) { toast.error(error instanceof Error ? error.message : t('users.updateError')) } }
onMounted(load)
</script>
<template><PageHeader :title="t('nav.users')" :description="t('users.description')" /><div class="mb-4 flex gap-2"><Input v-model="search" class="max-w-sm" :placeholder="t('users.placeholder')" @keyup.enter="load" /><Button variant="outline" @click="load">{{ t('common.filter') }}</Button></div><div class="rounded-xl border bg-card"><Table><TableHeader><TableRow><TableHead>{{ t('common.name') }}</TableHead><TableHead>{{ t('common.role') }}</TableHead><TableHead>{{ t('common.status') }}</TableHead><TableHead>{{ t('users.joined') }}</TableHead><TableHead /></TableRow></TableHeader><TableBody><TableRow v-for="user in users" :key="user.id"><TableCell><strong>{{ user.name }}</strong><p class="text-sm text-muted-foreground">{{ user.email }}</p></TableCell><TableCell>{{ t(`common.roles.${user.role.toLowerCase()}`) }}</TableCell><TableCell><Badge :variant="user.status === 'ACTIVE' ? 'default' : 'secondary'">{{ t(`common.statuses.${user.status.toLowerCase()}`) }}</Badge></TableCell><TableCell>{{ new Date(user.createdAt).toLocaleDateString(locale) }}</TableCell><TableCell><Button variant="outline" size="sm" @click="selected = user">{{ user.status === 'ACTIVE' ? t('users.disable') : t('users.enable') }}</Button></TableCell></TableRow><TableRow v-if="!users.length"><TableCell colspan="5" class="h-32 text-center text-muted-foreground">{{ t('users.empty') }}</TableCell></TableRow></TableBody></Table></div><AlertDialog :open="Boolean(selected)" @update:open="(open) => { if (!open) selected = null }"><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{{ selected?.status === 'ACTIVE' ? t('users.disableTitle') : t('users.enableTitle') }}</AlertDialogTitle><AlertDialogDescription>{{ t('users.disabledDescription') }}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel><AlertDialogAction @click="toggle">{{ t('common.continue') }}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></template>
