import { describe, expect, test } from 'bun:test'
import {
  createPdfSelectionSnapshot,
  decideOutsidePanelSelection,
  placeSelectionPanel,
  selectPdfTranslationPanelText, createMultiPageSelectionSnapshot, isMultiPageSelection } from './pdf-selection-translation'

const rect = { left: 100, top: 200, right: 180, bottom: 220, width: 80, height: 20 }

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

  test('dismisses a plain outside click but keeps a different selection for the toolbar', () => {
    const active = snapshot().identity
    expect(decideOutsidePanelSelection(active, null)).toBe('dismiss')
    expect(decideOutsidePanelSelection(active, active)).toBe('dismiss')
    expect(decideOutsidePanelSelection(active, snapshot(1, 6, 11, 'world').identity)).toBe('keep_for_new_selection')
  })

  test('shows source for initial and retry waits, then follows stream and cache output', () => {
    const source = 'hello, world'
    expect(selectPdfTranslationPanelText(source, '')).toBe(source)
    expect(selectPdfTranslationPanelText(source, '你好')).toBe('你好')
    expect(selectPdfTranslationPanelText(source, '你好，世界')).toBe('你好，世界')
    expect(selectPdfTranslationPanelText(source, '')).toBe(source)
    expect(selectPdfTranslationPanelText(source, '缓存译文')).toBe('缓存译文')
  })
})

describe('multi-page selection snapshot', () => {
  const rect = { left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }
  test('keeps one segment per page and joins the text', () => {
    const snapshot = createMultiPageSelectionSnapshot([
      { page: 3, ts: 100, te: 140, text: 'end of page three ' },
      { page: 4, ts: 0, te: 20, text: ' start of four' },
    ], rect)!
    expect(snapshot.segments.map((segment) => segment.page)).toEqual([3, 4])
    expect(snapshot.text).toBe('end of page three start of four')
    expect(isMultiPageSelection(snapshot)).toBe(true)
  })

  test('a single valid segment is not a multi-page selection', () => {
    expect(createMultiPageSelectionSnapshot([{ page: 3, ts: 0, te: 5, text: 'x' }, { page: 4, ts: 0, te: 0, text: '' }], rect)).toBeNull()
  })
})
