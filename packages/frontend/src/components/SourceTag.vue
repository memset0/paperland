<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'

const props = defineProps<{
  link?: string | null
  arxivId?: string | null
  /** 'article' (blog post): one "Blog post" badge linking to the original page replaces the host badge. */
  kind?: string | null
}>()

type BadgeInfo = { label: string; href: string | null; variant: 'destructive' | 'secondary' }

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
  if (props.kind === 'article') {
    out.push({ label: 'Blog post', href: props.link || null, variant: 'secondary' })
    return out
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
    <template v-for="(b, i) in badges" :key="i">
      <Badge
        v-if="b.href"
        as="a"
        :variant="b.variant"
        :href="b.href"
        target="_blank"
        rel="noopener"
        :title="b.label === 'Blog post' ? b.href : undefined"
        @click.stop
      >
        {{ b.label }}
      </Badge>
      <Badge v-else :variant="b.variant">{{ b.label }}</Badge>
    </template>
  </template>
  <span v-else class="text-muted-foreground">-</span>
</template>
