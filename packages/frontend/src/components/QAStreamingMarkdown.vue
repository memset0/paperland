<script setup lang="ts">
import { ref, watch } from 'vue'
import { splitStreamingMarkdown } from '@/lib/streaming-markdown'
import MarkdownContent from './MarkdownContent.vue'

const props = defineProps<{ content: string }>()
const stableSource = ref('')
const stableFragments = ref<Array<{ id: number; source: string }>>([])
const tailSource = ref('')
let nextId = 1

watch(() => props.content, (content) => {
  const { stable, tail } = splitStreamingMarkdown(content)
  if (!stable.startsWith(stableSource.value)) {
    stableSource.value = ''
    stableFragments.value = []
  }
  const appended = stable.slice(stableSource.value.length)
  if (appended) {
    stableFragments.value.push({ id: nextId++, source: appended })
    stableSource.value = stable
  }
  tailSource.value = tail
}, { immediate: true })
</script>

<template>
  <div class="streaming-markdown text-sm" aria-live="polite" aria-busy="true">
    <MarkdownContent
      v-for="fragment in stableFragments"
      :key="fragment.id"
      :content="fragment.source"
      :disable-highlights="true"
    />
    <MarkdownContent
      :content="tailSource"
      :disable-highlights="true"
      data-streaming-tail
    />
  </div>
</template>

<style scoped>
.streaming-markdown {
  overflow-anchor: auto;
}

.streaming-markdown,
.streaming-markdown :deep(*) {
  transition-property: none !important;
}

.streaming-markdown :deep(a) {
  pointer-events: none;
}
</style>
