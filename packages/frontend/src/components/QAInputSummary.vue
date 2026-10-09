<script setup lang="ts">
import { computed } from 'vue'
import type { QAInput } from '@paperland/shared'
import { TextQuote, Image as ImageIcon, MessagesSquare } from '@lucide/vue'

// Collapsed Q&A headers summarize inputs only as one icon per category with its count;
// input contents and conversation history are never rendered here.
const props = defineProps<{ inputs: QAInput[] | null | undefined }>()

const counts = computed(() => {
  const result = { text_selection: 0, image: 0, history: 0 }
  for (const input of props.inputs ?? []) result[input.kind] += 1
  return result
})
</script>

<template>
  <span v-if="counts.text_selection || counts.image || counts.history" class="inline-flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground">
    <span v-if="counts.text_selection" class="inline-flex items-center gap-0.5" title="选段">
      <TextQuote class="h-3 w-3" />{{ counts.text_selection }}
    </span>
    <span v-if="counts.image" class="inline-flex items-center gap-0.5" title="截图">
      <ImageIcon class="h-3 w-3" />{{ counts.image }}
    </span>
    <span v-if="counts.history" class="inline-flex items-center gap-0.5" title="对话历史">
      <MessagesSquare class="h-3 w-3" />{{ counts.history }}
    </span>
  </span>
</template>
