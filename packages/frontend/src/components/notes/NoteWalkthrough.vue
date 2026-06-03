<script setup lang="ts">
import { computed, ref } from 'vue'
import { useNotesStore, type PanelMode } from '@/stores/notes'
import { useWindowsStore } from '@/stores/windows'
import type { NoteSection } from '@paperland/shared'
import MarkdownContent from '@/components/MarkdownContent.vue'
import MonacoMarkdownEditor from '@/components/notes/MonacoMarkdownEditor.vue'
import NoteHelpDialog from './NoteHelpDialog.vue'
import PublicNotesPanel from './PublicNotesPanel.vue'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'vue-sonner'
import { Pencil, Eye, Columns, ExternalLink, CircleHelp, Circle, CircleCheck, Globe, Lock, Link2 } from '@lucide/vue'

// The left-panel note view over the single document, with three modes:
//  - render (default): reading-oriented, auto-numbered, clickable headings → floating editor;
//  - edit: a Markdown editor over the whole document (free-form, can restructure);
//  - split: editor + render side by side.
// Entering edit/split closes floating windows (mutually-exclusive editing contexts).
const store = useNotesStore()
const windows = useWindowsStore()
const auth = useAuthStore()
const helpOpen = ref(false)

// The publish / copy-link controls show only for the OWNER of a non-empty note (their own note
// row). Anonymous / other viewers see the read-only Note tab without these controls.
const isOwner = computed(() => store.noteRow != null && auth.user != null && store.noteRow.user_id === auth.user.id)
const canPublish = computed(() => isOwner.value && store.noteCount > 0)

async function togglePublic() { await store.setPublic(!store.isPublic) }
async function copyShareLink() {
  if (!store.shareLink) return
  try {
    await navigator.clipboard.writeText(store.shareLink)
    toast.success('Note link copied', { position: 'bottom-center' })
  } catch {
    toast.error('Copy failed')
  }
}

// While the whole-document floating editor is open, the panel is locked to render.
const locked = computed(() => store.docWindowOpen)
const activeMode = computed<PanelMode>(() => (locked.value ? 'render' : store.panelMode))

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

function setMode(m: PanelMode) { if (locked.value && m !== 'render') return; store.setPanelMode(m) }
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
      <div class="flex items-center gap-2 min-w-0">
        <!-- Reading status: In progress / Done (Done disabled when the note is empty). -->
        <div class="flex items-center rounded border overflow-hidden shrink-0">
          <button
            class="px-1.5 py-0.5 inline-flex items-center"
            :class="!store.completed ? 'bg-accent text-accent-foreground' : 'hover:bg-muted text-muted-foreground'"
            title="In progress"
            @click="store.toggleCompleted(false)"
          >
            <Circle class="h-3 w-3" />
          </button>
          <button
            class="px-1.5 py-0.5 inline-flex items-center"
            :class="[
              store.completed ? 'bg-accent text-accent-foreground' : 'hover:bg-muted text-muted-foreground',
              store.noteCount === 0 ? 'opacity-40 cursor-not-allowed' : '',
            ]"
            :disabled="store.noteCount === 0"
            title="Mark reading done"
            @click="store.toggleCompleted(true)"
          >
            <CircleCheck class="h-3 w-3" />
          </button>
        </div>
        <span class="min-w-0 truncate text-xs text-muted-foreground">
          <template v-if="lastUpdated">Last updated at: {{ lastUpdated }}</template>
        </span>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <!-- Owner-only: publish / unpublish + copy share link (visible once the note is non-empty). -->
        <button
          v-if="canPublish"
          class="px-2 py-0.5 inline-flex items-center gap-1 text-xs rounded border hover:bg-muted"
          :class="store.isPublic ? 'text-primary' : 'text-muted-foreground'"
          :title="store.isPublic ? 'Public — click to make private' : 'Private — click to publish'"
          @click="togglePublic"
        >
          <component :is="store.isPublic ? Globe : Lock" class="h-3 w-3" /> {{ store.isPublic ? 'Public' : 'Private' }}
        </button>
        <button
          v-if="canPublish && store.isPublic"
          class="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Copy note link"
          @click="copyShareLink"
        >
          <Link2 class="h-3.5 w-3.5" />
        </button>
        <button class="p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground" title="Notes help" @click="helpOpen = true">
          <CircleHelp class="h-3.5 w-3.5" />
        </button>
        <button
          class="px-2 py-0.5 inline-flex items-center gap-1 text-xs rounded border hover:bg-muted"
          title="Edit in a floating window"
          @click="store.openDocEditor()"
        >
          <ExternalLink class="h-3 w-3" /> Pop out
        </button>
        <div class="flex items-center rounded border overflow-hidden">
          <button
            v-for="m in modes" :key="m.value"
            class="px-2 py-0.5 inline-flex items-center gap-1 text-xs"
            :class="[
              activeMode === m.value ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
              locked && m.value !== 'render' ? 'opacity-40 cursor-not-allowed' : '',
            ]"
            :disabled="locked && m.value !== 'render'"
            :title="locked && m.value !== 'render' ? 'Locked while the floating editor is open' : m.label"
            @click="setMode(m.value)"
          >
            <component :is="m.icon" class="h-3 w-3" /> {{ m.label }}
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 min-h-0 flex">
      <!-- Editor (edit + split) -->
      <MonacoMarkdownEditor
        v-if="activeMode !== 'render'"
        v-model="bodyModel"
        :class="activeMode === 'split' ? 'w-1/2 border-r' : 'w-full'"
        placeholder="Write your note in Markdown. Headings define the mind-map structure…"
      />

      <!-- Render (render + split) -->
      <div
        v-if="activeMode !== 'edit'"
        class="min-w-0 overflow-y-auto"
        :class="activeMode === 'split' ? 'w-1/2' : 'w-full'"
      >
        <div class="nw-content mx-auto max-w-3xl px-6 py-5">
          <div v-if="isEmpty" class="text-sm text-muted-foreground text-center py-12">No notes yet</div>
          <template v-else>
            <MarkdownContent v-if="store.tree.preamble.trim()" :content="store.tree.preamble" :disable-highlights="true" />
            <template v-for="it in items" :key="it.id">
              <component :is="'h' + it.level" class="wt-heading" :title="'Edit: ' + it.heading" @click="openSection(it)">
                <span class="wt-num">{{ it.number }}</span>
                <span class="wt-title">{{ it.heading }}</span>
                <Pencil class="wt-edit" />
              </component>
              <MarkdownContent v-if="it.body.trim()" :content="it.body" :disable-highlights="true" />
            </template>
          </template>
          <!-- Other users' public notes for this paper (lazy, collapsed by default). -->
          <PublicNotesPanel v-if="store.currentPaperId != null" :paper-id="store.currentPaperId" class="mt-8 pt-4 border-t" />
        </div>
      </div>
    </div>

    <NoteHelpDialog v-model:open="helpOpen" />
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
