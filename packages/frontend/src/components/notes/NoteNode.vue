<script lang="ts">
export const CENTER_ID = '__center__'

/** View-model for a mind-map node, derived from the note document's heading sections. */
export interface MindNode {
  id: string            // section id, or CENTER_ID for the center/preamble node
  label: string         // heading text (or paper title for the center)
  count: number         // leaf-body character count (preamble length for the center)
  isCenter: boolean
  children: MindNode[]
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { useNotesStore } from '@/stores/notes'
import { useWindowsStore } from '@/stores/windows'
import { noteDrag } from '@/composables/useNoteDrag'
import { Plus, Trash2, CornerDownRight, Pencil } from '@lucide/vue'

// One node in the heading-derived mind-map. A tap opens a floating editor for the node's leaf
// content (the preamble for the center node); a drag re-parents it (rewriting headings). The
// center node is the fixed anchor: it cannot be dragged, given siblings, renamed, or deleted.
const props = defineProps<{ node: MindNode; paperId: number }>()
const store = useNotesStore()
const windows = useWindowsStore()

const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
const isCenter = computed(() => props.node.isCenter)
const label = computed(() => props.node.label || '(untitled)')

function openWindow(sectionId: string | null, title: string) {
  windows.open({ paperId: props.paperId, sectionId, title })
}
function open() {
  openWindow(isCenter.value ? null : props.node.id, label.value)
}
function promptHeading(initial: string): string | null {
  const v = window.prompt('Section name', initial)
  return v == null ? null : (v.trim() || 'New section')
}
async function addChild() {
  const name = promptHeading('New section')
  if (name == null) return
  const id = store.addChild(isCenter.value ? null : props.node.id, name)
  if (id) openWindow(id, name)
}
async function addSibling() {
  const name = promptHeading('New section')
  if (name == null) return
  const id = store.addSibling(props.node.id, name)
  if (id) openWindow(id, name)
}
function rename() {
  const name = window.prompt('Rename section', props.node.label)
  if (name == null) return
  store.rename(props.node.id, name)
}
function countDescendants(n: MindNode): number {
  return n.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0)
}
function del() {
  const d = countDescendants(props.node)
  const msg = d > 0
    ? `Delete "${label.value}" and its ${d} descendant section${d > 1 ? 's' : ''}?`
    : `Delete "${label.value}"?`
  if (!window.confirm(msg)) return
  store.remove(props.node.id)
}

// --- Unified pointer drag (touch + mouse) → structural reparent ---
const DRAG_THRESHOLD = 6
let startX = 0, startY = 0, candidate = false, dragging = false
let captureEl: HTMLElement | null = null

function targetAt(x: number, y: number): { kind: 'node'; id: string } | { kind: 'canvas' } | null {
  const el = document.elementFromPoint(x, y)
  const box = el?.closest<HTMLElement>('[data-nid]')
  if (box) return { kind: 'node', id: box.dataset.nid! }
  if (el?.closest('.mm-canvas')) return { kind: 'canvas' }
  return null
}

function onPointerDown(e: PointerEvent) {
  if ((e.target as Element).closest('.nn-actions')) return
  if (e.pointerType === 'mouse' && e.button !== 0) return
  startX = e.clientX; startY = e.clientY
  candidate = true; dragging = false
  captureEl = e.currentTarget as HTMLElement
  captureEl.setPointerCapture(e.pointerId)
}
function onPointerMove(e: PointerEvent) {
  if (!candidate) return
  if (isCenter.value) return // the center node cannot be dragged (taps still open it)
  if (!dragging) {
    if (Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD) return
    dragging = true
    noteDrag.draggingId = props.node.id
  }
  const t = targetAt(e.clientX, e.clientY)
  noteDrag.overId = t && t.kind === 'node' && t.id !== props.node.id ? t.id : null
}
function onPointerUp(e: PointerEvent) {
  if (!candidate) return
  captureEl?.releasePointerCapture?.(e.pointerId)
  const wasDragging = dragging
  const wasMe = noteDrag.draggingId === props.node.id
  candidate = false; dragging = false
  noteDrag.draggingId = null
  noteDrag.overId = null

  if (!wasDragging) { open(); return } // a tap → open the editor
  if (!wasMe) return

  const t = targetAt(e.clientX, e.clientY)
  if (!t) return
  if (t.kind === 'node') {
    if (t.id === props.node.id) return
    // Dropping onto the center → top level; onto another node → child of that node.
    store.reparent(props.node.id, t.id === CENTER_ID ? null : t.id)
  } else {
    store.reparent(props.node.id, null) // dropped on empty canvas → top level
  }
}
function onPointerCancel() {
  candidate = false; dragging = false
  if (noteDrag.draggingId === props.node.id) { noteDrag.draggingId = null; noteDrag.overId = null }
}
</script>

<template>
  <div class="nn-node">
    <div
      class="nn-box"
      :class="{ 'nn-root': isCenter, 'nn-drop': noteDrag.overId === node.id, 'nn-dragging': noteDrag.draggingId === node.id }"
      :data-nid="node.id"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
    >
      <span class="nn-title">{{ label }}</span>
      <span v-if="node.count > 0" class="nn-count">({{ node.count }})</span>
      <span class="nn-actions" :class="{ 'nn-actions-touch': isTouch }">
        <button title="Add child" @click.stop="addChild"><Plus /></button>
        <button v-if="!isCenter" title="Add sibling" @click.stop="addSibling"><CornerDownRight /></button>
        <button v-if="!isCenter" title="Rename" @click.stop="rename"><Pencil /></button>
        <button v-if="!isCenter" title="Delete" @click.stop="del"><Trash2 /></button>
      </span>
    </div>
    <div v-if="node.children.length" class="nn-kids">
      <NoteNode v-for="c in node.children" :key="c.id" :node="c" :paper-id="paperId" />
    </div>
  </div>
</template>

<style scoped>
.nn-node { display: flex; align-items: center; }
.nn-box {
  position: relative;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px;
  border: 1px solid var(--border); border-radius: 8px;
  background: var(--card); cursor: pointer;
  font-size: 13px; white-space: nowrap; max-width: 240px;
  touch-action: none; user-select: none; -webkit-user-select: none;
}
.nn-box:hover { border-color: var(--ring); }
.nn-root { border-color: var(--primary); font-weight: 600; cursor: pointer; }
.nn-drop { outline: 2px solid var(--primary); outline-offset: 1px; }
.nn-dragging { opacity: 0.5; }
.nn-title { overflow: hidden; text-overflow: ellipsis; }
.nn-count { flex-shrink: 0; color: var(--muted-foreground); font-size: 11px; pointer-events: none; }
.nn-actions { display: none; gap: 1px; }
.nn-box:hover .nn-actions { display: inline-flex; }
.nn-actions.nn-actions-touch { display: inline-flex; }
.nn-actions button { padding: 2px; border-radius: 4px; color: var(--muted-foreground); }
.nn-actions button:hover { background: var(--accent); color: var(--accent-foreground); }
.nn-actions :deep(svg) { width: 12px; height: 12px; }
.nn-kids { display: flex; flex-direction: column; gap: 10px; margin-left: 34px; }
</style>
