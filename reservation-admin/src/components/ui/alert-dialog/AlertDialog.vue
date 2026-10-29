<script setup>
import { onBeforeUnmount, ref, watch } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { AlertDialogRoot } from "reka-ui";

const props = defineProps({
  open: { type: Boolean, required: false },
  defaultOpen: { type: Boolean, required: false },
  unmountOnHide: { type: Boolean, required: false },
});
const emits = defineEmits(["update:open"]);

const delegatedProps = reactiveOmit(props, "open", "defaultOpen");
const internalOpen = ref(props.open ?? props.defaultOpen ?? false);
let closeTimer;

function clearCloseTimer() {
  if (closeTimer !== undefined) window.clearTimeout(closeTimer);
  closeTimer = undefined;
}

function updateOpen(value) {
  clearCloseTimer();
  internalOpen.value = value;

  if (value) {
    emits("update:open", true);
    return;
  }

  const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 210;
  closeTimer = window.setTimeout(() => emits("update:open", false), delay);
}

watch(
  () => props.open,
  (value) => {
    if (typeof value !== "boolean") return;
    clearCloseTimer();
    internalOpen.value = value;
  },
);

onBeforeUnmount(clearCloseTimer);
</script>

<template>
  <AlertDialogRoot
    v-slot="slotProps"
    data-slot="alert-dialog"
    v-bind="delegatedProps"
    :open="internalOpen"
    @update:open="updateOpen"
  >
    <slot v-bind="slotProps" />
  </AlertDialogRoot>
</template>
