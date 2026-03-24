<script setup lang="ts">
const props = defineProps<{
  link?: string | null
  arxivId?: string | null
}>()

function getSourceInfo() {
  if (!props.link) return null
  try {
    const url = new URL(props.link)
    if (url.hostname.includes('arxiv.org') && props.arxivId) {
      return { label: `arxiv:${props.arxivId}`, color: 'red' as const }
    }
    return { label: url.hostname.replace(/^www\./, ''), color: 'gray' as const }
  } catch {
    return { label: props.link, color: 'gray' as const }
  }
}
</script>

<template>
  <a v-if="getSourceInfo()" :href="link!" target="_blank" rel="noopener" @click.stop :class="[
    'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset hover:opacity-80 transition-opacity',
    getSourceInfo()!.color === 'red' ? 'bg-red-50 text-red-700 ring-red-600/10' : 'bg-gray-50 text-gray-600 ring-gray-500/10'
  ]">{{ getSourceInfo()!.label }}</a>
  <span v-else class="text-gray-300">-</span>
</template>
