/**
 * Heading-section model for the single note document.
 *
 * A note is one Markdown string. Its mind-map and walkthrough are DERIVED from this string's
 * ATX headings:
 *  - parse → a tree of sections (relative heading depth → hierarchy; leaf body = the text from a
 *    heading up to the next heading; preamble = text before the first heading),
 *  - structural transforms rewrite the raw string minimally (untouched text is byte-preserved),
 *  - fingerprints back the concurrency guard (structure key + per-section content baseline),
 *  - and a leaf-only normalizer demotes any heading typed in a floating window to bold so a
 *    window can never change document structure.
 *
 * Pure functions only (no Vue, no DOM) so this is independently unit-testable.
 */
import type { NoteSection, NoteDocTree, CharRange } from '@paperland/shared'

const FENCE_RE = /^(\s*)(```+|~~~+)/
const HEADING_RE = /^(#{1,6})[ \t]+(.*)$/

interface RawLine { text: string; start: number; end: number } // end = index of the newline (or length)
interface HeadingLine { level: number; text: string; lineStart: number; lineEnd: number; contentStart: number }

/** Split into lines keeping each line's [start, end) offsets in the original string. */
function splitLines(md: string): RawLine[] {
  const out: RawLine[] = []
  let start = 0
  for (let i = 0; i <= md.length; i++) {
    if (i === md.length || md[i] === '\n') {
      out.push({ text: md.slice(start, i), start, end: i })
      start = i + 1
    }
  }
  return out
}

/** Locate every ATX heading line outside fenced code blocks. */
function findHeadings(md: string): HeadingLine[] {
  const lines = splitLines(md)
  const out: HeadingLine[] = []
  let inFence = false
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]
    if (FENCE_RE.test(ln.text)) { inFence = !inFence; continue }
    if (inFence) continue
    const m = HEADING_RE.exec(ln.text)
    if (!m) continue
    out.push({
      level: m[1].length,
      text: m[2].trim(),
      lineStart: ln.start,
      lineEnd: ln.end,
      contentStart: i + 1 < lines.length ? lines[i + 1].start : md.length,
    })
  }
  return out
}

/** Strip leading blank lines and all trailing whitespace (preserves the first content line's indent). */
function trimBlock(s: string): string {
  return s.replace(/^(?:[ \t]*\n)+/, '').replace(/\s+$/, '')
}

/**
 * Parse a Markdown string into the heading-section tree. Hierarchy follows RELATIVE heading
 * depth: a stack assigns each heading as a child of the nearest shallower heading, so the
 * document works whether top-level headings are `#` or `##`.
 */
export function parseNoteDoc(md: string): NoteDocTree {
  const heads = findHeadings(md)
  const firstStart = heads.length ? heads[0].lineStart : md.length
  const preambleRaw = md.slice(0, firstStart)
  const preambleRange: CharRange = { start: 0, end: firstStart }

  const sections: NoteSection[] = []
  const stack: NoteSection[] = []
  const counters: number[] = [] // per-depth child counters for stable ids

  for (let i = 0; i < heads.length; i++) {
    const h = heads[i]
    const bodyEnd = i + 1 < heads.length ? heads[i + 1].lineStart : md.length
    const leafRaw = md.slice(h.contentStart, bodyEnd)

    const node: NoteSection = {
      id: '',
      level: h.level,
      heading: h.text,
      leafBody: trimBlock(leafRaw),
      headingRange: { start: h.lineStart, end: h.lineEnd },
      bodyRange: { start: h.contentStart, end: bodyEnd },
      children: [],
    }

    while (stack.length && stack[stack.length - 1].level >= h.level) stack.pop()
    if (stack.length === 0) {
      counters[0] = (counters[0] ?? 0) + 1
      node.id = String(counters[0] - 1)
      sections.push(node)
    } else {
      const parent = stack[stack.length - 1]
      node.id = `${parent.id}.${parent.children.length}`
      parent.children.push(node)
    }
    stack.push(node)
  }

  return { preamble: trimBlock(preambleRaw), preambleRange, sections }
}

/** Depth-first list of all sections (parents before children). */
export function flattenSections(tree: NoteDocTree): NoteSection[] {
  const out: NoteSection[] = []
  const walk = (nodes: NoteSection[]) => { for (const n of nodes) { out.push(n); walk(n.children) } }
  walk(tree.sections)
  return out
}

/** Find a section by id within a parsed tree. */
export function findSection(tree: NoteDocTree, id: string): NoteSection | null {
  return flattenSections(tree).find((s) => s.id === id) ?? null
}

/** The full text range of a section's subtree (its heading through its deepest descendant's body). */
function subtreeRange(tree: NoteDocTree, section: NoteSection): CharRange {
  const flat = flattenSections(tree)
  // The subtree ends where the next section at a level <= section.level begins.
  const ordered = flat.filter((s) => s.headingRange.start > section.headingRange.start)
  const next = ordered.find((s) => s.level <= section.level)
  return { start: section.headingRange.start, end: next ? next.headingRange.start : endOfDoc(tree) }
}

function endOfDoc(tree: NoteDocTree): number {
  const flat = flattenSections(tree)
  if (!flat.length) return tree.preambleRange.end
  return Math.max(...flat.map((s) => s.bodyRange.end))
}

// ── Fingerprints (concurrency guard, per design D7) ──

/** Canonical key of the heading STRUCTURE only (levels + heading text + order). Excludes bodies. */
export function structureKey(tree: NoteDocTree): string {
  const flat = flattenSections(tree)
  return flat.map((s) => `${s.level}:${s.heading}`).join('\n')
}

/** Baseline of a single section's leaf body (the only content a floating window may edit). */
export function sectionBaseline(tree: NoteDocTree, id: string): string | null {
  const s = findSection(tree, id)
  return s ? s.leafBody : null
}

// ── Content-node extraction: leading blockquotes of a content block ──

/**
 * Return the inner Markdown of each LEADING consecutive blockquote block of a content block
 * (a section's leaf body or the preamble). Leading blank lines are ignored; scanning stops at
 * the first non-blank, non-blockquote line. Consecutive blockquote blocks separated by blank
 * lines yield separate entries. Each entry has the per-line `> ` prefix stripped. Used by the
 * mind-map to surface read-only content nodes (text / image / formula).
 */
export function leadingBlockquotes(content: string): string[] {
  const blocks: string[] = []
  let cur: string[] | null = null
  for (const line of content.split('\n')) {
    const m = /^\s*>\s?(.*)$/.exec(line)
    if (m) {
      if (cur === null) cur = []
      cur.push(m[1])
    } else if (line.trim() === '') {
      if (cur) { blocks.push(cur.join('\n')); cur = null } // blank ends a block (leading blanks skipped)
    } else {
      break // first non-blank, non-blockquote line ends the leading region
    }
  }
  if (cur) blocks.push(cur.join('\n'))
  return blocks.map((b) => b.trim()).filter((b) => b !== '')
}

// ── Leaf-only normalizer: a floating window may never introduce headings ──

/** Demote any ATX heading line to bold so window edits can't change document structure. */
export function demoteHeadings(text: string): string {
  const lines = text.split('\n')
  let inFence = false
  return lines.map((line) => {
    if (FENCE_RE.test(line)) { inFence = !inFence; return line }
    if (inFence) return line
    const m = HEADING_RE.exec(line)
    if (!m) return line
    const inner = m[2].trim()
    return inner ? `**${inner}**` : ''
  }).join('\n')
}

// ── Structural transforms (return new raw text; untouched text is byte-preserved) ──

/** Shift every heading line in a block by `delta` levels (clamped 1..6), respecting code fences. */
function shiftHeadings(block: string, delta: number): string {
  if (delta === 0) return block
  const lines = block.split('\n')
  let inFence = false
  return lines.map((line) => {
    if (FENCE_RE.test(line)) { inFence = !inFence; return line }
    if (inFence) return line
    const m = HEADING_RE.exec(line)
    if (!m) return line
    const lvl = Math.min(6, Math.max(1, m[1].length + delta))
    return `${'#'.repeat(lvl)} ${m[2].trim()}`
  }).join('\n')
}

/** The shallowest top-level heading level in the document (defaults to 2 when empty). */
export function topLevel(tree: NoteDocTree): number {
  return tree.sections.length ? Math.min(...tree.sections.map((s) => s.level)) : 2
}

function blockText(md: string, range: CharRange): string {
  return md.slice(range.start, range.end)
}

/** Normalize a moved/inserted block so it ends with exactly one blank-line separator. */
function withTrailingGap(block: string): string {
  return block.replace(/\s*$/, '') + '\n\n'
}

/**
 * Reparent a section's subtree under `newParentId` (or to the top level when null), placed at
 * the end of the target's children. The moved subtree's root heading is re-leveled to fit, and
 * all its descendants shift by the same delta. Returns the new document string, or null if the
 * move is invalid (unknown section/parent, or moving a section under its own descendant).
 */
export function reparentSection(md: string, sectionId: string, newParentId: string | null): string | null {
  const tree = parseNoteDoc(md)
  const section = findSection(tree, sectionId)
  if (!section) return null
  // Reject moving under self/descendant.
  if (newParentId === sectionId) return null
  if (newParentId != null && (newParentId === sectionId || newParentId.startsWith(sectionId + '.'))) return null

  const parent = newParentId != null ? findSection(tree, newParentId) : null
  if (newParentId != null && !parent) return null

  const range = subtreeRange(tree, section)
  const movedRaw = blockText(md, range)
  const newRootLevel = parent ? Math.min(6, parent.level + 1) : topLevel(tree)
  const moved = withTrailingGap(shiftHeadings(movedRaw.replace(/\s*$/, ''), newRootLevel - section.level))

  // Remove the moved block.
  const without = md.slice(0, range.start) + md.slice(range.end)

  // Re-parse the remaining doc to find the insertion point (end of the target's subtree, or end).
  const tree2 = parseNoteDoc(without)
  let insertAt: number
  if (parent) {
    const p2 = findSection(tree2, idByHeadingPath(tree2, parent)) ?? findByHeading(tree2, parent)
    insertAt = p2 ? subtreeRange(tree2, p2).end : without.length
  } else {
    insertAt = without.length
  }
  const before = without.slice(0, insertAt).replace(/\s*$/, '')
  const after = without.slice(insertAt)
  const joined = (before ? before + '\n\n' : '') + moved.replace(/\s*$/, '') + (after ? '\n\n' + after.replace(/^\s*/, '') : '\n')
  return joined.replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '\n')
}

