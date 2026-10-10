<script setup lang="ts">
import { Highlighter, NotebookPen } from '@lucide/vue'

defineProps<{
  highlightCount: number
  noteAnchorCount: number
}>()
</script>

<template>
  <div v-if="highlightCount > 0 || noteAnchorCount > 0" class="flex items-center gap-1.5 shrink-0">
    <span
      v-if="highlightCount > 0"
      class="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground"
      :aria-label="`${highlightCount} ${highlightCount === 1 ? 'highlight' : 'highlights'}`"
    ><Highlighter class="h-2.5 w-2.5" />{{ highlightCount }} {{ highlightCount === 1 ? 'highlight' : 'highlights' }}</span>
    <span
      v-if="noteAnchorCount > 0"
      class="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground"
      :aria-label="`${noteAnchorCount} ${noteAnchorCount === 1 ? 'note reference' : 'note references'}`"
    ><NotebookPen class="h-2.5 w-2.5" />{{ noteAnchorCount }} {{ noteAnchorCount === 1 ? 'note reference' : 'note references' }}</span>
  </div>
</template>
