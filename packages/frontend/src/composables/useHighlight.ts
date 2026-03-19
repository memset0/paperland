import type { Highlight } from '@paperland/shared'

/**
 * Represents a "virtual" text segment in the rendered DOM.
 * KaTeX elements count as a single atomic segment.
 */
interface TextSegment {
  node: Node          // Text node or KaTeX container element
  offset: number      // Global start offset in rendered text
  length: number      // Character length of this segment
  isAtomic: boolean   // true for KaTeX elements (don't traverse inside)
}

/**
 * Check if a node is a KaTeX container that should be treated atomically.
 */
function isKatexElement(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false
  const el = node as Element
  return el.classList.contains('katex') || el.classList.contains('katex-display')
}

/**
 * Check if a node is inside a KaTeX container.
 */
function isInsideKatex(node: Node): boolean {
  let current = node.parentElement
  while (current) {
    if (current.classList.contains('katex') || current.classList.contains('katex-display')) return true
    current = current.parentElement
  }
  return false
}

/**
 * Walk the DOM tree and build a flat list of text segments.
 * KaTeX elements are treated as atomic (single segment, not traversed into).
 */
export function buildTextSegments(container: HTMLElement): TextSegment[] {
  const segments: TextSegment[] = []
  let offset = 0

  function walk(node: Node) {
    if (isKatexElement(node)) {
      // Treat entire KaTeX element as one atomic segment
      const text = node.textContent || ''
      if (text.length > 0) {
        segments.push({ node, offset, length: text.length, isAtomic: true })
        offset += text.length
      }
      return // Don't traverse children
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || ''
      if (text.length > 0) {
        segments.push({ node, offset, length: text.length, isAtomic: false })
        offset += text.length
      }
      return
    }

    // Recurse into element children
    for (const child of Array.from(node.childNodes)) {
      walk(child)
    }
  }

  walk(container)
  return segments
}

/**
 * Get the total rendered text length of a container.
 */
export function getRenderedTextLength(container: HTMLElement): number {
  const segments = buildTextSegments(container)
  if (segments.length === 0) return 0
  const last = segments[segments.length - 1]
  return last.offset + last.length
}

/**
 * Apply highlights to a rendered DOM container.
 * Walks text segments and wraps matching offset ranges with <mark> elements.
 * Returns the number of highlights successfully applied.
 */
export function applyHighlights(container: HTMLElement, highlights: Highlight[]): number {
  if (highlights.length === 0) return 0

  const segments = buildTextSegments(container)
  if (segments.length === 0) return 0

  // Sort highlights by start_offset to apply in order
  const sorted = [...highlights].sort((a, b) => a.start_offset - b.start_offset)
  let applied = 0

  for (const hl of sorted) {
    // Verify text match
    const extractedText = extractText(segments, hl.start_offset, hl.end_offset)
    if (extractedText !== hl.text) {
      // Text doesn't match — skip this highlight (graceful degradation)
      continue
    }

    // Apply the highlight by wrapping segments
    applyOneHighlight(container, hl)
    // Rebuild segments after DOM modification
    segments.length = 0
    segments.push(...buildTextSegments(container))
    applied++
  }

  return applied
}

/**
 * Extract text from segments between start and end offsets.
 */
function extractText(segments: TextSegment[], start: number, end: number): string {
  let result = ''
  for (const seg of segments) {
    const segEnd = seg.offset + seg.length
    if (segEnd <= start) continue
    if (seg.offset >= end) break

    const sliceStart = Math.max(0, start - seg.offset)
    const sliceEnd = Math.min(seg.length, end - seg.offset)
    const text = seg.isAtomic
      ? (seg.node.textContent || '').slice(sliceStart, sliceEnd)
      : (seg.node.textContent || '').slice(sliceStart, sliceEnd)
    result += text
  }
  return result
}

/**
 * Apply a single highlight to the DOM.
 */
function applyOneHighlight(container: HTMLElement, hl: Highlight) {
  const segments = buildTextSegments(container)

  for (const seg of segments) {
    const segEnd = seg.offset + seg.length
    if (segEnd <= hl.start_offset) continue
    if (seg.offset >= hl.end_offset) break

    // This segment overlaps with the highlight
    const overlapStart = Math.max(0, hl.start_offset - seg.offset)
    const overlapEnd = Math.min(seg.length, hl.end_offset - seg.offset)

    if (seg.isAtomic) {
      // Wrap entire atomic element
      wrapAtomicElement(seg.node as Element, hl)
    } else {
      // Wrap portion of text node
      wrapTextNode(seg.node as Text, overlapStart, overlapEnd, hl)
    }
  }
}

/**
 * Wrap a KaTeX atomic element in a <mark>.
 */
function wrapAtomicElement(element: Element, hl: Highlight) {
  const mark = createMark(hl)
  element.parentNode?.insertBefore(mark, element)
  mark.appendChild(element)
}

/**
 * Wrap a portion of a text node in a <mark>.
 */
