import { describe, expect, test } from 'bun:test'
import {
  createPdfSelectionSnapshot,
  decideOutsidePanelSelection,
  placeSelectionPanel,
  StableSelectionIntent,
  type TimerAdapter,
} from './pdf-selection-translation'

const rect = { left: 100, top: 200, right: 180, bottom: 220, width: 80, height: 20 }

class FakeTimers implements TimerAdapter {
  now = 0
  next = 1
  tasks = new Map<number, { at: number; callback: () => void }>()

  set(callback: () => void, delayMs: number): number {
    const id = this.next++
    this.tasks.set(id, { at: this.now + delayMs, callback })
    return id
  }

  clear(handle: unknown): void { this.tasks.delete(handle as number) }

  advance(ms: number): void {
    this.now += ms
    const due = [...this.tasks.entries()].filter(([, task]) => task.at <= this.now)
    for (const [id, task] of due) {
      this.tasks.delete(id)
      task.callback()
    }
  }
}

function snapshot(page = 1, ts = 0, te = 5, text = 'hello') {
  return createPdfSelectionSnapshot({ page, ts, te, text, rect })!
}

describe('PDF selection translation helpers', () => {
  test('identity includes page, offsets, and normalized text', () => {
    expect(snapshot().identity).toBe('1:0:5:hello')
    expect(snapshot(2).identity).not.toBe(snapshot().identity)
    expect(snapshot(1, 10, 15).identity).not.toBe(snapshot().identity)
    expect(snapshot(1, 0, 5, ' hello ').identity).toBe(snapshot().identity)
  })

  test('rejects invalid, cross-page, outside-layer, empty, and degenerate snapshots', () => {
    expect(createPdfSelectionSnapshot({ page: 1, ts: 0, te: 5, text: 'hello', rect, samePage: false })).toBeNull()
    expect(createPdfSelectionSnapshot({ page: 1, ts: 0, te: 5, text: 'hello', rect, insideTextLayer: false })).toBeNull()
    expect(createPdfSelectionSnapshot({ page: 1, ts: 0, te: 0, text: 'hello', rect })).toBeNull()
    expect(createPdfSelectionSnapshot({ page: 1, ts: 0, te: 5, text: ' ', rect })).toBeNull()
    expect(createPdfSelectionSnapshot({ page: 1, ts: 0, te: 5, text: 'hello', rect: { ...rect, width: 0 } })).toBeNull()
  })

  test('activates only after an unchanged 500ms identity and deduplicates repeats', () => {
    const timers = new FakeTimers()
    const intent = new StableSelectionIntent(500, timers)
    const activated: string[] = []
    const first = snapshot()
    expect(intent.consider(first, (value) => activated.push(value.identity))).toBe('scheduled')
    timers.advance(499)
    expect(activated).toEqual([])
    expect(intent.consider(first, (value) => activated.push(value.identity))).toBe('unchanged')
    timers.advance(1)
    expect(activated).toEqual([first.identity])
    expect(intent.consider(first, (value) => activated.push(value.identity))).toBe('unchanged')
  })

  test('replaces a pending identity and cancel prevents activation', () => {
    const timers = new FakeTimers()
    const intent = new StableSelectionIntent(500, timers)
    const activated: string[] = []
    intent.consider(snapshot(), (value) => activated.push(value.identity))
    timers.advance(499)
    const second = snapshot(1, 6, 11, 'world')
    intent.consider(second, (value) => activated.push(value.identity))
    timers.advance(499)
    expect(activated).toEqual([])
    timers.advance(1)
    expect(activated).toEqual([second.identity])
    intent.cancel()
    expect(intent.isCurrent(second.identity)).toBe(false)
  })

  test('places above when possible and below with reserved action space near top', () => {
    expect(placeSelectionPanel({
      viewerWidth: 600, viewerHeight: 700, selection: rect,
      panelWidth: 320, panelHeight: 120,
    })).toEqual({ left: 8, top: 72, width: 320, placement: 'above' })

    const nearTop = { ...rect, top: 20, bottom: 40 }
    expect(placeSelectionPanel({
      viewerWidth: 600, viewerHeight: 700, selection: nearTop,
      panelWidth: 320, panelHeight: 120,
    })).toMatchObject({ top: 80, placement: 'below' })
  })

  test('clamps width and horizontal/vertical position inside narrow viewer', () => {
    const placement = placeSelectionPanel({
      viewerWidth: 220,
      viewerHeight: 180,
      selection: { left: 195, top: 5, right: 215, bottom: 25, width: 20, height: 20 },
      panelWidth: 360,
      panelHeight: 150,
    })
    expect(placement).toEqual({ left: 8, top: 22, width: 204, placement: 'below' })
  })

  test('dismisses a plain outside click but keeps a different selection for stable replacement', () => {
    const active = snapshot().identity
    expect(decideOutsidePanelSelection(active, null)).toBe('dismiss')
    expect(decideOutsidePanelSelection(active, active)).toBe('dismiss')
    expect(decideOutsidePanelSelection(active, snapshot(1, 6, 11, 'world').identity)).toBe('keep_for_replacement')
  })
})
