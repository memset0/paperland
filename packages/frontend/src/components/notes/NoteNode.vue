<script setup lang="ts">
import { computed } from 'vue'
import { useNotesStore, type NoteTreeNode } from '@/stores/notes'
import { useWindowsStore } from '@/stores/windows'
import { noteDrag } from '@/composables/useNoteDrag'
import { Plus, Trash2, CornerDownRight } from '@lucide/vue'

// One node in the branching mind-map. Title-only; a tap/click opens its editor window,
// a drag re-parents it (drop onto another node → its child; onto empty canvas → under root).
// The root note is the fixed anchor: it cannot be dragged, given siblings, or deleted.
const props = defineProps<{ node: NoteTreeNode; paperId: number }>()
const store = useNotesStore()
const windows = useWindowsStore()

const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
const isRoot = computed(() => props.node.kind === 'root')
const label = computed(() => (isRoot.value ? '(root)' : props.node.title || '(untitled)'))
// Character count of the note body, shown as a grey badge so substantial notes stand out.
const charCount = computed(() => props.node.body.trim().length)

function open() {
  if (isRoot.value) {
    windows.open({ kind: 'root', paperId: props.paperId, title: '(root)' })
  } else {
    windows.open({ kind: 'note', paperId: props.paperId, noteId: props.node.id, title: props.node.title || '(untitled)' })
  }
}
async function addChild() {
  // Under the root, a child's parent is the (possibly not-yet-persisted) root note.
  const parent_id = isRoot.value ? (store.root?.id ?? null) : props.node.id
  const n = await store.createNote({ parent_id, title: 'Untitled' })
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
    ? `Delete "${label.value}" and its ${d} descendant note${d > 1 ? 's' : ''}?`
    : `Delete "${label.value}"?`
  if (!window.confirm(msg)) return
  windows.close(`note-${props.node.id}`)
  await store.removeNote(props.node.id)
}

// --- Unified pointer drag (touch + mouse) ---
const DRAG_THRESHOLD = 6
let startX = 0, startY = 0, candidate = false, dragging = false
let captureEl: HTMLElement | null = null

/** What's under the pointer: a node box, the empty canvas, or nothing. */
function targetAt(x: number, y: number): { kind: 'node'; id: number } | { kind: 'canvas' } | null {
  const el = document.elementFromPoint(x, y) // svg link layer is pointer-events:none, so skipped
  const box = el?.closest<HTMLElement>('[data-nid]')
  if (box) return { kind: 'node', id: parseInt(box.dataset.nid!, 10) }
  if (el?.closest('.mm-canvas')) return { kind: 'canvas' }
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
  if (isRoot.value) return // the root note cannot be dragged (taps still open it)
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
    // Dropped on empty canvas → reparent directly under the root note.
    const rootId = store.root?.id ?? null
    const count = store.notes.filter((n) => n.parent_id === rootId).length
    store.moveNote(props.node.id, rootId, count).catch(() => {})
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
      :class="{ 'nn-root': isRoot, 'nn-drop': noteDrag.overId === node.id, 'nn-dragging': noteDrag.draggingId === node.id }"
      :data-nid="node.id"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
    >
      <span class="nn-title">{{ label }}</span>
      <span v-if="charCount > 0" class="nn-count">({{ charCount }})</span>
      <span class="nn-actions" :class="{ 'nn-actions-touch': isTouch }">
        <button title="Add child" @click.stop="addChild"><Plus /></button>
        <button v-if="!isRoot" title="Add sibling" @click.stop="addSibling"><CornerDownRight /></button>
        <button v-if="!isRoot" title="Delete" @click.stop="del"><Trash2 /></button>
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
.nn-actions.nn-actions-touch { display: inline-flex; } /* touch has no hover → always show */
.nn-actions button { padding: 2px; border-radius: 4px; color: var(--muted-foreground); }
.nn-actions button:hover { background: var(--accent); color: var(--accent-foreground); }
.nn-actions :deep(svg) { width: 12px; height: 12px; }

.nn-kids { display: flex; flex-direction: column; gap: 10px; margin-left: 34px; }
</style>
