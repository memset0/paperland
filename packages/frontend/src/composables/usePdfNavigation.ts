import { ref } from 'vue'

/**
 * Shared PDF navigation state for `paperland://…?pdf=…` anchors.
 *
 * `requestedPdfTarget` is the page (and optional text-selection region) a
 * `paperland://` jump wants shown in the embedded PDF viewer. It mirrors
 * `useBlockAnchor`'s `requestedResultId`: a module-level ref that decouples the
 * click site (`MarkdownContent`) from the consumers (`PaperViewerPanel` switches
 * to the PDF tab; `PdfViewer` scrolls + transiently highlights) without prop
 * drilling.
 *
 * Each request is a fresh object so re-clicking the same link re-triggers the
 * watchers even when the target is unchanged.
 */
export interface PdfNavTarget {
  page: number
  /** Half-open text-content offsets of a selection within the page (optional). */
  ts?: number
  te?: number
  /**
   * Normalized `[0,1]` page-space rectangle of a captured region (optional).
   * When present it takes precedence over `ts`/`te`: the viewer highlights this
   * rectangle directly instead of mapping text offsets.
   */
  rect?: { x: number; y: number; w: number; h: number }
}

export const requestedPdfTarget = ref<PdfNavTarget | null>(null)

export function usePdfNavigation() {
  function requestPdfNavigation(target: PdfNavTarget) {
    requestedPdfTarget.value = { ...target }
  }
  return { requestedPdfTarget, requestPdfNavigation }
}
