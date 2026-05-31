<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useNotesStore } from '@/stores/notes'
import { leadingBlockquotes } from '@/lib/markdown-doc'
import type { NoteSection } from '@paperland/shared'
import NoteNode, { type MindNode, CENTER_ID } from './NoteNode.vue'
import { Undo2 } from '@lucide/vue'

// Branching mind-map DERIVED from the note document's heading structure. The center node is the
// paper (its content is the preamble); every heading becomes a node by relative depth. Connectors
// are SVG curves measured from real DOM positions. Editing happens in floating windows (tap a
// node) or by dragging to restructure (which rewrites the document's headings).
defineProps<{ paperId: number }>()
const store = useNotesStore()

const innerRef = ref<HTMLElement | null>(null)
const edges = ref<{ d: string; content: boolean }[]>([])
let ro: ResizeObserver | null = null

// Read-only content nodes derived from a node's leading blockquotes; sorted BEFORE heading children.
function contentNodes(parentId: string, content: string): MindNode[] {
  return leadingBlockquotes(content).map((bq, i) => ({
    id: `${parentId}#c${i}`, label: '', count: 0, isCenter: false, isContent: true, content: bq, children: [],
  }))
}
function toMind(s: NoteSection): MindNode {
  return {
    id: s.id,
    label: s.heading || '(untitled)',
    count: s.leafBody.trim().length,
    isCenter: false,
    children: [...contentNodes(s.id, s.leafBody), ...s.children.map(toMind)],
  }
}
const root = computed<MindNode>(() => ({
  id: CENTER_ID,
  label: '(root)',
  count: store.tree.preamble.trim().length,
  isCenter: true,
  children: [...contentNodes(CENTER_ID, store.tree.preamble), ...store.tree.sections.map(toMind)],
}))

/** Flatten parent→child id pairs (center → top-level, section → children) for connectors. */
const edgePairs = computed<[string, string][]>(() => {
  const pairs: [string, string][] = []
  const walk = (n: MindNode) => { for (const c of n.children) { pairs.push([n.id, c.id]); walk(c) } }
  walk(root.value)
  return pairs
})

function recompute() {
  const inner = innerRef.value
  if (!inner) { edges.value = []; return }
  const irect = inner.getBoundingClientRect()
  const paths: { d: string; content: boolean }[] = []
  for (const [pid, cid] of edgePairs.value) {
    const parentEl = inner.querySelector<HTMLElement>(`[data-nid="${cssEscape(pid)}"]`)
    const childEl = inner.querySelector<HTMLElement>(`[data-nid="${cssEscape(cid)}"]`)
    if (!parentEl || !childEl) continue
    const pr = parentEl.getBoundingClientRect()
    const cr = childEl.getBoundingClientRect()
    const px = pr.right - irect.left
    const py = pr.top + pr.height / 2 - irect.top
    const cx = cr.left - irect.left
    const cy = cr.top + cr.height / 2 - irect.top
    const mx = px + Math.max(12, (cx - px) / 2)
    // Connectors to content nodes (synthetic ids contain '#') are as thin as the border.
    paths.push({ d: `M ${px} ${py} C ${mx} ${py} ${mx} ${cy} ${cx} ${cy}`, content: cid.includes('#') })
  }
  edges.value = paths
}

/** Escape a data-nid value (section ids contain dots) for use inside an attribute selector. */
function cssEscape(s: string): string {
  return s.replace(/["\\]/g, '\\$&')
}

function scheduleRecompute() { nextTick(recompute) }

onMounted(() => {
  scheduleRecompute()
  if (innerRef.value) {
    ro = new ResizeObserver(() => recompute())
    ro.observe(innerRef.value)
  }
})
onUnmounted(() => ro?.disconnect())

watch(() => store.body, scheduleRecompute)
</script>

<template>
  <div class="space-y-2">
    <div v-if="store.canUndo" class="flex items-center justify-end">
      <button
        class="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
        :title="`Undo last structural change (${store.undoStack.length})`"
        @click="store.undo()"
      >
        <Undo2 class="h-3 w-3" /> Undo
      </button>
    </div>
    <div class="mm-canvas">
      <div ref="innerRef" class="mm-inner">
        <svg class="mm-links">
          <path v-for="(e, i) in edges" :key="i" :d="e.d" fill="none" stroke="var(--border)" :stroke-width="e.content ? 1 : 1.5" />
        </svg>
        <div class="mm-nodes">
          <NoteNode :node="root" :paper-id="paperId" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mm-canvas { overflow-x: auto; overflow-y: hidden; padding: 8px; border-radius: 8px; }
.mm-inner { position: relative; width: max-content; min-width: 100%; }
.mm-links { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; overflow: visible; }
.mm-nodes { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 10px; }
</style>
