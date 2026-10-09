import type { ResearchPaperList, S2PaperMeta } from '@paperland/shared'
import { extractPaperListBlock, parseAndVerifyAnswer, reportOf, type ParsedAnswer, type ParseFailure } from './paperlist.js'
import { resolveS2Ids } from './s2_paper_cache.js'

// Single boundary between Deep Research runtime/API and the paper-list format. The list is stored
// as opaque JSON (`research_steps.paper_list`); everything that needs to know its shape — parsing a
// finished answer, showing it to the agent, and owner title edits — goes through this module, so
// the format can be replaced without touching the runtime, routes, or prompt assembly.

export type { ParsedAnswer as ParsedRoundAnswer, ParseFailure } from './paperlist.js'

/** Parse + verify a finished agent answer into a version (report + list), or a parse failure. */
export function parseRoundAnswer(answer: string): Promise<ParsedAnswer> {
  return parseAndVerifyAnswer(answer)
}

/** Escape text for XML attribute values and element content. */
export function xmlEscape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function attrs(values: Record<string, string | number | boolean | null | undefined>): string {
  return Object.entries(values)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => ` ${k}="${xmlEscape(String(v))}"`)
    .join('')
}

/**
 * The list as shown to the agent inside `<current_version>`: XML-style, every paper enriched with
 * the S2 metadata the system fetched (title, authors, year, venue, arXiv id, citation count, TLDR,
 * abstract truncated to `abstractLimit`). Unverified papers carry `verified="false"` and only their
 * id and comment, so the agent can correct or drop them.
 */
export async function renderListForPrompt(list: ResearchPaperList, abstractLimit: number): Promise<string> {
  const ids = [...new Set(list.sections.flatMap((s) => s.items).flatMap((i) => i.kind === 'paper' ? [i.s2_id] : []))]
  const meta = new Map<string, S2PaperMeta>()
  if (ids.length) {
    const results = await resolveS2Ids(ids, { allowFetch: true })
    results.forEach((r, i) => { if (r.status === 'resolved' && r.paper) meta.set(ids[i], r.paper) })
  }
  const lines = [`<paper_list${attrs({ title: list.title })}>`]
  list.sections.forEach((section, si) => {
    lines.push(`  <section${attrs({ index: si + 1, title: section.title })}>`)
    if (section.description) lines.push(`    <description>${xmlEscape(section.description)}</description>`)
    for (const item of section.items) {
      if (item.kind === 'paper') {
        const p = item.verification === 'verified' ? meta.get(item.s2_id) : undefined
        if (!p) {
          lines.push(`    <paper${attrs({ s2_id: item.s2_id, verified: 'false' })}>`)
        } else {
          lines.push(`    <paper${attrs({ s2_id: item.s2_id, verified: 'true', arxiv_id: p.arxiv_id, year: p.year, venue: p.venue, citation_count: p.citation_count })}>`)
          if (p.title) lines.push(`      <title>${xmlEscape(p.title)}</title>`)
          if (p.authors.length) lines.push(`      <authors>${xmlEscape(p.authors.join(', '))}</authors>`)
          if (p.tldr) lines.push(`      <tldr>${xmlEscape(p.tldr)}</tldr>`)
          if (p.abstract) {
            const truncated = p.abstract.length > abstractLimit
            const text = truncated ? `${p.abstract.slice(0, abstractLimit)}…` : p.abstract
            lines.push(`      <abstract${attrs({ truncated: truncated ? 'true' : null })}>${xmlEscape(text)}</abstract>`)
          }
        }
        if (item.comment) lines.push(`      <comment>${xmlEscape(item.comment)}</comment>`)
        lines.push('    </paper>')
      } else {
        const c = item.citation
        lines.push(`    <link${attrs({ url: item.url })}>`)
        lines.push(`      <citation${attrs({ title: c.title, author: c.author?.join(' and '), year: c.year, month: c.month, howpublished: c.howpublished, note: c.note })}/>`)
        if (item.comment) lines.push(`      <comment>${xmlEscape(item.comment)}</comment>`)
        lines.push('    </link>')
      }
    }
    lines.push('  </section>')
  })
  lines.push('</paper_list>')
  return lines.join('\n')
}

/**
 * The answer to parse after a repair request. A list-only repair keeps the original report and
 * takes the repaired `paperlist` block (a bare JSON reply is accepted too); a missing-report
 * repair replaces the whole answer.
 */
export function mergeRepairedAnswer(original: string, repair: string, failure: ParseFailure): string {
  if (failure === 'missing_report') return repair
  const block = extractPaperListBlock(repair)
  const json = block ? block.json : repair.trim()
  return `${reportOf(original)}\n\n\`\`\`paperlist\n${json}\n\`\`\``
}

/** Title of a list version (used as the session's display title). */
export function listTitle(list: ResearchPaperList): string {
  return list.title
}

export function listSectionTitles(list: ResearchPaperList): string[] {
  return list.sections.map((section) => section.title)
}

export class TitleEditError extends Error {}

/**
 * Copy of `list` with only its list title and section titles replaced. Throws {@link TitleEditError}
 * for empty titles or a section-title count that does not match the list.
 */
export function applyTitleEdit(list: ResearchPaperList, title: string, sectionTitles: string[]): ResearchPaperList {
  const trimmed = title.trim()
  if (!trimmed) throw new TitleEditError('List title must not be empty')
  if (sectionTitles.length !== list.sections.length) {
    throw new TitleEditError(`Expected ${list.sections.length} section titles, got ${sectionTitles.length}`)
  }
  const sections = list.sections.map((section, i) => {
    const sectionTitle = sectionTitles[i].trim()
    if (!sectionTitle) throw new TitleEditError(`Section ${i + 1} title must not be empty`)
    return { ...section, title: sectionTitle }
  })
  return { ...list, title: trimmed, sections }
}

/** Human-readable summary of a title edit, for the timeline and the agent's `<history>`. */
export function describeTitleEdit(before: ResearchPaperList, after: ResearchPaperList): string {
  const changes: string[] = []
  if (before.title !== after.title) changes.push(`list title "${before.title}" → "${after.title}"`)
  after.sections.forEach((section, i) => {
    const old = before.sections[i]?.title
    if (old !== undefined && old !== section.title) changes.push(`section ${i + 1} "${old}" → "${section.title}"`)
  })
  return changes.length ? changes.join('; ') : 'no title changes'
}
