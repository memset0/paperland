import { z } from 'zod'
import type { ResearchListItem, ResearchListSection, ResearchPaperList } from '@paperland/shared'
import { parseS2Input } from '../utils/s2_ids.js'
import { resolveS2Ids } from './s2_paper_cache.js'

// Deep Research answers = a Markdown report + one fenced ```paperlist block of JSON (see
// prompts/system/research.md). Paper items carry only an S2 paperId (+ Markdown comment) — their
// metadata comes from the S2 cache — and non-paper links carry a BibTeX @misc-style citation.
// A version needs both the report and a valid list.

const BLOCK_RE = /```paperlist[^\S\n]*\n([\s\S]*?)\n?```/g

const citationSchema = z.object({
  title: z.string().trim().min(1),
  author: z.array(z.string()).optional(),
  year: z.number().int().optional(),
  month: z.string().optional(),
  howpublished: z.string().optional(),
  note: z.string().optional(),
})

// Extra fields (e.g. a title the agent added to a paper item) are stripped by zod's default object
// parsing; an item must carry exactly one of `s2_id` / `url`.
const itemSchema = z.object({
  s2_id: z.string().trim().min(1).optional(),
  url: z.string().trim().url().refine((u) => /^https?:\/\//i.test(u), 'url must be http(s)').optional(),
  citation: citationSchema.optional(),
  comment: z.string().optional(),
}).superRefine((item, ctx) => {
  if (!!item.s2_id === !!item.url) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'an item needs exactly one of s2_id or url' })
  }
  if (item.url && !item.citation) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'a url item needs a citation' })
  }
})

const listSchema = z.object({
  title: z.string().trim().min(1),
  changes: z.string().optional(),
  sections: z.array(z.object({
    title: z.string().trim().min(1),
    description: z.string().optional(),
    items: z.array(itemSchema),
  })),
})

/** Why an answer did not produce a version (drives the repair request). */
export type ParseFailure = 'missing_list' | 'invalid_list' | 'missing_report'

export interface ParsedAnswer {
  /** The answer without the `paperlist` block (trimmed); null when no version was produced. */
  report: string | null
  changes_note: string | null
  /** Verified list, or null when no version was produced. */
  paper_list: ResearchPaperList | null
  parse_error: string | null
  failure: ParseFailure | null
}

/** Last ```paperlist block in an answer, with the text around it. */
export function extractPaperListBlock(answer: string): { json: string; report: string } | null {
  let last: RegExpExecArray | null = null
  for (const match of answer.matchAll(BLOCK_RE)) last = match as RegExpExecArray
  if (!last) return null
  const report = (answer.slice(0, last.index) + answer.slice(last.index + last[0].length))
    .replace(/\n{3,}/g, '\n\n').trim()
  return { json: last[1], report }
}

/** The answer's report part: everything except the last paperlist block (or the whole answer). */
export function reportOf(answer: string): string {
  return extractPaperListBlock(answer)?.report ?? answer.trim()
}

/** Normalized key of a link, for de-duplication and version comparison. */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    const path = u.pathname.replace(/\/+$/, '')
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`
  } catch {
    return url.trim()
  }
}

/** The normalized id we store for an agent-supplied `s2_id` (40-hex lowercase, or `CorpusId:<n>`). */
function normalizeS2Id(raw: string): string {
  const parsed = parseS2Input(raw)
  if (parsed?.s2_paper_id) return parsed.s2_paper_id
  if (parsed?.corpus_id) return `CorpusId:${parsed.corpus_id}`
  return raw.trim()
}

function failed(failure: ParseFailure, parse_error: string): ParsedAnswer {
  return { report: null, changes_note: null, paper_list: null, parse_error, failure }
}

/**
 * Parse and verify a finished round's answer. Paper ids are resolved in one batch through the S2
 * cache (with fetching); ids that do not resolve are kept as `unverified` (no title matching).
 * Duplicates are dropped within a section only — the same item may appear in several sections.
 */
export async function parseAndVerifyAnswer(answer: string): Promise<ParsedAnswer> {
  const block = extractPaperListBlock(answer)
  const report = block ? block.report : answer.trim()
  if (!block) return failed(report ? 'missing_list' : 'missing_report', 'No paperlist block in the answer')

  let raw: unknown
  try {
    raw = JSON.parse(block.json)
  } catch (err: any) {
    return failed(report ? 'invalid_list' : 'missing_report', `Invalid paperlist JSON: ${err?.message || err}`)
  }
  const parsed = listSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return failed(report ? 'invalid_list' : 'missing_report', `Invalid paperlist: ${issue.path.join('.') || '(root)'}: ${issue.message}`)
  }
  if (!report) return failed('missing_report', 'The answer has a paper list but no report')

  const ids = [...new Set(parsed.data.sections.flatMap((s) => s.items)
    .filter((item) => item.s2_id).map((item) => normalizeS2Id(item.s2_id!)))]
  const resolved = new Map<string, string | null>() // normalized id → resolved paperId (null = unresolved)
  if (ids.length > 0) {
    const results = await resolveS2Ids(ids, { allowFetch: true })
    results.forEach((r, i) => {
      resolved.set(ids[i], r.status === 'resolved' ? (r.paper?.s2_paper_id ?? ids[i]) : null)
    })
  }

  const sections: ResearchListSection[] = parsed.data.sections.map((section) => {
    const seen = new Set<string>()
    const items: ResearchListItem[] = []
    for (const item of section.items) {
      if (item.s2_id) {
        const id = normalizeS2Id(item.s2_id)
        const paperId = resolved.get(id) ?? null
        const s2Id = paperId ?? id
        const key = `paper:${s2Id.toLowerCase()}`
        if (seen.has(key)) continue
        seen.add(key)
        items.push({
          kind: 'paper',
          s2_id: s2Id,
          ...(item.comment ? { comment: item.comment } : {}),
          verification: paperId ? 'verified' : 'unverified',
        })
      } else {
        const key = `link:${normalizeUrl(item.url!)}`
        if (seen.has(key)) continue
        seen.add(key)
        items.push({ kind: 'link', url: item.url!, citation: item.citation!, ...(item.comment ? { comment: item.comment } : {}) })
      }
    }
    return { title: section.title, ...(section.description ? { description: section.description } : {}), items }
  })

  const changes = parsed.data.changes?.trim() || null
  return {
    report,
    changes_note: changes,
    paper_list: { title: parsed.data.title, ...(changes ? { changes } : {}), sections },
    parse_error: null,
    failure: null,
  }
}
