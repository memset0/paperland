export interface RelativeRect {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export interface PdfTextSegment {
  page: number
  ts: number
  te: number
  text: string
}

export interface PdfSelectionSnapshot {
  identity: string
  /** First page / offsets (the whole selection when it lies on one page). */
  page: number
  ts: number
  te: number
  text: string
  rect: RelativeRect
  /** One segment per page; more than one when the selection spans pages. */
  segments: PdfTextSegment[]
}

/** Whether a selection spans several pages (asking works; translation/copy-link stay single-page). */
export function isMultiPageSelection(snapshot: PdfSelectionSnapshot): boolean {
  return snapshot.segments.length > 1
}

/**
 * Snapshot of a selection spanning several pages: segments in page order, text joined with a
 * space. Returns null when any segment is invalid.
 */
export function createMultiPageSelectionSnapshot(segments: PdfTextSegment[], rect: RelativeRect): PdfSelectionSnapshot | null {
  const valid = segments.filter((segment) => segment.text.trim() && segment.te > segment.ts)
  if (valid.length < 2 || rect.width <= 0 || rect.height <= 0) return null
  const text = valid.map((segment) => segment.text.trim()).join(' ')
  const first = valid[0]
  return {
    identity: valid.map((segment) => `${segment.page}:${segment.ts}:${segment.te}`).join('|') + `:${text}`,
    page: first.page,
    ts: first.ts,
    te: first.te,
    text,
    rect: { ...rect },
    segments: valid.map((segment) => ({ ...segment, text: segment.text.trim() })),
  }
}

export function createPdfSelectionSnapshot(input: {
  page: number
  ts: number
  te: number
  text: string
  rect: RelativeRect
  samePage?: boolean
  insideTextLayer?: boolean
}): PdfSelectionSnapshot | null {
  const text = input.text.trim()
  if (input.samePage === false || input.insideTextLayer === false) return null
  if (!Number.isInteger(input.page) || input.page < 1 || input.ts < 0 || input.te <= input.ts || !text) return null
  if (input.rect.width <= 0 || input.rect.height <= 0) return null
  return {
    identity: `${input.page}:${input.ts}:${input.te}:${text}`,
    page: input.page,
    ts: input.ts,
    te: input.te,
    text,
    rect: { ...input.rect },
    segments: [{ page: input.page, ts: input.ts, te: input.te, text }],
  }
}

export interface PanelPlacement {
  left: number
  top: number
  width: number
  placement: 'above' | 'below'
}

export type OutsidePanelSelectionDecision = 'dismiss' | 'keep_for_new_selection'

/** Show source context only until the stream/cache provides actual translated text. */
export function selectPdfTranslationPanelText(sourceText: string, translatedText: string): string {
  return translatedText.length > 0 ? translatedText : sourceText
}

/** Settle an outside pointer gesture after native selection has finished updating. */
export function decideOutsidePanelSelection(
  activeIdentity: string,
  settledSelectionIdentity: string | null,
): OutsidePanelSelectionDecision {
  return settledSelectionIdentity && settledSelectionIdentity !== activeIdentity
    ? 'keep_for_new_selection'
    : 'dismiss'
}

export function placeSelectionPanel(input: {
  viewerWidth: number
  viewerHeight: number
  selection: RelativeRect
  panelWidth: number
  panelHeight: number
  inset?: number
  gap?: number
  copyActionHeight?: number
}): PanelPlacement {
  const inset = input.inset ?? 8
  const gap = input.gap ?? 8
  const copyActionHeight = input.copyActionHeight ?? 32
  const availableWidth = Math.max(1, input.viewerWidth - inset * 2)
  const width = Math.min(360, Math.max(1, input.panelWidth), availableWidth)
  const center = input.selection.left + input.selection.width / 2
  const left = Math.max(inset, Math.min(input.viewerWidth - inset - width, center - width / 2))
  const aboveTop = input.selection.top - gap - input.panelHeight

  if (aboveTop >= inset) {
    return { left, top: aboveTop, width, placement: 'above' }
  }

  const preferredBelow = input.selection.bottom + gap + copyActionHeight
  const maxTop = Math.max(inset, input.viewerHeight - inset - input.panelHeight)
  return {
    left,
    top: Math.max(inset, Math.min(maxTop, preferredBelow)),
    width,
    placement: 'below',
  }
}
