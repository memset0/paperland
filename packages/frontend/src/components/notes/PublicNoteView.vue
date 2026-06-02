<script setup lang="ts">
import { computed } from 'vue'
import { parseNoteDoc } from '@/lib/markdown-doc'
import type { NoteSection } from '@paperland/shared'
import MarkdownContent from '@/components/MarkdownContent.vue'
import NoteMindmap from './NoteMindmap.vue'

// Read-only render of ANOTHER user's note: the heading-derived mind-map FIRST, then the full
// document body (preamble + auto-numbered sections, mirroring the walkthrough render). All body
// Markdown renders in public-note mode — PDF anchors stay clickable, Q&A/block anchors are inert.
const props = defineProps<{ body: string; paperId: number }>()

const tree = computed(() => parseNoteDoc(props.body))

interface WItem { id: string; level: number; number: string; heading: string; body: string }
const items = computed<WItem[]>(() => {
  const out: WItem[] = []
  const walk = (nodes: NoteSection[], depth: number, prefix: string) => {
    nodes.forEach((s, i) => {
      const number = `${prefix}${i + 1}.`
      out.push({ id: s.id, level: Math.min(2 + depth, 6), number, heading: s.heading || '(untitled)', body: s.leafBody })
      walk(s.children, depth + 1, number)
    })
  }
  walk(tree.value.sections, 0, '')
  return out
})
const isEmpty = computed(() => tree.value.preamble.trim() === '' && items.value.length === 0)
</script>

<template>
  <div class="pn-view space-y-3">
    <div v-if="isEmpty" class="text-sm text-muted-foreground py-6 text-center">Empty note</div>
    <template v-else>
      <!-- Mind-map first -->
      <NoteMindmap :paper-id="paperId" :doc="tree" :readonly="true" />
      <!-- Then the full body -->
      <div class="pn-content">
        <MarkdownContent v-if="tree.preamble.trim()" :content="tree.preamble" :paper-id="paperId" :disable-highlights="true" :public-note="true" />
        <template v-for="it in items" :key="it.id">
          <component :is="'h' + it.level" class="pn-heading">
            <span class="pn-num">{{ it.number }}</span>
            <span class="pn-title">{{ it.heading }}</span>
          </component>
          <MarkdownContent v-if="it.body.trim()" :content="it.body" :paper-id="paperId" :disable-highlights="true" :public-note="true" />
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.pn-content { font-size: 0.9rem; line-height: 1.7; }
.pn-heading { font-weight: 600; }
.pn-content h2.pn-heading { font-size: 1.4rem; margin: 0.9em 0 0.4em; }
.pn-content h3.pn-heading { font-size: 1.25rem; margin: 0.8em 0 0.35em; }
.pn-content h4.pn-heading { font-size: 1.12rem; margin: 0.7em 0 0.3em; }
.pn-content h5.pn-heading, .pn-content h6.pn-heading { font-size: 1.02rem; margin: 0.6em 0 0.3em; }
.pn-num { font-variant-numeric: tabular-nums; margin-right: 0.4em; color: var(--muted-foreground); }
.pn-title { overflow-wrap: anywhere; }
</style>
