<script lang="ts">
export const CENTER_ID = '__center__'

/** View-model for a mind-map node, derived from the note document. */
export interface MindNode {
  id: string            // section id, CENTER_ID for the center, or `<parentId>#c<i>` for a content node
  label: string         // heading text (empty for content nodes)
  count: number         // leaf-body character count (0 for content nodes)
  isCenter: boolean
  /** Read-only content node derived from a leading blockquote (text / image / formula). */
  isContent?: boolean
  /** Raw blockquote Markdown for a content node. */
  content?: string
  children: MindNode[]
}
</script>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { useNotesStore } from '@/stores/notes'
import { useWindowsStore } from '@/stores/windows'
import { noteDrag } from '@/composables/useNoteDrag'
import MarkdownContent from '@/components/MarkdownContent.vue'
import { Plus, Trash2, CornerDownRight, Pencil, SquarePen } from '@lucide/vue'

// One node in the heading-derived mind-map. A tap opens a floating editor for the node's leaf
// content (the preamble for the center node); a drag re-parents it (rewriting headings). The
// per-node actions live in a hover tooltip below the node. Content nodes (derived from leading
// blockquotes) are read-only: no tap-to-edit, no drag, no actions.
// `readonly` renders the node for viewing another user's public note: no tap-to-edit, no drag,
// no action tooltip, and content-node Markdown renders in public-note mode (inert Q&A anchors).
const props = defineProps<{ node: MindNode; paperId: number; readonly?: boolean }>()
const store = useNotesStore()
const windows = useWindowsStore()

const isCenter = computed(() => props.node.isCenter)
const isContent = computed(() => props.node.isContent === true)
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
  closePanel()
  const name = promptHeading('New section')
  if (name == null) return
  const id = store.addChild(isCenter.value ? null : props.node.id, name)
  if (id) openWindow(id, name)
}
async function addSibling() {
  closePanel()
  const name = promptHeading('New section')
  if (name == null) return
  const id = store.addSibling(props.node.id, name)
  if (id) openWindow(id, name)
}
function rename() {
  closePanel()
  const name = window.prompt('Rename section', props.node.label)
  if (name == null) return
  store.rename(props.node.id, name)
}
function countDescendants(n: MindNode): number {
  return n.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0)
}
function del() {
  closePanel()
  const d = countDescendants(props.node)
  const msg = d > 0
    ? `Delete "${label.value}" and its ${d} descendant section${d > 1 ? 's' : ''}?`
    : `Delete "${label.value}"?`
  if (!window.confirm(msg)) return
  store.remove(props.node.id)
}

// --- Action panel below the node ---
// Desktop (hover-capable): reveal on hover, bridged so moving into the panel keeps it open;
// clicking the node opens the editor. Touch (no hover): a tap shows the panel instead of editing
// (to avoid mis-taps), and the panel carries an explicit Edit button; an outside tap dismisses it.
const isTouch = useMediaQuery('(hover: none)')
const boxRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const hovered = ref(false)
const popStyle = ref<Record<string, string>>({})
let closeTimer: ReturnType<typeof setTimeout> | null = null

function positionPanel() {
  const r = boxRef.value?.getBoundingClientRect()
  if (r) popStyle.value = { left: `${r.left + r.width / 2}px`, top: `${r.bottom + 6}px` }
}
function cancelClose() { if (closeTimer) { clearTimeout(closeTimer); closeTimer = null } }
function scheduleClose() {
  if (isTouch.value) return // touch dismisses via outside-tap, not pointer leave
  cancelClose()
  closeTimer = setTimeout(() => { hovered.value = false }, 140)
}
function openActions() { // desktop hover
  if (props.readonly || isContent.value || isTouch.value) return
  positionPanel()
  cancelClose()
  hovered.value = true
}
function closePanel() {
  hovered.value = false
  document.removeEventListener('pointerdown', onOutside, true)
}
function onOutside(e: PointerEvent) {
  const t = e.target as Node
  if (panelRef.value?.contains(t) || boxRef.value?.contains(t)) return
  closePanel()
}
function toggleTouchPanel() { // touch tap
  if (hovered.value) { closePanel(); return }
  positionPanel()
  hovered.value = true
  // Defer so the tap that opened the panel doesn't immediately dismiss it.
  setTimeout(() => document.addEventListener('pointerdown', onOutside, true), 0)
}
function editFromPanel() { closePanel(); open() }
onUnmounted(() => document.removeEventListener('pointerdown', onOutside, true))

// --- Unified pointer drag (touch + mouse) → structural reparent ---
const DRAG_THRESHOLD = 6
let startX = 0, startY = 0, candidate = false, dragging = false
let captureEl: HTMLElement | null = null

