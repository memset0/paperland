import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface NoteWindowTarget {
  kind: 'walkthrough' | 'note'
  paperId: number
  noteId?: number
  title: string
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
 * Floating note editor windows. Multiple may be open at once; the most-recently
 * focused sits on top (highest `z`). The size a user last resized a window to is
 * remembered globally (localStorage) and used as the opening size for new windows.
 */
export const useWindowsStore = defineStore('note-windows', () => {
  const windows = ref<NoteWindow[]>([])
  const lastSize = ref(loadSize())
  let topZ = 100

  function keyFor(t: NoteWindowTarget): string {
    return t.kind === 'walkthrough' ? `walkthrough-${t.paperId}` : `note-${t.noteId}`
  }

  /** Open a window for a target, or focus it if already open. `at` seeds the position. */
  function open(target: NoteWindowTarget, at?: { x: number; y: number }) {
    const key = keyFor(target)
    const existing = windows.value.find((w) => w.key === key)
    if (existing) {
      focus(key)
      return
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

  function closeForPaper(paperId: number) {
    windows.value = windows.value.filter((w) => w.paperId !== paperId)
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
    // Remember the last-resized dimensions globally for future windows.
    if (geo.w != null || geo.h != null) {
      lastSize.value = { w: w.w, h: w.h }
      try { localStorage.setItem(SIZE_KEY, JSON.stringify(lastSize.value)) } catch { /* ignore */ }
    }
  }

  /** Keep a window's title in sync when its note is renamed. */
  function setTitle(key: string, title: string) {
    const w = windows.value.find((x) => x.key === key)
    if (w) w.title = title
  }

  return { windows, lastSize, open, close, closeForPaper, focus, setGeometry, setTitle }
})
