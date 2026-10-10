import { computed } from 'vue'
import { useWindowsStore } from '@/stores/windows'

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

export const QA_DEFAULT_HEIGHT = 132
export const QA_WINDOW_KEY = 'qa-ask'

/**
 * The floating "提问" (Ask) panel is one of the app's floating windows (`stores/windows.ts`, kind
 * `qa-ask`), drawn by the shared FloatingWindow shell in its `bare` look: the QAInput card itself
 * is the window, moved by dragging empty card areas and resized from the bottom-right grip. Unlike
 * other windows it never remembers a previous position/size — each `open()` uses exactly the
 * geometry it is given, computed fresh by the caller from the current layout.
 */
export function useQAWindow() {
  const store = useWindowsStore()
  const win = computed(() => store.get(QA_WINDOW_KEY) ?? null)
  const isOpen = computed(() => win.value != null)

  /** Open the panel at a freshly-computed default geometry. */
  function open(geometry: QAWindowGeometry) {
    store.place({
      key: QA_WINDOW_KEY, kind: 'qa-ask', paperId: 0, sectionId: null, title: '提问',
      x: geometry.left, y: geometry.top, w: geometry.width, h: geometry.height,
    })
  }

  function close() {
    store.close(QA_WINDOW_KEY)
  }

  return { win, isOpen, open, close }
}
