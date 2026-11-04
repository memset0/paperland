<script setup lang="ts">
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import type { CompletionItem } from '@paperland/shared'
import { AlertCircle, CheckCircle2, MessageSquareText, Telescope } from '@lucide/vue'

// One completion notice (rendered by vue-sonner's `toast.custom`). The whole card is the link:
// click → `open` in this tab; Ctrl/⌘-click or middle-click → the same URL in a new browser tab.
const props = defineProps<{
  toastId: string
  /** A single completion, or null for the "N more" summary. */
  item: CompletionItem | null
  more?: number
  href: string
  open: () => void
}>()

const failed = computed(() => props.item?.status === 'failed')
const heading = computed(() => {
  if (!props.item) return `${props.more} more finished`
  if (props.item.kind === 'qa') return failed.value ? 'Answer failed' : 'Answer ready'
  return failed.value ? 'Research round failed' : 'Research round finished'
})
const detail = computed(() => {
  const item = props.item
  if (!item) return 'Open the list'
  return item.kind === 'qa' ? `${item.paper_title ?? `Paper ${item.paper_id}`} · ${item.model_name}` : 'Deep Research'
})

function onClick(e: MouseEvent) {
  e.preventDefault()
  toast.dismiss(props.toastId)
  if (e.ctrlKey || e.metaKey || e.shiftKey) window.open(props.href, '_blank', 'noopener')
  else props.open()
}
function onAuxClick(e: MouseEvent) {
  if (e.button !== 1) return
  e.preventDefault()
  toast.dismiss(props.toastId)
  window.open(props.href, '_blank', 'noopener')
}
</script>

<template>
  <a
    :href="href"
    class="flex w-[356px] max-w-[calc(100vw-2rem)] cursor-pointer items-start gap-3 rounded-md border bg-popover p-3 text-popover-foreground shadow-lg transition-colors hover:bg-accent"
    title="Click to open · Ctrl/⌘-click to open in a new tab"
    data-completion-toast
    @click="onClick"
    @auxclick="onAuxClick"
  >
    <span class="mt-0.5 shrink-0" :class="failed ? 'text-destructive' : 'text-primary'">
      <AlertCircle v-if="failed" class="size-4" />
      <MessageSquareText v-else-if="item?.kind === 'qa'" class="size-4" />
      <Telescope v-else-if="item?.kind === 'research'" class="size-4" />
      <CheckCircle2 v-else class="size-4" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="block text-xs font-semibold">{{ heading }}</span>
      <span v-if="item" class="mt-0.5 block truncate text-sm">{{ item.title }}</span>
      <span class="mt-0.5 block truncate text-xs text-muted-foreground">{{ detail }}</span>
    </span>
  </a>
</template>