function wrapTextNode(textNode: Text, start: number, end: number, hl: Highlight) {
  const text = textNode.textContent || ''
  if (start === 0 && end === text.length) {
    // Wrap entire text node
    const mark = createMark(hl)
    textNode.parentNode?.insertBefore(mark, textNode)
    mark.appendChild(textNode)
  } else {
    // Split and wrap middle portion
    const before = text.slice(0, start)
    const middle = text.slice(start, end)
    const after = text.slice(end)

    const parent = textNode.parentNode!
    if (before) {
      parent.insertBefore(document.createTextNode(before), textNode)
    }
    const mark = createMark(hl)
    mark.textContent = middle
    parent.insertBefore(mark, textNode)
    if (after) {
      parent.insertBefore(document.createTextNode(after), textNode)
    }
    parent.removeChild(textNode)
  }
}

/**
 * Create a <mark> element for a highlight.
 */
function createMark(hl: Highlight): HTMLElement {
  const mark = document.createElement('mark')
  mark.dataset.highlightId = String(hl.id)
  mark.dataset.highlightColor = hl.color
  if (hl.note) mark.dataset.highlightNote = hl.note
  mark.className = `hl-${hl.color}`
  return mark
}

/**
 * Capture the current text selection and map it to rendered text offsets.
 * Auto-expands to full KaTeX elements if boundary falls inside.
 * Returns null if no valid selection within the container.
 */
export function getSelectionOffsets(container: HTMLElement): {
  start_offset: number
  end_offset: number
  text: string
} | null {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)

  // Check if selection is within the container
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
    return null
  }

  const segments = buildTextSegments(container)
  if (segments.length === 0) return null

  let startOffset = findOffset(segments, range.startContainer, range.startOffset)
  let endOffset = findOffset(segments, range.endContainer, range.endOffset)

  if (startOffset === null || endOffset === null || startOffset >= endOffset) return null

  // Expand to full KaTeX elements if boundary falls inside
  ;[startOffset, endOffset] = expandToKatex(segments, startOffset, endOffset)

  // Extract the text for this range
  const text = extractText(segments, startOffset, endOffset)

  if (!text.trim()) return null

  return { start_offset: startOffset, end_offset: endOffset, text }
}

/**
 * Find the global text offset for a DOM position (node + local offset).
 */
function findOffset(segments: TextSegment[], node: Node, localOffset: number): number | null {
  // If the node is inside a KaTeX element, find the KaTeX segment
  if (isInsideKatex(node)) {
    for (const seg of segments) {
      if (seg.isAtomic && (seg.node === node || seg.node.contains(node))) {
        // For atomic segments, local offset within the atomic node
        return seg.offset + Math.min(localOffset, seg.length)
      }
    }
    return null
  }

  // For text nodes, find matching segment
  if (node.nodeType === Node.TEXT_NODE) {
    for (const seg of segments) {
      if (seg.node === node) {
        return seg.offset + Math.min(localOffset, seg.length)
      }
    }
    return null
  }

  // For element nodes (e.g., when offset is child index)
  // Find the position after the Nth child
  if (node.nodeType === Node.ELEMENT_NODE) {
    const children = Array.from(node.childNodes)
    if (localOffset === 0) {
      // Before all children — find first segment within this node
      for (const seg of segments) {
        if (node.contains(seg.node)) return seg.offset
      }
    } else if (localOffset >= children.length) {
      // After all children — find last segment within this node
      for (let i = segments.length - 1; i >= 0; i--) {
        if (node.contains(segments[i].node)) {
          return segments[i].offset + segments[i].length
        }
      }
    } else {
      // Between children — find first segment in the child at localOffset
      const targetChild = children[localOffset]
      for (const seg of segments) {
        if (targetChild.contains(seg.node) || seg.node === targetChild) {
          return seg.offset
        }
      }
    }
  }

  return null
}

/**
 * Expand offset range to include full KaTeX elements if partially overlapping.
 */
function expandToKatex(segments: TextSegment[], start: number, end: number): [number, number] {
  let expandedStart = start
  let expandedEnd = end

  for (const seg of segments) {
    if (!seg.isAtomic) continue
    const segEnd = seg.offset + seg.length

    // If highlight partially overlaps this KaTeX segment, expand
    if (seg.offset < end && segEnd > start) {
      if (seg.offset < expandedStart) expandedStart = seg.offset
      if (segEnd > expandedEnd) expandedEnd = segEnd
    }
  }

  return [expandedStart, expandedEnd]
}

/**
 * Remove all highlight marks from a container (for re-rendering).
 */
export function clearHighlights(container: HTMLElement) {
  const marks = container.querySelectorAll('mark[data-highlight-id]')
  for (const mark of Array.from(marks)) {
    const parent = mark.parentNode
    if (!parent) continue
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark)
    }
    parent.removeChild(mark)
    parent.normalize() // Merge adjacent text nodes
  }
}
