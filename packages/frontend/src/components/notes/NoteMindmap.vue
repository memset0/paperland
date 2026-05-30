<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useNotesStore } from '@/stores/notes'
import NoteNode from './NoteNode.vue'
import { Undo2 } from '@lucide/vue'

// Branching mind-map of the paper's notes, rooted at the (lazily-created) root note.
// Connectors are drawn as SVG curves measured from real node positions (correct for any
// subtree height). The canvas scrolls horizontally when the tree is wider than the card;
// vertically it just grows. Drop a node on the empty canvas to reparent it under the root.
// New notes are added from the "+" on each node (the root node included), not a toolbar button.
defineProps<{ paperId: number }>()
const store = useNotesStore()

const innerRef = ref<HTMLElement | null>(null)
const edges = ref<string[]>([])
let ro: ResizeObserver | null = null

/** Recompute parent→child connector paths from current DOM positions (in `.mm-inner` space). */
function recompute() {
  const inner = innerRef.value
  if (!inner) { edges.value = []; return }
  const irect = inner.getBoundingClientRect()
  const paths: string[] = []
  for (const n of store.notes) {
    if (n.parent_id == null) continue
    const childEl = inner.querySelector<HTMLElement>(`[data-nid="${n.id}"]`)
    const parentEl = inner.querySelector<HTMLElement>(`[data-nid="${n.parent_id}"]`)
    if (!childEl || !parentEl) continue
    const pr = parentEl.getBoundingClientRect()
    const cr = childEl.getBoundingClientRect()
    const px = pr.right - irect.left
    const py = pr.top + pr.height / 2 - irect.top
    const cx = cr.left - irect.left
    const cy = cr.top + cr.height / 2 - irect.top
    const mx = px + Math.max(12, (cx - px) / 2)
    paths.push(`M ${px} ${py} C ${mx} ${py} ${mx} ${cy} ${cx} ${cy}`)
  }
  edges.value = paths
}

function scheduleRecompute() {
  nextTick(recompute)
}

onMounted(() => {
  scheduleRecompute()
  if (innerRef.value) {
    ro = new ResizeObserver(() => recompute())
    ro.observe(innerRef.value)
  }
})
onUnmounted(() => ro?.disconnect())

// Recompute when the tree changes (add / delete / move / rename) once the DOM settles.
watch(() => store.notes, scheduleRecompute, { deep: true })
</script>

<template>
  <div class="space-y-2">
    <div v-if="store.moveHistory.length" class="flex items-center justify-end">
      <button
        class="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
        :title="`Undo last move (${store.moveHistory.length})`"
        @click="store.undoMove()"
      >
        <Undo2 class="h-3 w-3" /> Undo
      </button>
    </div>
    <div class="mm-canvas">
      <div ref="innerRef" class="mm-inner">
        <svg class="mm-links">
          <path v-for="(d, i) in edges" :key="i" :d="d" fill="none" stroke="var(--border)" stroke-width="1.5" />
        </svg>
        <div class="mm-nodes">
          <NoteNode :node="store.tree" :paper-id="paperId" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mm-canvas {
  /* Horizontal scroll only when the tree is wider than the card; vertical just grows
     (height is auto and driven by .mm-inner, which is in flow). overflow-y is set
     explicitly so overflow-x:auto doesn't coerce it into a spurious scrollbar. */
  overflow-x: auto;
  overflow-y: hidden;
  padding: 8px;
  border-radius: 8px;
}
.mm-inner {
  position: relative;
  width: max-content;   /* sizes to the tree's natural width */
  min-width: 100%;      /* but fills the card when the tree is narrow (no spurious scroll) */
}
/* The SVG overlays .mm-inner exactly (CSS 100%, no JS sizing, no viewBox), so paths are
   drawn in pixel space and never extend past the content. */
.mm-links { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; overflow: visible; }
.mm-nodes { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 10px; }
</style>
