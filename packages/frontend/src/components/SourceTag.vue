<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'

const props = defineProps<{
  link?: string | null
  arxivId?: string | null
}>()

type BadgeInfo = { label: string; href: string; variant: 'destructive' | 'secondary' }

// The arXiv id is a first-class field on the paper — it must show whenever it's
// set, regardless of `link` (papers whose arxiv_id was resolved via S2 may
// keep no arxiv URL in `papers.link`). A separate non-arxiv `link`
// (project page, etc.) is shown alongside.
const badges = computed<BadgeInfo[]>(() => {
  const out: BadgeInfo[] = []
  if (props.arxivId) {
    out.push({
      label: `arxiv:${props.arxivId}`,
      href: `https://arxiv.org/abs/${props.arxivId}`,
      variant: 'destructive',
    })
  }
  if (props.link) {
    let host: string | null = null
    try {
      host = new URL(props.link).hostname.replace(/^www\./, '')
    } catch {
      host = null
    }
    const isArxiv = host?.includes('arxiv.org') ?? false
    // Skip an arxiv.org link when we already rendered the arxiv id badge above.
    if (!(isArxiv && props.arxivId)) {
      out.push({
        label: host ?? props.link,
        href: props.link,
        variant: isArxiv ? 'destructive' : 'secondary',
      })
    }
  }
  return out
})
</script>

<template>
  <template v-if="badges.length">
    <Badge
      v-for="(b, i) in badges"
      :key="i"
      as="a"
      :variant="b.variant"
      :href="b.href"
      target="_blank"
      rel="noopener"
      @click.stop
    >
      {{ b.label }}
    </Badge>
  </template>
  <span v-else class="text-muted-foreground">-</span>
</template>