function targetAt(x: number, y: number): { kind: 'node'; id: string } | { kind: 'canvas' } | null {
  const el = document.elementFromPoint(x, y)
  const box = el?.closest<HTMLElement>('[data-nid]')
  // Content-node ids contain '#'; they are not real sections, so never treat them as drop targets.
  if (box && !box.dataset.nid!.includes('#')) return { kind: 'node', id: box.dataset.nid! }
  if (el?.closest('.mm-canvas')) return { kind: 'canvas' }
  return null
}

function onPointerDown(e: PointerEvent) {
  if (props.readonly || isContent.value) return // read-only: no drag, no tap-to-edit
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

  if (!wasDragging) { isTouch.value ? toggleTouchPanel() : open(); return } // tap: touch → panel, desktop → edit
  if (!wasMe) return

  const t = targetAt(e.clientX, e.clientY)
  if (!t) return
  if (t.kind === 'node') {
    if (t.id === props.node.id) return
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
    <!-- Read-only content node (from a leading blockquote): text / image / formula, half-border. -->
    <div v-if="isContent" class="nn-box nn-content" :data-nid="node.id">
      <MarkdownContent :content="node.content || ''" :paper-id="paperId" :disable-highlights="true" :public-note="readonly" class="nn-content-md" />
    </div>

    <!-- Heading / center node: tap to edit, drag to restructure, actions in a hover tooltip. -->
    <div
      v-else
      ref="boxRef"
      class="nn-box"
      :class="{ 'nn-root': isCenter, 'nn-readonly': readonly, 'nn-drop': noteDrag.overId === node.id, 'nn-dragging': noteDrag.draggingId === node.id }"
      :data-nid="node.id"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @mouseenter="openActions"
      @mouseleave="scheduleClose"
    >
      <span class="nn-title">{{ label }}</span>
      <span v-if="node.count > 0" class="nn-count">({{ node.count }})</span>
    </div>

    <!-- Action tooltip, teleported to body + fixed-positioned so the scroll container can't clip it. -->
    <Teleport to="body">
      <div
        v-if="hovered && !isContent"
        ref="panelRef"
        class="nn-actions-pop"
        :style="popStyle"
        @mouseenter="cancelClose"
        @mouseleave="scheduleClose"
      >
        <button v-if="isTouch" title="Edit" @click="editFromPanel"><SquarePen /></button>
        <button title="Add child" @click="addChild"><Plus /></button>
        <button v-if="!isCenter" title="Add sibling" @click="addSibling"><CornerDownRight /></button>
        <button v-if="!isCenter" title="Rename" @click="rename"><Pencil /></button>
        <button v-if="!isCenter" title="Delete" @click="del"><Trash2 /></button>
      </div>
    </Teleport>

    <div v-if="node.children.length" class="nn-kids">
      <NoteNode v-for="c in node.children" :key="c.id" :node="c" :paper-id="paperId" :readonly="readonly" />
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
.nn-readonly { cursor: default; }
.nn-readonly:hover { border-color: var(--border); }
.nn-drop { outline: 2px solid var(--primary); outline-offset: 1px; }
.nn-dragging { opacity: 0.5; }
.nn-title { overflow: hidden; text-overflow: ellipsis; }
.nn-count { flex-shrink: 0; color: var(--muted-foreground); font-size: 11px; pointer-events: none; }

/* Content node: read-only, no full border — only a bottom "tray" (lower half of the left/right
   edges + bottom edge + rounded bottom corners), content sitting above it. */
.nn-content {
  border: none; background: transparent; cursor: default;
  padding: 2px 10px 3px; white-space: normal; max-width: 260px;
  touch-action: auto; user-select: text; -webkit-user-select: text;
}
.nn-content::after {
  /* Tray border starts at the vertical middle — where the connector joins the node. */
  content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 50%;
  border: 1px solid var(--border); border-top: none; border-radius: 0 0 8px 8px;
  pointer-events: none;
}
.nn-content-md { position: relative; z-index: 1; font-size: 12px; }
/* Drop the rendered Markdown's outer margins so the node hugs its content (no large bottom gap). */
.nn-content-md :deep(:first-child) { margin-top: 0; }
.nn-content-md :deep(:last-child) { margin-bottom: 0; }
.nn-kids { display: flex; flex-direction: column; gap: 10px; margin-left: 34px; }
</style>

<style>
/* Teleported action tooltip (global: it lives on <body>). Centered below the node. */
.nn-actions-pop {
  position: fixed;
  transform: translateX(-50%);
  z-index: 300;
  display: inline-flex; gap: 1px;
  padding: 2px;
  border: 1px solid var(--border); border-radius: 6px;
  background: var(--popover); color: var(--popover-foreground);
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.12);
}
.nn-actions-pop button { padding: 3px; border-radius: 4px; color: var(--muted-foreground); }
.nn-actions-pop button:hover { background: var(--accent); color: var(--accent-foreground); }
.nn-actions-pop svg { width: 13px; height: 13px; }
</style>
