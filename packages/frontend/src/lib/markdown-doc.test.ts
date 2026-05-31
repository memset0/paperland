import { describe, it, expect } from 'bun:test'
import {
  parseNoteDoc, flattenSections, structureKey, sectionBaseline, demoteHeadings,
  reparentSection, insertChild, insertSibling, deleteSection, replaceLeafBody, replacePreamble,
  topLevel, descendantCount, findSection,
} from './markdown-doc'

const DOC = 'Intro text\n\n## A\n\na body\n\n### A1\n\na1\n\n## B\n\nb body'

describe('parseNoteDoc', () => {
  it('extracts the preamble and a relative-depth section tree', () => {
    const t = parseNoteDoc(DOC)
    expect(t.preamble).toBe('Intro text')
    expect(t.sections.map((s) => s.heading)).toEqual(['A', 'B'])
    const a = t.sections[0]
    expect(a.level).toBe(2)
    expect(a.leafBody).toBe('a body')
    expect(a.children.map((s) => s.heading)).toEqual(['A1'])
    expect(a.children[0].level).toBe(3)
    expect(a.children[0].leafBody).toBe('a1')
  })

  it('treats the shallowest heading present as the top level (works with # or ##)', () => {
    const t = parseNoteDoc('# Top\n\nx\n\n## Sub\n\ny')
    expect(t.sections.map((s) => s.heading)).toEqual(['Top'])
    expect(t.sections[0].children.map((s) => s.heading)).toEqual(['Sub'])
    expect(topLevel(t)).toBe(1)
  })

  it('ignores headings inside fenced code blocks', () => {
    const t = parseNoteDoc('## Real\n\n```\n# not a heading\n```\n')
    expect(flattenSections(t).map((s) => s.heading)).toEqual(['Real'])
  })
})

describe('structureKey / sectionBaseline', () => {
  it('structureKey reflects levels + heading text + order, not bodies', () => {
    const a = parseNoteDoc(DOC)
    const b = parseNoteDoc(DOC.replace('a body', 'totally different body'))
    expect(structureKey(a)).toBe(structureKey(b)) // body change → same structure key
    const c = parseNoteDoc(DOC.replace('## B', '## B-renamed'))
    expect(structureKey(a)).not.toBe(structureKey(c)) // heading change → different key
  })

  it('sectionBaseline returns the leaf body of a section', () => {
    const t = parseNoteDoc(DOC)
    expect(sectionBaseline(t, t.sections[0].id)).toBe('a body')
  })
})

describe('demoteHeadings', () => {
  it('demotes ATX headings to bold, leaves fenced code + plain text alone', () => {
    expect(demoteHeadings('# Title\ntext')).toBe('**Title**\ntext')
    expect(demoteHeadings('## A\n### B')).toBe('**A**\n**B**')
    expect(demoteHeadings('```\n# code\n```')).toBe('```\n# code\n```')
    expect(demoteHeadings('plain')).toBe('plain')
  })
})

describe('structural transforms (verified by re-parsing the result)', () => {
  it('reparentSection nests a section under a new parent and re-levels it', () => {
    const t = parseNoteDoc(DOC)
    const b = t.sections[1] // 'B'
    const a = t.sections[0] // 'A'
    const out = reparentSection(DOC, b.id, a.id)!
    expect(out).not.toBeNull()
    const t2 = parseNoteDoc(out)
    expect(t2.sections.map((s) => s.heading)).toEqual(['A']) // B is no longer top-level
    const a2 = t2.sections[0]
    expect(a2.children.map((s) => s.heading)).toContain('B')
    const bMoved = findSection(t2, '')! // ignore; find by heading
    const flat = flattenSections(t2)
    expect(flat.find((s) => s.heading === 'B')!.level).toBe(3)
    expect(flat.find((s) => s.heading === 'B')!.leafBody).toBe('b body')
  })

  it('reparentSection rejects moving a section under its own descendant', () => {
    const t = parseNoteDoc(DOC)
    const a = t.sections[0]
    const a1 = a.children[0]
    expect(reparentSection(DOC, a.id, a1.id)).toBeNull()
  })

  it('reparentSection to top level (null parent) lifts a nested section', () => {
    const t = parseNoteDoc(DOC)
    const a1 = t.sections[0].children[0] // 'A1'
    const out = reparentSection(DOC, a1.id, null)!
    const t2 = parseNoteDoc(out)
    expect(t2.sections.map((s) => s.heading)).toContain('A1')
    expect(flattenSections(t2).find((s) => s.heading === 'A1')!.level).toBe(2)
  })

  it('insertChild adds a sub-heading under a parent', () => {
    const t = parseNoteDoc(DOC)
    const out = insertChild(DOC, t.sections[0].id, 'New Child')
    const t2 = parseNoteDoc(out)
    expect(t2.sections[0].children.map((s) => s.heading)).toContain('New Child')
    expect(flattenSections(t2).find((s) => s.heading === 'New Child')!.level).toBe(3)
  })

  it('insertChild with null parent adds a top-level heading', () => {
    const out = insertChild(DOC, null, 'New Top')
    const t2 = parseNoteDoc(out)
    expect(t2.sections.map((s) => s.heading)).toContain('New Top')
    expect(flattenSections(t2).find((s) => s.heading === 'New Top')!.level).toBe(2)
  })

  it('insertSibling adds a same-level heading after a section', () => {
    const t = parseNoteDoc(DOC)
    const out = insertSibling(DOC, t.sections[0].id, 'A-sibling')!
    const t2 = parseNoteDoc(out)
    expect(flattenSections(t2).find((s) => s.heading === 'A-sibling')!.level).toBe(2)
  })

  it('deleteSection removes a section and its subtree', () => {
    const t = parseNoteDoc(DOC)
    const out = deleteSection(DOC, t.sections[0].id)! // delete A (and A1)
    const t2 = parseNoteDoc(out)
    const headings = flattenSections(t2).map((s) => s.heading)
    expect(headings).not.toContain('A')
    expect(headings).not.toContain('A1')
    expect(headings).toContain('B')
  })

  it('descendantCount counts nested sections', () => {
    const t = parseNoteDoc(DOC)
    expect(descendantCount(t.sections[0])).toBe(1) // A has child A1
    expect(descendantCount(t.sections[1])).toBe(0) // B has none
  })

  it('replaceLeafBody changes only the targeted section body, preserving structure', () => {
    const t = parseNoteDoc(DOC)
    const out = replaceLeafBody(DOC, t.sections[0].id, 'updated body')!
    const t2 = parseNoteDoc(out)
    expect(structureKey(t2)).toBe(structureKey(t)) // structure unchanged
    expect(findSection(t2, t.sections[0].id)!.leafBody).toBe('updated body')
    expect(findSection(t2, t.sections[1].id)!.leafBody).toBe('b body') // sibling untouched
  })

  it('replacePreamble changes only the preamble', () => {
    const out = replacePreamble(DOC, 'New intro')
    const t2 = parseNoteDoc(out)
    expect(t2.preamble).toBe('New intro')
    expect(t2.sections.map((s) => s.heading)).toEqual(['A', 'B'])
  })
})
