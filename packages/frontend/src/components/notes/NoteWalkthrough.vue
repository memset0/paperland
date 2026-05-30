<script setup lang="ts">
import { computed } from 'vue'
import { useNotesStore, flattenWalkthrough, type WalkthroughSection } from '@/stores/notes'
import { useWindowsStore } from '@/stores/windows'
import MarkdownContent from '@/components/MarkdownContent.vue'
import { Pencil } from '@lucide/vue'

// Read-only "walkthrough" of the whole notes tree: each note becomes an auto-numbered,
// clickable heading (clicking opens that note's editor) followed by its body rendered as
// Markdown with highlighting disabled. Headings the user typed inside a note body are also
// numbered (by `flattenWalkthrough`) but are plain rendered Markdown — not clickable.
// Derived from the store's reactive `tree`, so it re-assembles and re-renders automatically
// as notes are edited or reparented/reordered.
const store = useNotesStore()
const windows = useWindowsStore()
const sections = computed(() => flattenWalkthrough(store.tree))
const isEmpty = computed(() => sections.value.length === 0)

// Click a heading → open that note's floating editor (same window model as the mind-map).
function openNote(s: WalkthroughSection) {
  const paperId = store.currentPaperId
  if (paperId == null) return
  windows.open({ kind: 'note', paperId, noteId: s.noteId, title: s.title })
}
</script>

<template>
  <div class="h-full overflow-y-auto bg-background">
    <div v-if="isEmpty" class="flex h-full items-center justify-center text-sm text-muted-foreground">
      No notes yet
    </div>
    <div v-else class="nw-content mx-auto max-w-3xl px-6 py-5">
      <template v-for="(s, i) in sections" :key="s.noteId + ':' + i">
        <!-- Root: heading-less intro body. -->
        <MarkdownContent v-if="s.isRoot" :content="s.body" :disable-highlights="true" />
        <template v-else>
          <component
            :is="'h' + s.level"
            class="wt-heading"
            :title="'Edit: ' + s.title"
            @click="openNote(s)"
          >
            <span class="wt-num">{{ s.number }}</span>
            <span class="wt-title">{{ s.title }}</span>
            <Pencil class="wt-edit" />
          </component>
          <MarkdownContent v-if="s.body.trim()" :content="s.body" :disable-highlights="true" />
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
/*
 * Reading view. Body runs at a compact reading size (0.9rem); the auto-numbered note
 * headings are sized in absolute rem so they stay constant regardless of the body size
 * and read clearly above it, decreasing across depths. Scoped to this view only — note
 * bodies render via MarkdownContent (highlights disabled), unaffected elsewhere.
 */
.nw-content { font-size: 0.9rem; line-height: 1.75; }

/* Block heading with inline children, so the number, title and edit icon flow as one
   text run and wrap together (not just the title). */
.wt-heading {
  cursor: pointer;
  font-weight: 600;
  scroll-margin-top: 8px;
}
/* Note-title headings (clickable) and body headings (rendered by MarkdownContent, not
   clickable) share the same per-level sizes so the outline reads consistently. */
.nw-content h2.wt-heading, .nw-content :deep(.markdown-content h2) { font-size: 1.7rem; font-weight: 700; margin: 1.1em 0 0.5em; }
.nw-content h3.wt-heading, .nw-content :deep(.markdown-content h3) { font-size: 1.45rem; font-weight: 600; margin: 0.9em 0 0.4em; }
.nw-content h4.wt-heading, .nw-content :deep(.markdown-content h4) { font-size: 1.28rem; font-weight: 600; margin: 0.8em 0 0.35em; }
.nw-content h5.wt-heading, .nw-content :deep(.markdown-content h5) { font-size: 1.15rem; font-weight: 600; margin: 0.7em 0 0.3em; }
.nw-content h6.wt-heading, .nw-content :deep(.markdown-content h6) { font-size: 1.05rem; font-weight: 600; margin: 0.6em 0 0.3em; }

.wt-num { font-variant-numeric: tabular-nums; margin-right: 0.4em; } /* inherits the heading color (not muted) */
.wt-heading:hover .wt-title { text-decoration: underline; text-underline-offset: 3px; }
/* The edit icon stays visible (persistent), and flows inline at the end of the title
   text so it wraps with the title rather than sitting in a fixed column. */
.wt-edit {
  display: inline-block;
  width: 0.7em; height: 0.7em;
  margin-left: 0.35em;
  vertical-align: middle;
  color: var(--muted-foreground);
}
</style>
