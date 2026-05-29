<script setup lang="ts">
import { useNotesStore, type NoteTreeNode } from '@/stores/notes'
import { useWindowsStore } from '@/stores/windows'
import { noteDrag } from '@/composables/useNoteDrag'
import { Plus, Trash2, CornerDownRight } from '@lucide/vue'

// One node in the branching mind-map. Title-only; a tap/click opens its editor window,
// a drag re-parents it (drop onto another node → its child; onto empty canvas → top-level).
const props = defineProps<{ node: NoteTreeNode; paperId: number }>()
const store = useNotesStore()
const windows = useWindowsStore()

const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0

function open() {
  windows.open({ kind: 'note', paperId: props.paperId, noteId: props.node.id, title: props.node.title || '(untitled)' })
}
async function addChild() {
  const n = await store.createNote({ parent_id: props.node.id, title: 'Untitled' })
  if (n) windows.open({ kind: 'note', paperId: props.paperId, noteId: n.id, title: 'Untitled' })
}
async function addSibling() {
  const n = await store.createNote({ parent_id: props.node.parent_id, title: 'Untitled' })
  if (n) windows.open({ kind: 'note', paperId: props.paperId, noteId: n.id, title: 'Untitled' })
}
function countDescendants(n: NoteTreeNode): number {
  return n.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0)
}
async function del() {
  const d = countDescendants(props.node)
  const msg = d > 0
    ? `Delete "${props.node.title || '(untitled)'}" and its ${d} descendant note${d > 1 ? 's' : ''}?`
    : `Delete "${props.node.title || '(untitled)'}"?`
  if (!window.confirm(msg)) return
  windows.close(`note-${props.node.id}`)
  await store.removeNote(props.node.id)
}

// --- Unified pointer drag (touch + mouse) ---
const DRAG_THRESHOLD = 6
let startX = 0, startY = 0, candidate = false, dragging = false
let captureEl: HTMLElement | null = null

/** What's under the pointer: a node box, the empty canvas, or nothing. */
function targetAt(x: number, y: number): { kind: 'node'; id: number } | { kind: 'root' } | null {
  const el = document.elementFromPoint(x, y) // svg link layer is pointer-events:none, so skipped
  const box = el?.closest<HTMLElement>('[data-nid]')
  if (box) return { kind: 'node', id: parseInt(box.dataset.nid!, 10) }
  if (el?.closest('.mm-canvas')) return { kind: 'root' }
  return null
}

function onPointerDown(e: PointerEvent) {
  if ((e.target as Element).closest('.nn-actions')) return // let action buttons handle their own taps
  if (e.pointerType === 'mouse' && e.button !== 0) return
  startX = e.clientX; startY = e.clientY
  candidate = true; dragging = false
  captureEl = e.currentTarget as HTMLElement
  captureEl.setPointerCapture(e.pointerId)
}
function onPointerMove(e: PointerEvent) {
  if (!candidate) return
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
    const childCount = store.notes.filter((n) => n.parent_id === t.id).length
    store.moveNote(props.node.id, t.id, childCount).catch(() => {})
  } else {
    const rootCount = store.notes.filter((n) => n.parent_id == null).length
    store.moveNote(props.node.id, null, rootCount).catch(() => {})
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
      :class="{ 'nn-drop': noteDrag.overId === node.id, 'nn-dragging': noteDrag.draggingId === node.id }"
      :data-nid="node.id"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
    >
      <span class="nn-title">{{ node.title || '(untitled)' }}</span>
      <span class="nn-actions" :class="{ 'nn-actions-touch': isTouch }">
        <button title="Add child" @click.stop="addChild"><Plus /></button>
        <button title="Add sibling" @click.stop="addSibling"><CornerDownRight /></button>
        <button title="Delete" @click.stop="del"><Trash2 /></button>
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
.nn-drop { outline: 2px solid var(--primary); outline-offset: 1px; }
.nn-dragging { opacity: 0.5; }
.nn-title { overflow: hidden; text-overflow: ellipsis; }

.nn-actions { display: none; gap: 1px; }
.nn-box:hover .nn-actions { display: inline-flex; }
.nn-actions.nn-actions-touch { display: inline-flex; } /* touch has no hover → always show */
.nn-actions button { padding: 2px; border-radius: 4px; color: var(--muted-foreground); }
.nn-actions button:hover { background: var(--accent); color: var(--accent-foreground); }
.nn-actions :deep(svg) { width: 12px; height: 12px; }

.nn-kids { display: flex; flex-direction: column; gap: 10px; margin-left: 34px; }
</style>
