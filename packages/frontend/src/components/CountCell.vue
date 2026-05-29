<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  // A known value (including 0) renders the formatted number; null/undefined renders a
  // neutral placeholder so "not yet enriched" stays distinct from a known zero.
  value?: number | null
  title?: string
}>()

const known = computed(() => typeof props.value === 'number')
const display = computed(() => (known.value ? (props.value as number).toLocaleString() : '–'))
</script>

<template>
  <span
    :title="title"
    class="text-xs tabular-nums whitespace-nowrap"
    :class="known ? 'font-medium' : 'text-muted-foreground'"
  >{{ display }}</span>
</template>
