<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ResearchCitation, S2ResolveResult } from '@paperland/shared'
import { ChevronRight, ExternalLink, Library, Loader2 } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import MarkdownContent from './MarkdownContent.vue'
import { useS2Paper, s2PaperUrl } from '@/composables/useS2Papers'

/** One paper row: a normalized S2 id (see `lib/cite-links.ts`), optional fallback text and comment. */
export interface PaperRefItem {
  kind?: 'paper'
  id: string
  fallback_text?: string
  /** Markdown; may contain `#cite:` links. */
  comment?: string
  /** The id did not resolve when the list was produced (Deep Research). */
  unverified?: boolean
  /** New compared with the previous version (Deep Research). */
  added?: boolean
}

/** A non-paper source (blog post, docs…) with a BibTeX @misc-style citation. */
export interface LinkRefItem {
  kind: 'link'
  url: string
  citation: ResearchCitation
  comment?: string
  added?: boolean
}

export type RefItem = PaperRefItem | LinkRefItem

export interface PaperRefSection {
  title: string
  /** Markdown; may contain `#cite:` links. */
  description?: string
  items: RefItem[]
  /** Items dropped from this section since the previous version (shown collapsed). */
  removed?: RefItem[]
}

const props = defineProps<{
  items?: RefItem[]
  sections?: PaperRefSection[]
}>()

// Flat items render as one untitled section; sections render with their titles.
const groups = computed<Array<{ title: string | null; description?: string; items: RefItem[]; removed: RefItem[] }>>(() =>
  props.sections?.length
    ? props.sections.map((s) => ({ title: s.title, description: s.description, items: s.items, removed: s.removed ?? [] }))
    : [{ title: null, items: props.items ?? [], removed: [] }],
)

function isLink(item: RefItem): item is LinkRefItem {
  return item.kind === 'link'
}

function keyOf(item: RefItem): string {
  return isLink(item) ? `link:${item.url}` : `paper:${item.id}`
}

// One shared resolver ref per paper id (requests are coalesced by useS2Paper).
const resolved = computed(() => {
  const map = new Map<string, { value: S2ResolveResult | null }>()
  for (const group of groups.value) {
    for (const item of [...group.items, ...group.removed]) {
      if (!isLink(item) && !map.has(item.id)) map.set(item.id, useS2Paper(item.id))
    }
  }
  return map
})

function resultOf(id: string): S2ResolveResult | null {
  return resolved.value.get(id)?.value ?? null
}

function authorsLabel(authors: string[]): string {
  return authors.length <= 3 ? authors.join(', ') : `${authors.slice(0, 3).join(', ')} et al.`
}

function siteOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

/** "Jane Doe, John Roe · 2024 · Example Blog" (falls back to the site domain). */
function citationMeta(link: LinkRefItem): string {
  const c = link.citation
  const parts: string[] = []
  if (c.author?.length) parts.push(authorsLabel(c.author))
  if (c.year) parts.push(c.month ? `${c.month} ${c.year}` : String(c.year))
  parts.push(c.howpublished || siteOf(link.url))
  if (c.note) parts.push(c.note)
  return parts.join(' · ')
}

const removedOpen = ref<Record<number, boolean>>({})
</script>

