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
      :aria-label="`高亮 ${highlightCount}`"
    ><Highlighter class="h-2.5 w-2.5" />高亮 {{ highlightCount }}</span>
    <span
      v-if="noteAnchorCount > 0"
      class="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground"
      :aria-label="`笔记引用 ${noteAnchorCount}`"
    ><NotebookPen class="h-2.5 w-2.5" />笔记引用 {{ noteAnchorCount }}</span>
  </div>
</template>
