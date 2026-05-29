import { ref, nextTick } from 'vue'
import SparkMD5 from 'spark-md5'
import { toast } from 'vue-sonner'
import { useQAStore } from '@/stores/qa'
import { buildTextSegments } from '@/composables/useHighlight'

/**
 * Shared anchor-jump state.
 *
 * `requestedResultId` is the qa_result id that a `paperland://` jump wants shown.
 * `QAResultView` watches it and activates the matching answer tab (result ids are
 * globally unique, so only the owning view reacts). It is the "externally settable
 * activeTab" the locate flow relies on when a target answer sits in an inactive tab.
 */
export const requestedResultId = ref<number | null>(null)

export interface AnchorRange {
  start: number
  end: number
}

/** Hash a string the same way `MarkdownContent` does (MD5 of whitespace-stripped text). */
function hashContent(text: string): string {
  return SparkMD5.hash((text || '').replace(/\s/g, ''))
}

/** Among elements matching `selector`, return the first rendered (visible) one. */
function visibleEl(selector: string): HTMLElement | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>(selector))
  return els.find((el) => el.getClientRects().length > 0) ?? els[0] ?? null
}

/** Scroll a block into view and transiently flash it (no persisted `<mark>`). */
function flashBlock(el: HTMLElement) {
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.remove('block-anchor-flash')
  void el.offsetWidth // force reflow so the animation restarts on repeat jumps
  el.classList.add('block-anchor-flash')
  window.setTimeout(() => el.classList.remove('block-anchor-flash'), 1600)
}

/** Wrap a rendered-text offset range in transient `<mark>`s (reusing highlight segments). */
function highlightRange(blockEl: HTMLElement, start: number, end: number): HTMLElement[] {
  const segments = buildTextSegments(blockEl)
  const marks: HTMLElement[] = []
  for (const seg of segments) {
    const segEnd = seg.offset + seg.length
    if (segEnd <= start) continue
    if (seg.offset >= end) break
    if (seg.isAtomic) {
      const m = document.createElement('mark')
      m.className = 'block-anchor-range'
      seg.node.parentNode?.insertBefore(m, seg.node)
      m.appendChild(seg.node)
      marks.push(m)
    } else {
      const node = seg.node as Text
      const text = node.textContent || ''
      const os = Math.max(0, start - seg.offset)
      const oe = Math.min(seg.length, end - seg.offset)
      const parent = node.parentNode
      if (!parent || os >= oe) continue
      if (os > 0) parent.insertBefore(document.createTextNode(text.slice(0, os)), node)
      const m = document.createElement('mark')
      m.className = 'block-anchor-range'
      m.textContent = text.slice(os, oe)
      parent.insertBefore(m, node)
      if (oe < text.length) parent.insertBefore(document.createTextNode(text.slice(oe)), node)
      parent.removeChild(node)
      marks.push(m)
    }
  }
  return marks
}

/** Unwrap transient range marks, restoring the original text nodes. */
function unwrapMarks(marks: HTMLElement[]) {
  for (const m of marks) {
    const parent = m.parentNode
    if (!parent) continue
    while (m.firstChild) parent.insertBefore(m.firstChild, m)
    parent.removeChild(m)
    parent.normalize()
  }
}

/** Scroll to a block; highlight the sub-range when given, otherwise flash the whole block. */
function reveal(el: HTMLElement, range?: AnchorRange | null) {
  if (range && range.end > range.start) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const marks = highlightRange(el, range.start, range.end)
    if (marks.length) {
      window.setTimeout(() => unwrapMarks(marks), 1800)
      return
    }
  }
  flashBlock(el)
}

/** Poll for an element (it may mount after a collapsible expands / a tab activates). */
function waitForEl(getter: () => HTMLElement | null, timeoutMs = 1500): Promise<HTMLElement | null> {
  const start = Date.now()
  return new Promise((resolve) => {
    function tick() {
      const el = getter()
      if (el) return resolve(el)
      if (Date.now() - start > timeoutMs) return resolve(null)
      requestAnimationFrame(tick)
    }
    tick()
  })
}

export function useBlockAnchor() {
  const qa = useQAStore()

  /** Find which Q&A entry/result owns a block hash by recomputing answer hashes. */
  function findResultByHash(hash: string): { entryKey: string; resultId: number } | null {
    for (const [name, entry] of Object.entries(qa.qaData.template)) {
      for (const r of entry.results) {
        if (hashContent(r.answer) === hash) return { entryKey: 'tmpl-' + name, resultId: r.id }
      }
    }
    for (const entry of qa.qaData.free) {
      for (const r of entry.results) {
        if (hashContent(r.answer) === hash) return { entryKey: 'free-' + entry.entry_id, resultId: r.id }
      }
    }
    return null
  }

  /**
   * Reveal and flash the block addressed by `hash`.
   *  1. already in the DOM            → scroll + flash
   *  2. inside a collapsed/inactive Q&A answer → expand entry, activate its tab, then locate
   *  3. nowhere (answer deleted)      → stale notice, no jump
   *
   * `range` (within-block offsets) is accepted for forward-compat; P1 flashes the whole block.
   */
  async function locateBlock(_paperId: number, hash: string | null, range?: AnchorRange | null) {
    if (!hash) return // page-only anchor: navigation is the caller's responsibility

    const direct = visibleEl(`[data-content-hash="${hash}"]`)
    if (direct) {
      reveal(direct, range)
      return
    }

    const found = findResultByHash(hash)
    if (found) {
      const trigger = visibleEl(`[data-qa-entry="${found.entryKey}"]`)
      if (trigger && trigger.getAttribute('data-state') === 'closed') trigger.click()
      requestedResultId.value = found.resultId
      await nextTick()
      const el = await waitForEl(() => visibleEl(`[data-content-hash="${hash}"]`))
      if (el) {
        reveal(el, range)
        return
      }
    }

    toast.error('Anchor is stale — the referenced answer may have been deleted.')
  }

  return { locateBlock }
}
