import type { ResearchListItem, ResearchListSection, ResearchPaperList } from '@paperland/shared'
import type { PaperRefSection, RefItem } from '@/components/PaperRefList.vue'

// Frontend boundary for the Deep Research paper-list format (mirrors backend
// services/research_list.ts). Views only touch the list through these helpers, so the format can
// change without rewriting them.

const BLOCK_START = '```paperlist'

/**
 * Split a streaming (partial) agent answer for display: the report text to render progressively,
 * and whether the list block has started. Text after a closed block is kept; an unclosed block is
 * hidden entirely.
 */
export function splitStreamingAnswer(answer: string): { report: string; generatingList: boolean } {
  const start = answer.indexOf(BLOCK_START)
  if (start < 0) return { report: answer, generatingList: false }
  const afterStart = answer.indexOf('\n', start)
  const end = afterStart < 0 ? -1 : answer.indexOf('```', afterStart + 1)
  const before = answer.slice(0, start)
  if (end < 0) return { report: before, generatingList: true }
  return { report: `${before}${answer.slice(end + 3)}`, generatingList: true }
}

export function listTitle(list: ResearchPaperList): string {
  return list.title
}

export function sectionTitles(list: ResearchPaperList): string[] {
  return list.sections.map((s) => s.title)
}

/** Version-comparison key of an item: papers by S2 id, links by normalized URL. */
export function itemKey(item: ResearchListItem): string {
  if (item.kind === 'paper') return `paper:${item.s2_id.toLowerCase()}`
  try {
    const u = new URL(item.url)
    return `link:${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, '')}${u.search}`
  } catch {
    return `link:${item.url.trim()}`
  }
}

/** A list item as a PaperRefList row. */
export function toRefItem(item: ResearchListItem, added = false): RefItem {
  return item.kind === 'paper'
    ? { kind: 'paper', id: item.s2_id, comment: item.comment, unverified: item.verification === 'unverified', added }
    : { kind: 'link', url: item.url, citation: item.citation, comment: item.comment, added }
}

/**
 * Match each section to its counterpart in the previous version: same position and title, else the
 * same title elsewhere, else the same position (a renamed section). Unmatched → null.
 */
function matchSections(current: ResearchListSection[], previous: ResearchListSection[]): Array<ResearchListSection | null> {
  const used = new Set<number>()
  const take = (i: number) => { used.add(i); return previous[i] }
  const result: Array<ResearchListSection | null> = current.map((s, i) =>
    previous[i] && previous[i].title === s.title ? take(i) : null)
  current.forEach((s, i) => {
    if (result[i]) return
    const j = previous.findIndex((p, k) => !used.has(k) && p.title === s.title)
    if (j >= 0) result[i] = take(j)
  })
  current.forEach((_, i) => {
    if (!result[i] && previous[i] && !used.has(i)) result[i] = take(i)
  })
  return result
}

/**
 * Sections for display. With a previous version, each section's new items are marked added and
 * items dropped from it are returned as `removed` (computed per section).
 */
export function sectionsForDisplay(list: ResearchPaperList, previous?: ResearchPaperList | null): PaperRefSection[] {
  const matches = previous ? matchSections(list.sections, previous.sections) : list.sections.map(() => null)
  return list.sections.map((section, i) => {
    const before = matches[i]
    const beforeKeys = new Set(before?.items.map(itemKey) ?? [])
    const nowKeys = new Set(section.items.map(itemKey))
    return {
      title: section.title,
      description: section.description,
      items: section.items.map((item) => toRefItem(item, !!previous && !beforeKeys.has(itemKey(item)))),
      removed: before ? before.items.filter((item) => !nowKeys.has(itemKey(item))).map((item) => toRefItem(item)) : [],
    }
  })
}
