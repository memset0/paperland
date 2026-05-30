import { ref } from 'vue'

export interface QAWindowGeometry {
  /** Distance from the viewport left edge (px). */
  left: number
  /** Distance from the viewport top edge (px). */
  top: number
  /** Panel width (px). */
  width: number
  /** Panel height (px). */
  height: number
}

const DEFAULT_WIDTH = 460
export const QA_DEFAULT_HEIGHT = 132

// Module-level singleton: there is at most one QA panel across the app.
const isOpen = ref(false)
const left = ref(0)
const top = ref(0)
const width = ref(DEFAULT_WIDTH)
const height = ref(QA_DEFAULT_HEIGHT)

/**
 * State for the floating "提问" (Ask) panel. The panel IS the QAInput card itself
 * (no separate window chrome). It is top-left anchored and resizable from a
 * bottom-right grip; it is moved by dragging any empty (non-textarea/non-button)
 * area of the card. Unlike the notes window (`stores/windows.ts`) it never
 * remembers a previous position/size — each `open()` uses exactly the geometry it
 * is given, computed fresh by the caller from the current layout. Drag/resize
 * updates are in-memory only and discarded on close.
 */
export function useQAWindow() {
  /** Open the panel at a freshly-computed default geometry. */
  function open(geometry: QAWindowGeometry) {
    left.value = geometry.left
    top.value = geometry.top
    width.value = geometry.width
    height.value = geometry.height
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  /** Update geometry while dragging/resizing (in-memory only, never persisted). */
  function setGeometry(partial: Partial<QAWindowGeometry>) {
    if (partial.left != null) left.value = partial.left
    if (partial.top != null) top.value = partial.top
    if (partial.width != null) width.value = partial.width
    if (partial.height != null) height.value = partial.height
  }

  return { isOpen, left, top, width, height, open, close, setGeometry }
}
