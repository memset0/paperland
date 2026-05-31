<script setup lang="ts">
import { computed } from 'vue'
import { useNotesStore, type PanelMode } from '@/stores/notes'
import { useWindowsStore } from '@/stores/windows'
import type { NoteSection } from '@paperland/shared'
import MarkdownContent from '@/components/MarkdownContent.vue'
import { Pencil, Eye, Columns } from '@lucide/vue'

// The left-panel note view over the single document, with three modes:
//  - render (default): reading-oriented, auto-numbered, clickable headings → floating editor;
//  - edit: a Markdown editor over the whole document (free-form, can restructure);
//  - split: editor + render side by side.
// Entering edit/split closes floating windows (mutually-exclusive editing contexts).
const store = useNotesStore()
const windows = useWindowsStore()

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
  walk(store.tree.sections, 0, '')
  return out
})
const isEmpty = computed(() => store.tree.preamble.trim() === '' && items.value.length === 0)

const bodyModel = computed({ get: () => store.body, set: (v: string) => store.setBody(v) })

// Last persisted update time of the note (reflects the most recent successful save).
const lastUpdated = computed(() => {
  const iso = store.noteRow?.updated_at
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString()
})

function setMode(m: PanelMode) { store.setPanelMode(m) }
function openSection(it: WItem) {
  const paperId = store.currentPaperId
  if (paperId == null) return
  windows.open({ paperId, sectionId: it.id, title: it.heading })
}

const modes: { value: PanelMode; icon: typeof Pencil; label: string }[] = [
  { value: 'edit', icon: Pencil, label: 'Edit' },
  { value: 'split', icon: Columns, label: 'Split' },
  { value: 'render', icon: Eye, label: 'Render' },
]
</script>

<template>
  <div class="h-full flex flex-col bg-background">
    <div class="flex items-center justify-between gap-2 px-3 py-1.5 border-b shrink-0">
      <span class="min-w-0 truncate text-xs text-muted-foreground">
        <template v-if="lastUpdated">Last updated at: {{ lastUpdated }}</template>
      </span>
      <div class="flex items-center rounded border overflow-hidden shrink-0">
        <button
          v-for="m in modes" :key="m.value"
          class="px-2 py-0.5 inline-flex items-center gap-1 text-xs"
          :class="store.panelMode === m.value ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'"
          :title="m.label"
          @click="setMode(m.value)"
        >
          <component :is="m.icon" class="h-3 w-3" /> {{ m.label }}
        </button>
      </div>
    </div>

    <div class="flex-1 min-h-0 flex">
      <!-- Editor (edit + split) -->
      <textarea
        v-if="store.panelMode !== 'render'"
        v-model="bodyModel"
        class="min-w-0 resize-none p-4 text-sm font-mono outline-none bg-transparent overflow-y-auto"
        :class="store.panelMode === 'split' ? 'w-1/2 border-r' : 'w-full'"
        placeholder="Write your note in Markdown. Headings define the mind-map structure…"
      />

      <!-- Render (render + split) -->
      <div
        v-if="store.panelMode !== 'edit'"
        class="min-w-0 overflow-y-auto"
        :class="store.panelMode === 'split' ? 'w-1/2' : 'w-full'"
      >
        <div v-if="isEmpty" class="flex h-full items-center justify-center text-sm text-muted-foreground py-16">
          No notes yet
        </div>
        <div v-else class="nw-content mx-auto max-w-3xl px-6 py-5">
          <MarkdownContent v-if="store.tree.preamble.trim()" :content="store.tree.preamble" :disable-highlights="true" />
          <template v-for="it in items" :key="it.id">
            <component :is="'h' + it.level" class="wt-heading" :title="'Edit: ' + it.heading" @click="openSection(it)">
              <span class="wt-num">{{ it.number }}</span>
              <span class="wt-title">{{ it.heading }}</span>
              <Pencil class="wt-edit" />
            </component>
            <MarkdownContent v-if="it.body.trim()" :content="it.body" :disable-highlights="true" />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nw-content { font-size: 0.9rem; line-height: 1.75; }
.wt-heading { cursor: pointer; font-weight: 600; scroll-margin-top: 8px; }
.nw-content h2.wt-heading, .nw-content :deep(.markdown-content h2) { font-size: 1.7rem; font-weight: 700; margin: 1.1em 0 0.5em; }
.nw-content h3.wt-heading, .nw-content :deep(.markdown-content h3) { font-size: 1.45rem; font-weight: 600; margin: 0.9em 0 0.4em; }
.nw-content h4.wt-heading, .nw-content :deep(.markdown-content h4) { font-size: 1.28rem; font-weight: 600; margin: 0.8em 0 0.35em; }
.nw-content h5.wt-heading, .nw-content :deep(.markdown-content h5) { font-size: 1.15rem; font-weight: 600; margin: 0.7em 0 0.3em; }
.nw-content h6.wt-heading, .nw-content :deep(.markdown-content h6) { font-size: 1.05rem; font-weight: 600; margin: 0.6em 0 0.3em; }
.wt-num { font-variant-numeric: tabular-nums; margin-right: 0.4em; }
.wt-heading:hover .wt-title { text-decoration: underline; text-underline-offset: 3px; }
.wt-edit { display: inline-block; width: 0.7em; height: 0.7em; margin-left: 0.35em; vertical-align: middle; color: var(--muted-foreground); }
</style>
