import { defineStore } from 'pinia'
import { ref } from 'vue'

// A floating editor window is either a SECTION window (edits one section's leaf content, keyed by
// `sectionId`; null = the preamble/center node) or the single whole-DOCUMENT window for a paper
// (`kind: 'doc'`, edits the entire note body). A doc window and section windows are mutually
// exclusive per paper (see `open`).
export interface NoteWindowTarget {
  paperId: number
  sectionId: string | null // null = the preamble (center node); ignored for doc windows
  title: string
  kind?: 'section' | 'doc' // defaults to 'section'
}

export interface NoteWindow extends NoteWindowTarget {
  key: string
  x: number
  y: number
  w: number
  h: number
  z: number
}

const SIZE_KEY = 'paperland_note_window_size'
const DEFAULT_W = 460
const DEFAULT_H = 400

function loadSize(): { w: number; h: number } {
  try {
    const raw = localStorage.getItem(SIZE_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      if (p && typeof p.w === 'number' && typeof p.h === 'number') return p
    }
  } catch { /* localStorage unavailable */ }
  return { w: DEFAULT_W, h: DEFAULT_H }
}

/**
 * Floating note-editor windows. Each window is bound to one section (or the preamble) of a
 * paper's single note document. At most one window per section (opening an open section just
 * focuses it). Multiple windows may be open; the most-recently focused sits on top. Any
 * structural change to the document closes all windows (see the notes store).
 */
export const useWindowsStore = defineStore('note-windows', () => {
  const windows = ref<NoteWindow[]>([])
  const lastSize = ref(loadSize())
  let topZ = 100

  function keyFor(t: NoteWindowTarget): string {
    return t.kind === 'doc' ? `${t.paperId}:doc` : `${t.paperId}:${t.sectionId ?? 'preamble'}`
  }

  /** Open a window for a target, or focus it if already open. `at` seeds the position. */
  function open(target: NoteWindowTarget, at?: { x: number; y: number }) {
    const key = keyFor(target)
    const existing = windows.value.find((w) => w.key === key)
    if (existing) {
      focus(key)
      return
    }
    // Mutual exclusion per paper: a doc window and section windows can't be open together.
    if (target.kind === 'doc') {
      windows.value = windows.value.filter((w) => !(w.paperId === target.paperId && w.kind !== 'doc'))
    } else {
      windows.value = windows.value.filter((w) => !(w.paperId === target.paperId && w.kind === 'doc'))
    }
    const { w, h } = lastSize.value
    const cascade = windows.value.length * 26
    const x = at?.x ?? window.innerWidth / 2 - w / 2 + cascade
    const y = at?.y ?? 110 + cascade
    windows.value.push({
      ...target,
      key,
      x: Math.max(8, Math.min(x, Math.max(8, window.innerWidth - w - 8))),
      y: Math.max(8, y),
      w, h, z: ++topZ,
    })
  }

  function close(key: string) {
    windows.value = windows.value.filter((w) => w.key !== key)
  }

  /** Close every window for a paper — used on structural changes and when leaving a paper. */
  function closeForPaper(paperId: number) {
    windows.value = windows.value.filter((w) => w.paperId !== paperId)
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
    if (w) w.z = ++topZ
  }

  function setGeometry(key: string, geo: Partial<Pick<NoteWindow, 'x' | 'y' | 'w' | 'h'>>) {
    const w = windows.value.find((x) => x.key === key)
    if (!w) return
    Object.assign(w, geo)
    if (geo.w != null || geo.h != null) {
      lastSize.value = { w: w.w, h: w.h }
      try { localStorage.setItem(SIZE_KEY, JSON.stringify(lastSize.value)) } catch { /* ignore */ }
    }
  }

  function setTitle(key: string, title: string) {
    const w = windows.value.find((x) => x.key === key)
    if (w) w.title = title
  }

  return { windows, lastSize, open, close, closeForPaper, closeAll, isDocOpen, focus, setGeometry, setTitle }
})
