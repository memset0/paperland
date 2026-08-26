export interface RelativeRect {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export interface PdfSelectionSnapshot {
  identity: string
  page: number
  ts: number
  te: number
  text: string
  rect: RelativeRect
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
  }
}

export interface TimerAdapter {
  set(callback: () => void, delayMs: number): unknown
  clear(handle: unknown): void
}

const browserTimer: TimerAdapter = {
  set: (callback, delayMs) => setTimeout(callback, delayMs),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

/** One stable identity arms one timer and activates at most once. */
export class StableSelectionIntent {
  private timer: unknown = null
  private pendingIdentity: string | null = null
  private activeIdentity: string | null = null

  constructor(private readonly delayMs = 500, private readonly timers: TimerAdapter = browserTimer) {}

  consider(snapshot: PdfSelectionSnapshot, activate: (snapshot: PdfSelectionSnapshot) => void): 'scheduled' | 'unchanged' {
    if (snapshot.identity === this.pendingIdentity || snapshot.identity === this.activeIdentity) return 'unchanged'
    this.clearTimer()
    this.pendingIdentity = snapshot.identity
    this.activeIdentity = null
    this.timer = this.timers.set(() => {
      this.timer = null
      if (this.pendingIdentity !== snapshot.identity) return
      this.pendingIdentity = null
      this.activeIdentity = snapshot.identity
      activate(snapshot)
    }, this.delayMs)
    return 'scheduled'
  }

  cancel(): void {
    this.clearTimer()
    this.pendingIdentity = null
    this.activeIdentity = null
  }

  isCurrent(identity: string): boolean {
    return identity === this.pendingIdentity || identity === this.activeIdentity
  }

  private clearTimer(): void {
    if (this.timer != null) this.timers.clear(this.timer)
    this.timer = null
  }
}

export interface PanelPlacement {
  left: number
  top: number
  width: number
  placement: 'above' | 'below'
}

export type OutsidePanelSelectionDecision = 'dismiss' | 'keep_for_replacement'

/** Settle an outside pointer gesture after native selection has finished updating. */
export function decideOutsidePanelSelection(
  activeIdentity: string,
  settledSelectionIdentity: string | null,
): OutsidePanelSelectionDecision {
  return settledSelectionIdentity && settledSelectionIdentity !== activeIdentity
    ? 'keep_for_replacement'
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
