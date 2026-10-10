import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Every floating window in the app shares this store (one z-order stack, one geometry model) and
 * is drawn by the shared `components/FloatingWindow.vue` shell:
 * - `section` / `doc`: note editor windows. A SECTION window edits one section's leaf content
 *   (keyed by `sectionId`; null = the preamble/center node); the single whole-DOCUMENT window
 *   (`doc`) edits the entire note body. Doc and section windows are mutually exclusive per paper.
 * - `qa-tree`: the paper's Q&A follow-up tree (mind map).
 * - `qa-ask`: the floating question box (`QAInput`). Its geometry is computed fresh by the caller
 *   on every open and never remembered.
 */
export type FloatingWindowKind = 'section' | 'doc' | 'qa-tree' | 'qa-ask'

export interface NoteWindowTarget {
  paperId: number
  sectionId: string | null // null = the preamble (center node); ignored for doc windows
  title: string
  kind?: 'section' | 'doc' // defaults to 'section'
}

export interface FloatingWindowState {
  key: string
  kind: FloatingWindowKind
  paperId: number
  sectionId: string | null
  title: string
  x: number
  y: number
  w: number
  h: number
  z: number
}

/** A note editor window (kind `section` or `doc`). */
export type NoteWindow = FloatingWindowState

interface SizeMemory { storageKey: string; w: number; h: number }

/** Kinds whose size is remembered (the question box is not). */
const SIZE_MEMORY: Partial<Record<FloatingWindowKind, SizeMemory>> = {
  section: { storageKey: 'paperland_note_window_size', w: 460, h: 400 },
  doc: { storageKey: 'paperland_note_window_size', w: 460, h: 400 },
  'qa-tree': { storageKey: 'paperland_qa_tree_window_size', w: 760, h: 520 },
}

const NOTE_KINDS: FloatingWindowKind[] = ['section', 'doc']

function loadSize(memory: SizeMemory): { w: number; h: number } {
  try {
    const raw = localStorage.getItem(memory.storageKey)
    if (raw) {
      const p = JSON.parse(raw)
      if (p && typeof p.w === 'number' && typeof p.h === 'number') return p
    }
  } catch { /* localStorage unavailable */ }
  return { w: memory.w, h: memory.h }
}

export const useWindowsStore = defineStore('floating-windows', () => {
  const windows = ref<FloatingWindowState[]>([])
  let topZ = 200 // above page chrome and the launcher FAB

  function noteKey(t: NoteWindowTarget): string {
    return t.kind === 'doc' ? `${t.paperId}:doc` : `${t.paperId}:${t.sectionId ?? 'preamble'}`
  }

  function clampX(x: number, w: number) {
    return Math.max(8, Math.min(x, Math.max(8, window.innerWidth - w - 8)))
  }

  /** Open (or focus) a window with a remembered size, cascading from a default position. */
  function openSized(base: Omit<FloatingWindowState, 'x' | 'y' | 'w' | 'h' | 'z'>, at?: { x: number; y: number }) {
    const existing = windows.value.find((w) => w.key === base.key)
    if (existing) { focus(base.key); return }
    const memory = SIZE_MEMORY[base.kind]
    const { w, h } = memory ? loadSize(memory) : { w: 460, h: 400 }
    const cascade = windows.value.length * 26
    const x = at?.x ?? window.innerWidth / 2 - w / 2 + cascade
    const y = at?.y ?? 110 + cascade
    windows.value.push({ ...base, x: clampX(x, w), y: Math.max(8, y), w, h, z: ++topZ })
  }

  /** Open a note editor window for a target, or focus it if already open. `at` seeds the position. */
  function open(target: NoteWindowTarget, at?: { x: number; y: number }) {
    const kind = target.kind ?? 'section'
    const key = noteKey(target)
    if (!windows.value.some((w) => w.key === key)) {
      // Mutual exclusion per paper: a doc window and section windows can't be open together.
      windows.value = windows.value.filter((w) => !(w.paperId === target.paperId && NOTE_KINDS.includes(w.kind)
        && (kind === 'doc' ? w.kind !== 'doc' : w.kind === 'doc')))
    }
    openSized({ key, kind, paperId: target.paperId, sectionId: target.sectionId, title: target.title }, at)
  }

  /** Open (or focus) the Q&A tree window of a paper. */
  function openQATree(paperId: number, title: string) {
    openSized({ key: `${paperId}:qa-tree`, kind: 'qa-tree', paperId, sectionId: null, title })
  }

  /** Place a window at exactly the given geometry (no size memory) — used by the question box. */
  function place(base: Omit<FloatingWindowState, 'z'>) {
    windows.value = windows.value.filter((w) => w.key !== base.key)
    windows.value.push({ ...base, z: ++topZ })
  }

  function get(key: string): FloatingWindowState | undefined {
    return windows.value.find((w) => w.key === key)
  }

  function close(key: string) {
    windows.value = windows.value.filter((w) => w.key !== key)
  }

  /** Close a paper's note windows — used on structural changes and when leaving a paper. */
  function closeForPaper(paperId: number) {
    windows.value = windows.value.filter((w) => !(w.paperId === paperId && NOTE_KINDS.includes(w.kind)))
  }

  /** Close every window of one kind (e.g. the Q&A tree when leaving a paper). */
  function closeKind(kind: FloatingWindowKind) {
    windows.value = windows.value.filter((w) => w.kind !== kind)
  }

  function closeAll() {
    windows.value = []
  }

  /** Whether the whole-document window is open for a paper. */
  function isDocOpen(paperId: number): boolean {
    return windows.value.some((w) => w.paperId === paperId && w.kind === 'doc')
  }

  /** Bring a window to the top of the stack (called on click / focus). */
  function focus(key: string) {
    const w = windows.value.find((x) => x.key === key)
    if (w && w.z !== topZ) w.z = ++topZ
  }

  function setGeometry(key: string, geo: Partial<Pick<FloatingWindowState, 'x' | 'y' | 'w' | 'h'>>) {
    const w = windows.value.find((x) => x.key === key)
    if (!w) return
    Object.assign(w, geo)
    const memory = SIZE_MEMORY[w.kind]
    if (memory && (geo.w != null || geo.h != null)) {
      try { localStorage.setItem(memory.storageKey, JSON.stringify({ w: w.w, h: w.h })) } catch { /* ignore */ }
    }
  }

  function setTitle(key: string, title: string) {
    const w = windows.value.find((x) => x.key === key)
    if (w) w.title = title
  }

  return { windows, open, openQATree, place, get, close, closeForPaper, closeKind, closeAll, isDocOpen, focus, setGeometry, setTitle }
})
