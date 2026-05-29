<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'

const props = defineProps<{
  link?: string | null
  arxivId?: string | null
}>()

const info = computed(() => {
  if (!props.link) return null
  try {
    const url = new URL(props.link)
    if (url.hostname.includes('arxiv.org') && props.arxivId) {
      return { label: `arxiv:${props.arxivId}`, variant: 'destructive' as const }
    }
    return { label: url.hostname.replace(/^www\./, ''), variant: 'secondary' as const }
  } catch {
    return { label: props.link, variant: 'secondary' as const }
  }
})
</script>

<template>
  <Badge
    v-if="info"
    as="a"
    :variant="info.variant"
    :href="link!"
    target="_blank"
    rel="noopener"
    @click.stop
  >
    {{ info.label }}
  </Badge>
  <span v-else class="text-muted-foreground">-</span>
</template>