/** Best-effort re-locate a section in a re-parsed tree by matching level + heading + order. */
function findByHeading(tree: NoteDocTree, like: NoteSection): NoteSection | null {
  return flattenSections(tree).find((s) => s.level === like.level && s.heading === like.heading) ?? null
}
function idByHeadingPath(tree: NoteDocTree, like: NoteSection): string {
  return findByHeading(tree, like)?.id ?? '__none__'
}

/** Insert a new child heading at the end of `parentId`'s children (or at the top level if null). */
export function insertChild(md: string, parentId: string | null, headingText: string): string {
  const tree = parseNoteDoc(md)
  const parent = parentId != null ? findSection(tree, parentId) : null
  const level = parent ? Math.min(6, parent.level + 1) : topLevel(tree)
  const heading = `${'#'.repeat(level)} ${headingText}`
  if (parent) {
    const end = subtreeRange(tree, parent).end
    const before = md.slice(0, end).replace(/\s*$/, '')
    const after = md.slice(end)
    return (before + '\n\n' + heading + (after ? '\n\n' + after.replace(/^\s*/, '') : '\n')).replace(/\n{3,}/g, '\n\n')
  }
  // Top level: append at the end of the document.
  const before = md.replace(/\s*$/, '')
  return (before ? before + '\n\n' : '') + heading + '\n'
}

