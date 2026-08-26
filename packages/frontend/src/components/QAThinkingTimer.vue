<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { QAResultStatus } from '@paperland/shared'
import { formatThinkingDuration } from '@/lib/thinking-time'

const props = defineProps<{
  status: QAResultStatus
  durationMs: number | null
}>()

const displayedMs = ref(0)
let timer: ReturnType<typeof setInterval> | null = null
let baseMs = 0
let baseClock = 0

function stopTimer() {
  if (timer) clearInterval(timer)
  timer = null
}

function syncTimer() {
  stopTimer()
  displayedMs.value = Math.max(0, props.durationMs ?? 0)
  if (props.status !== 'awaiting_output') return
  baseMs = displayedMs.value
  baseClock = typeof performance !== 'undefined' ? performance.now() : Date.now()
  timer = setInterval(() => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    displayedMs.value = baseMs + Math.max(0, now - baseClock)
  }, 1000)
}

watch([() => props.status, () => props.durationMs], syncTimer, { immediate: true })
onBeforeUnmount(stopTimer)

const label = computed(() => props.status === 'awaiting_output' ? 'Thinking' : 'Thought for')
</script>

<template>
  <span
    v-if="status === 'awaiting_output' || durationMs != null"
    class="inline-flex min-w-[7.5rem] items-center text-xs text-muted-foreground tabular-nums"
    :aria-label="`${label} ${formatThinkingDuration(displayedMs)}`"
  >{{ label }} · {{ formatThinkingDuration(displayedMs) }}</span>
</template>
