<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import { useI18n } from 'vue-i18n'
import type { Invitation } from '@/types'
defineProps<{ status: Invitation['status'] }>()
const { t } = useI18n()
</script>
<template><Badge :variant="status === 'ACTIVE' ? 'default' : status === 'REVOKED' ? 'destructive' : 'secondary'">{{ t(`common.statuses.${status.toLowerCase()}`) }}</Badge></template>
