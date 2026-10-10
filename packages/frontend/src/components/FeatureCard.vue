<script setup lang="ts">
// One feature announcement: illustration, title, release date, description. Unseen features carry
// a red dot; clicking (or pressing Enter/Space on) the card emits `open` so the caller marks it seen.
import type { FeatureItem } from '@paperland/shared'

const props = defineProps<{ feature: FeatureItem }>()
const emit = defineEmits<{ open: [key: string] }>()

function formatDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function open() {
  if (!props.feature.seen) emit('open', props.feature.key)
}
</script>

<template>
  <div
    class="relative flex flex-col overflow-hidden rounded-lg border bg-card"
    :class="feature.seen ? '' : 'cursor-pointer transition-shadow hover:shadow-md'"
    :role="feature.seen ? undefined : 'button'"
    :tabindex="feature.seen ? undefined : 0"
    :aria-label="feature.seen ? undefined : `New feature: ${feature.title}. Mark as seen`"
    @click="open"
    @keydown.enter.prevent="open"
    @keydown.space.prevent="open"
  >
    <span v-if="!feature.seen" class="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card" title="New" />
    <img :src="feature.image_url" :alt="feature.title" class="aspect-[16/9] w-full bg-muted object-cover" loading="lazy" />
    <div class="flex flex-1 flex-col gap-1 p-3">
      <span class="text-sm font-semibold">{{ feature.title }}</span>
      <span class="text-[11px] text-muted-foreground">{{ formatDate(feature.released_at) }}</span>
      <p class="text-xs leading-relaxed text-muted-foreground">{{ feature.description }}</p>
    </div>
  </div>
</template>