/** Insert a new sibling heading immediately after `sectionId`'s subtree, at the same level. */
export function insertSibling(md: string, sectionId: string, headingText: string): string | null {
  const tree = parseNoteDoc(md)
  const section = findSection(tree, sectionId)
  if (!section) return null
  const heading = `${'#'.repeat(section.level)} ${headingText}`
  const end = subtreeRange(tree, section).end
  const before = md.slice(0, end).replace(/\s*$/, '')
  const after = md.slice(end)
  return (before + '\n\n' + heading + (after ? '\n\n' + after.replace(/^\s*/, '') : '\n')).replace(/\n{3,}/g, '\n\n')
}

/** Delete a section and its entire subtree (heading + leaf body + descendants). */
export function deleteSection(md: string, sectionId: string): string | null {
  const tree = parseNoteDoc(md)
  const section = findSection(tree, sectionId)
  if (!section) return null
  const range = subtreeRange(tree, section)
  const out = md.slice(0, range.start) + md.slice(range.end)
  return out.replace(/\n{3,}/g, '\n\n').replace(/^\s+/, '').replace(/\s+$/, (m) => (m ? '\n' : m))
}

/** Count the descendant sections of a section (for the delete confirmation). */
export function descendantCount(section: NoteSection): number {
  let n = 0
  const walk = (nodes: NoteSection[]) => { for (const c of nodes) { n++; walk(c.children) } }
  walk(section.children)
  return n
}

/** Replace a section's leaf body with new (already heading-demoted) text. Byte-preserves the rest. */
export function replaceLeafBody(md: string, sectionId: string, newLeaf: string): string | null {
  const tree = parseNoteDoc(md)
  const section = findSection(tree, sectionId)
  if (!section) return null
  const before = md.slice(0, section.bodyRange.start)
  const after = md.slice(section.bodyRange.end)
  const body = newLeaf.trim() ? '\n' + newLeaf.replace(/^\n+/, '').replace(/\s+$/, '') + '\n' : '\n'
  return before.replace(/[ \t]+$/, '') + body + (after.startsWith('\n') ? after.slice(1) : after)
}

/** Rename a section's heading text (keeps its level + body). Structural edit. */
export function renameSection(md: string, sectionId: string, newHeading: string): string | null {
  const tree = parseNoteDoc(md)
  const section = findSection(tree, sectionId)
  if (!section) return null
  const heading = `${'#'.repeat(section.level)} ${newHeading.trim().replace(/\n/g, ' ') || '(untitled)'}`
  return md.slice(0, section.headingRange.start) + heading + md.slice(section.headingRange.end)
}

/** Replace the preamble (text before the first heading). */
export function replacePreamble(md: string, newPreamble: string): string {
  const tree = parseNoteDoc(md)
  const after = md.slice(tree.preambleRange.end)
  const pre = newPreamble.trim() ? newPreamble.replace(/\s+$/, '') + '\n\n' : ''
  return (pre + after).replace(/\n{3,}/g, '\n\n')
}
