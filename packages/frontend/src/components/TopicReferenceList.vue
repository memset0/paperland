<script setup lang="ts">
import { ref } from 'vue'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Check, Download, ExternalLink, Loader2, ChevronDown } from '@lucide/vue'
import type { TopicDetail, TopicPaper } from '@paperland/shared'
import { s2Url, normalizeCiteId } from '@/lib/cite-links'
import MarkdownContent from '@/components/MarkdownContent.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

defineProps<{ detail: TopicDetail; entries: TopicPaper[]; busy: string; imported: Set<string>; compact?: boolean }>()
defineEmits<{ import: [entryId: string] }>()
const openNotes = ref<Record<string, boolean>>({})
const externalUrl = (id: string) => s2Url(normalizeCiteId(id) ?? id)
</script>

<template>
  <div class="space-y-3">
    <article v-for="entry in entries" :key="entry.id" :data-topic-entry="entry.id" :data-reference-number="detail.reference_numbers[entry.id]" tabindex="-1" class="min-w-0 rounded-lg border bg-card p-3.5 focus:outline-none focus:ring-2 focus:ring-primary/30">
      <div class="flex items-start gap-2.5">
        <span class="mt-0.5 shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-primary">[{{ detail.reference_numbers[entry.id] }}]</span>
        <div class="min-w-0 flex-1 break-words">
          <RouterLink v-if="detail.paper_bindings[entry.id]" :to="`/papers/${detail.paper_bindings[entry.id]}`" class="text-sm font-medium leading-relaxed hover:text-primary">{{ entry.title }}</RouterLink>
          <a v-else-if="entry.s2_id" :href="externalUrl(entry.s2_id)" target="_blank" rel="noopener noreferrer" class="text-sm font-medium leading-relaxed hover:text-primary">{{ entry.title }}<ExternalLink class="ml-1 inline size-3 text-muted-foreground" /></a>
          <a v-else-if="entry.url" :href="entry.url" target="_blank" rel="noopener noreferrer" class="text-sm font-medium leading-relaxed hover:text-primary">{{ entry.title }}<ExternalLink class="ml-1 inline size-3 text-muted-foreground" /></a>
          <p v-else class="text-sm font-medium leading-relaxed">{{ entry.title }}<Badge variant="outline" class="ml-2">Paper unavailable</Badge></p>
          <p v-if="entry.authors?.length || entry.year" class="mt-1 text-xs leading-relaxed text-muted-foreground">{{ entry.authors?.slice(0, 3).join(', ') }}<template v-if="entry.authors?.length && entry.year"> · </template>{{ entry.year }}</p>
          <Badge v-if="entry.verification === 'unverified'" variant="outline" class="mt-2">Unverified</Badge>
        </div>
      </div>
      <Collapsible v-if="entry.comment || entry.citation" :open="openNotes[entry.id] ?? !compact" class="mt-3" @update:open="openNotes[entry.id] = $event">
        <CollapsibleTrigger class="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><ChevronDown :class="['size-3 transition-transform', (openNotes[entry.id] ?? !compact) ? 'rotate-0' : '-rotate-90']" />Notes and details</CollapsibleTrigger>
        <CollapsibleContent class="mt-3 space-y-3">
          <p v-if="entry.url && entry.citation" class="text-xs leading-relaxed text-muted-foreground">{{ [entry.citation.author?.join(', '), entry.citation.year, entry.citation.month, entry.citation.howpublished, entry.citation.note].filter(Boolean).join(' · ') }}</p>
          <MarkdownContent v-if="entry.comment" :content="entry.comment" disable-highlights qa-answer class="text-xs" />

        </CollapsibleContent>
      </Collapsible>
          <div v-if="detail.paper_importable?.[entry.id] ?? !!entry.s2_id" class="mt-3 flex flex-wrap items-center justify-between gap-2">
            <a v-if="entry.s2_id" :href="externalUrl(entry.s2_id)" target="_blank" rel="noopener noreferrer" class="text-[11px] text-muted-foreground hover:text-primary">Semantic Scholar <ExternalLink class="inline size-2.5" /></a>
            <a v-else-if="entry.url" :href="entry.url" target="_blank" rel="noopener noreferrer" class="text-[11px] text-muted-foreground hover:text-primary">Source <ExternalLink class="inline size-2.5" /></a>
            <Button variant="ghost" size="xs" :disabled="!!busy || imported.has(entry.id) || detail.paper_in_library[entry.id]" @click="$emit('import', entry.id)"><Loader2 v-if="busy === `import:${entry.id}`" class="animate-spin" /><Check v-else-if="imported.has(entry.id) || detail.paper_in_library[entry.id]" /><Download v-else />{{ imported.has(entry.id) || detail.paper_in_library[entry.id] ? 'Added to my list' : detail.paper_bindings[entry.id] ? 'Add to my list' : 'Import paper' }}</Button>
          </div>
    </article>
  </div>
</template>
