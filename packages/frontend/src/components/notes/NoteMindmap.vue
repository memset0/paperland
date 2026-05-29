<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useNotesStore } from '@/stores/notes'
import { useWindowsStore } from '@/stores/windows'
import NoteNode from './NoteNode.vue'
import { Plus, Undo2 } from '@lucide/vue'

// Branching mind-map of the paper's small notes. Connectors are drawn as SVG curves
// measured from real node positions (correct for any subtree height). Drop a node on
// the empty canvas to promote it to top-level.
const props = defineProps<{ paperId: number }>()
const store = useNotesStore()
const windows = useWindowsStore()

const canvasRef = ref<HTMLElement | null>(null)
const edges = ref<string[]>([])
const svgW = ref(0)
const svgH = ref(0)
let ro: ResizeObserver | null = null

/** Recompute parent→child connector paths from current DOM positions. */
function recompute() {
  const canvas = canvasRef.value
  if (!canvas) { edges.value = []; return }
  const crect = canvas.getBoundingClientRect()
  const sl = canvas.scrollLeft
  const st = canvas.scrollTop
  const paths: string[] = []
  for (const n of store.notes) {
    if (n.parent_id == null) continue
    const childEl = canvas.querySelector<HTMLElement>(`[data-nid="${n.id}"]`)
    const parentEl = canvas.querySelector<HTMLElement>(`[data-nid="${n.parent_id}"]`)
    if (!childEl || !parentEl) continue
    const pr = parentEl.getBoundingClientRect()
    const cr = childEl.getBoundingClientRect()
    const px = pr.right - crect.left + sl
    const py = pr.top + pr.height / 2 - crect.top + st
    const cx = cr.left - crect.left + sl
    const cy = cr.top + cr.height / 2 - crect.top + st
    const mx = px + Math.max(12, (cx - px) / 2)
    paths.push(`M ${px} ${py} C ${mx} ${py} ${mx} ${cy} ${cx} ${cy}`)
  }
  edges.value = paths
  svgW.value = canvas.scrollWidth
  svgH.value = canvas.scrollHeight
}

function scheduleRecompute() {
  nextTick(recompute)
}

onMounted(() => {
  scheduleRecompute()
  if (canvasRef.value) {
    ro = new ResizeObserver(() => recompute())
    ro.observe(canvasRef.value)
  }
})
onUnmounted(() => ro?.disconnect())

// Recompute when the tree changes (add / delete / move / rename) once the DOM settles.
watch(() => store.notes, scheduleRecompute, { deep: true })

async function addRoot() {
  const n = await store.createNote({ title: 'Untitled' })
  if (n) windows.open({ kind: 'note', paperId: props.paperId, noteId: n.id, title: 'Untitled' })
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <div class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes ({{ store.notes.length }})</div>
      <div class="flex items-center gap-2">
        <button
          v-if="store.moveHistory.length"
          class="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
          :title="`Undo last move (${store.moveHistory.length})`"
          @click="store.undoMove()"
        >
          <Undo2 class="h-3 w-3" /> Undo
        </button>
        <button class="text-xs text-primary hover:underline inline-flex items-center gap-0.5" @click="addRoot">
          <Plus class="h-3 w-3" /> Note
        </button>
      </div>
    </div>
    <div ref="canvasRef" class="mm-canvas">
      <svg class="mm-links" :width="svgW" :height="svgH" :viewBox="`0 0 ${svgW} ${svgH}`">
        <path v-for="(d, i) in edges" :key="i" :d="d" fill="none" stroke="var(--border)" stroke-width="1.5" />
      </svg>
      <div class="mm-nodes">
        <NoteNode v-for="n in store.tree" :key="n.id" :node="n" :paper-id="paperId" />
        <p v-if="!store.tree.length" class="text-sm text-muted-foreground py-2">No notes yet. Click "Note" to add one.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mm-canvas {
  position: relative;
  overflow-x: auto;
  padding: 8px;
  min-height: 44px;
  border-radius: 8px;
}
.mm-links { position: absolute; top: 0; left: 0; pointer-events: none; z-index: 0; }
.mm-nodes { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 10px; width: max-content; }
</style>
