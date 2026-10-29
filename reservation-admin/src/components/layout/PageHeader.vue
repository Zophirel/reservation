<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>
<template>
  <div class="mb-5 flex flex-wrap items-start justify-between gap-3 pb-5 sm:mb-6 sm:items-end sm:gap-4 sm:border-0 sm:pb-0">
    <div>
      <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{{ title }}</h1>
      <p v-if="description" class="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
        {{ description }}
      </p>
    </div>
    <div class="w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto"><slot /></div>
  </div>
</template>