<template>
  <div class="paper-ref-list space-y-3">
    <section v-for="(group, gi) in groups" :key="gi">
      <h4 v-if="group.title" class="mb-1 text-sm font-semibold">{{ group.title }}</h4>
      <MarkdownContent v-if="group.description" :content="group.description" qa-answer disable-highlights class="mb-1.5 text-xs text-muted-foreground" />
      <ul v-if="group.items.length" class="divide-y rounded-md border">
        <li v-for="item in group.items" :key="keyOf(item)" class="px-3 py-2">
          <!-- Non-paper link -->
          <template v-if="isLink(item)">
            <div class="flex items-start gap-1.5">
              <a :href="item.url" target="_blank" rel="noopener noreferrer" class="text-sm font-medium hover:underline">{{ item.citation.title }}</a>
              <span class="ml-auto flex shrink-0 items-center gap-1">
                <Badge v-if="item.added" class="h-5 px-1.5 text-[10px]">New</Badge>
                <Badge variant="outline" class="h-5 px-1.5 text-[10px]">Link</Badge>
                <a :href="item.url" target="_blank" rel="noopener noreferrer" class="text-muted-foreground hover:text-foreground" title="Open link">
                  <ExternalLink class="h-3.5 w-3.5" />
                </a>
              </span>
            </div>
            <div class="mt-0.5 text-xs text-muted-foreground">{{ citationMeta(item) }}</div>
          </template>

          <!-- Paper (metadata resolved from S2 by id) -->
          <template v-else>
          <template v-for="r in [resultOf(item.id)]" :key="item.id">
            <div class="flex items-start gap-1.5">
              <RouterLink
                v-if="r?.library_paper_id"
                :to="`/papers/${r.library_paper_id}`"
                class="text-sm font-medium text-primary hover:underline"
              >{{ r.paper?.title || item.fallback_text || item.id }}</RouterLink>
              <a
                v-else
                :href="s2PaperUrl(item.id)"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm font-medium hover:underline"
                :class="item.unverified && r?.status !== 'resolved' ? 'font-mono text-xs' : ''"
              >{{ r?.paper?.title || item.fallback_text || item.id }}</a>
              <Loader2 v-if="!r" class="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
              <span class="ml-auto flex shrink-0 items-center gap-1">
                <Badge v-if="item.added" class="h-5 px-1.5 text-[10px]">New</Badge>
                <Badge v-if="r?.library_paper_id" variant="secondary" class="h-5 gap-1 px-1.5 text-[10px]">
                  <Library class="h-3 w-3" />In library
                </Badge>
                <Badge
                  v-else-if="item.unverified && r?.status !== 'resolved'"
                  variant="outline" class="h-5 border-amber-500/50 px-1.5 text-[10px] text-amber-700 dark:text-amber-400"
                  title="Semantic Scholar does not know this id"
                >Unverified</Badge>
                <Badge v-else-if="r?.status === 'not_found'" variant="outline" class="h-5 px-1.5 text-[10px]">Not found</Badge>
                <Badge v-else-if="r && r.status !== 'resolved'" variant="outline" class="h-5 px-1.5 text-[10px]">Unavailable</Badge>
                <a
                  :href="s2PaperUrl(item.id)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-muted-foreground hover:text-foreground"
                  title="Open in Semantic Scholar"
                ><ExternalLink class="h-3.5 w-3.5" /></a>
              </span>
            </div>
            <div v-if="r?.paper" class="mt-0.5 text-xs text-muted-foreground">
              <span v-if="r.paper.authors.length">{{ authorsLabel(r.paper.authors) }}</span>
              <span v-if="r.paper.year"> · {{ r.paper.year }}</span>
              <span v-if="r.paper.venue"> · {{ r.paper.venue }}</span>
              <span v-if="r.paper.citation_count != null"> · {{ r.paper.citation_count }} citations</span>
            </div>
          </template>
          </template>

          <MarkdownContent v-if="item.comment" :content="item.comment" qa-answer disable-highlights class="mt-1 text-xs leading-relaxed" />
        </li>
      </ul>
      <p v-else-if="group.title" class="text-xs text-muted-foreground">No items</p>

      <!-- Dropped since the previous version -->
      <div v-if="group.removed.length" class="mt-1.5">
        <button
          type="button"
          class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          @click="removedOpen[gi] = !removedOpen[gi]"
        >
          <ChevronRight class="size-3.5 transition-transform" :class="removedOpen[gi] ? 'rotate-90' : ''" />
          Removed · {{ group.removed.length }}
        </button>
        <ul v-if="removedOpen[gi]" class="mt-1 divide-y rounded-md border border-dashed opacity-70">
          <li v-for="item in group.removed" :key="keyOf(item)" class="px-3 py-1.5 text-xs line-through decoration-muted-foreground/50">
            <template v-if="isLink(item)">{{ item.citation.title }}</template>
            <template v-else>{{ resultOf(item.id)?.paper?.title || item.fallback_text || item.id }}</template>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
