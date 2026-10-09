import { eq, inArray, and, asc } from 'drizzle-orm'
import type { QAImageInput, QAInput, QATextSelectionInput, QAModelInputView } from '@paperland/shared'
import type { getDatabase } from '../db/index.js'
import * as schema from '../db/schema.js'
import { getConfig } from '../config.js'
import { getSystemPrompt, loadTemplate, templateSystemPromptName } from './template_loader.js'
import { imageAbsPath } from './image_store.js'
import type { ModelInput, ModelInputPart } from './model_providers/types.js'
import { contentInputs, historyInput, inputPages, parseStoredInputs } from './qa_inputs.js'

type Database = ReturnType<typeof getDatabase>
type EntryRow = typeof schema.qaEntries.$inferSelect
type ResultRow = typeof schema.qaResults.$inferSelect
type PaperRow = typeof schema.papers.$inferSelect

/** Raised when a paper has no usable full text; Q&A is unavailable for it (HTTP 409). */
export class QANoContentError extends Error {
  constructor() {
    super('No content available for this paper. Please ensure PDF has been parsed or content has been provided.')
    this.name = 'QANoContentError'
  }
}

/** The paper text Q&A uses, chosen by `content_priority`, with the source key it came from. */
export function resolvePaperContent(paper: Pick<PaperRow, 'contents'>): { source: string; text: string } | null {
  const contents = paper.contents
    ? (typeof paper.contents === 'string' ? JSON.parse(paper.contents) : paper.contents)
    : {}
  for (const key of getConfig().content_priority || ['user_input', 'pdf_parsed']) {
    if (contents[key]) return { source: key, text: contents[key] }
  }
  return null
}

export interface ChainTurn {
  entry: EntryRow
  /** The answer this turn continued with (the child's history reference). */
  result: ResultRow
}

const MAX_CHAIN_DEPTH = 200

/**
 * Ancestor turns of an entry, root first, followed along each `history.result_id`. This is a
 * server-internal read: it ignores sharing visibility and soft deletion, so follow-ups keep their
 * full history after a parent is unshared or deleted.
 */
export function loadAncestorChain(db: Database, entry: Pick<EntryRow, 'id' | 'inputs'>): ChainTurn[] {
  const turns: ChainTurn[] = []
  const seen = new Set<number>([entry.id])
  let reference = historyInput(parseStoredInputs(entry.inputs))
  while (reference && turns.length < MAX_CHAIN_DEPTH) {
    const result = db.select().from(schema.qaResults).where(eq(schema.qaResults.id, reference.result_id)).get()
    if (!result || seen.has(result.qa_entry_id)) break
    const parent = db.select().from(schema.qaEntries).where(eq(schema.qaEntries.id, result.qa_entry_id)).get()
    if (!parent) break
    seen.add(parent.id)
    turns.push({ entry: parent, result })
    reference = historyInput(parseStoredInputs(parent.inputs))
  }
  return turns.reverse()
}

/** All content inputs of a chain (ancestors first, then the entry itself). */
export function chainContentInputs(chain: ChainTurn[], entryInputs: QAInput[]): Array<QATextSelectionInput | QAImageInput> {
  return [
    ...chain.flatMap((turn) => contentInputs(parseStoredInputs(turn.entry.inputs))),
    ...contentInputs(entryInputs),
  ]
}

function firstAuthor(authors: string | null): string | null {
  if (!authors) return null
  try {
    const list = JSON.parse(authors)
    if (!Array.isArray(list) || list.length === 0) return null
    const first = typeof list[0] === 'string' ? list[0] : list[0]?.name
    if (!first) return null
    return list.length > 1 ? `${first} et al.` : first
  } catch {
    return null
  }
}

/**
 * Library papers matching citation rows (by S2 paperId, CorpusId, or arXiv id), keyed by row id.
 * Used for the `in library` marks in <references> and the in-app links of citation chips.
 */
export function matchLibraryPapers(
  db: Database,
  rows: Array<Pick<typeof schema.paperCitations.$inferSelect, 'id' | 's2_paper_id' | 'corpus_id' | 'arxiv_id'>>,
): Map<number, number> {
  const byKey = new Map<string, number>()
  const addMatches = (column: any, ids: string[], prefix: string) => {
    if (ids.length === 0) return
    for (const paper of db.select({ id: schema.papers.id, value: column }).from(schema.papers)
      .where(inArray(column, ids)).all()) {
      if (paper.value) byKey.set(`${prefix}:${paper.value}`, paper.id)
    }
  }
  addMatches(schema.papers.s2_paper_id, rows.map((row) => row.s2_paper_id).filter((id): id is string => !!id), 's2')
  addMatches(schema.papers.corpus_id, rows.map((row) => row.corpus_id).filter((id): id is string => !!id), 'corpus')
  addMatches(schema.papers.arxiv_id, rows.map((row) => row.arxiv_id).filter((id): id is string => !!id), 'arxiv')
  const matches = new Map<number, number>()
  for (const row of rows) {
    const paperId = (row.s2_paper_id && byKey.get(`s2:${row.s2_paper_id}`))
      || (row.corpus_id && byKey.get(`corpus:${row.corpus_id}`))
      || (row.arxiv_id && byKey.get(`arxiv:${row.arxiv_id}`))
    if (paperId) matches.set(row.id, paperId)
  }
  return matches
}

/** `<references>` body: the papers this paper cites, with S2 paperIds and in-library links. */
export function formatReferences(db: Database, paperId: number): string | null {
  const rows = db.select().from(schema.paperCitations)
    .where(and(eq(schema.paperCitations.paper_id, paperId), eq(schema.paperCitations.direction, 'reference')))
    .orderBy(asc(schema.paperCitations.id))
    .all()
  if (rows.length === 0) return null

  const library = matchLibraryPapers(db, rows)

  return rows.map((row, index) => {
    const libraryId = library.get(row.id) ?? null
    const fields = [
      `[r${index + 1}] ${row.s2_paper_id ? `cite:${row.s2_paper_id}` : 'no id'}`,
      row.title || '(untitled)',
      firstAuthor(row.authors),
      row.year != null ? String(row.year) : null,
      row.venue || null,
      libraryId != null && libraryId !== paperId ? `in library: paperland://paper/${libraryId}` : null,
    ].filter((field): field is string => !!field)
    return fields.join(' | ')
  }).join('\n')
}

function imagePart(db: Database, input: QAImageInput): ModelInputPart | null {
  const image = db.select().from(schema.images).where(eq(schema.images.hash, input.image_hash)).get()
  return image ? { type: 'image', path: imageAbsPath(image.path), mime: image.mime } : null
}

/** System prompt name an entry runs with: its own, else its preset's, else the default. */
export function entrySystemPromptName(entry: Pick<EntryRow, 'type' | 'template_name' | 'instruction'>): string {
  if (entry.instruction) return entry.instruction
  if (entry.type === 'template') return templateSystemPromptName(entry.template_name ? loadTemplate(entry.template_name) : null)
  return getConfig().qa_prompt.default_system_prompt
}

export interface BuiltQAInput {
  input: ModelInput
  view: QAModelInputView
}

/**
 * Build the model input for one run of an entry with the current rules:
 *   system = the entry's system prompt file
 *   user   = <paper> → <references> → <inputs> (images, then quotes; whole chain, once each)
 *            → <history> (ancestor questions + chosen answers, referring to inputs by label)
 *            → <question>
 * Used both for runs and for the on-demand "view model input" rebuild.
 */
export function buildQAInput(db: Database, entry: EntryRow, question: string): BuiltQAInput {
  const paper = db.select().from(schema.papers).where(eq(schema.papers.id, entry.paper_id)).get()
  if (!paper) throw new Error(`Paper ${entry.paper_id} not found`)
  const content = resolvePaperContent(paper)
  if (!content) throw new QANoContentError()

  const config = getConfig()
  const systemPrompt = getSystemPrompt(entrySystemPromptName(entry))
  const entryInputs = parseStoredInputs(entry.inputs)
  const chain = loadAncestorChain(db, entry)
  const allInputs = chainContentInputs(chain, entryInputs)
  const images = allInputs.filter((input): input is QAImageInput => input.kind === 'image')
  const quotes = allInputs.filter((input): input is QATextSelectionInput => input.kind === 'text_selection')

  const parts: ModelInputPart[] = []
  let text = ''
  const pushText = (value: string) => { text += value }
  const flushText = () => {
    if (text) parts.push({ type: 'text', text })
    text = ''
  }

  pushText(`<paper>\n${content.text}\n</paper>\n\n`)
  const references = formatReferences(db, entry.paper_id)
  if (references) pushText(`<references>\n${references}\n</references>\n\n`)

  let inputsText: string | null = null
  if (images.length > 0 || quotes.length > 0) {
    const lines: string[] = []
    pushText('<inputs>\n')
    for (const image of images) {
      const header = `@${image.label} ${[inputPages(image), 'region screenshot'].filter(Boolean).join(', ')}`
      lines.push(header)
      const part = imagePart(db, image)
      pushText(`${header}\n`)
      if (part) {
        flushText()
        parts.push(part)
        pushText('\n')
      } else {
        pushText('(image unavailable)\n')
      }
    }
    for (const quote of quotes) {
      const block = `@${quote.label}${inputPages(quote) ? ` ${inputPages(quote)}` : ''}\n"""\n${quote.text}\n"""`
      lines.push(block)
      pushText(`${block}\n`)
    }
    pushText('</inputs>\n\n')
    inputsText = lines.join('\n')
  }

  let historyText: string | null = null
  if (chain.length > 0) {
    const limit = config.qa_prompt.max_history_turns
    const turns = chain.slice(-limit)
    const lines = turns.map((turn) => `[User] ${turn.entry.prompt || ''}\n[Assistant] ${turn.result.answer}`)
    if (chain.length > turns.length) lines.unshift(`(${chain.length - turns.length} earlier turn(s) omitted)`)
    historyText = lines.join('\n\n')
    pushText(`<history>\n${historyText}\n</history>\n\n`)
  }

  pushText(`<question>\n${question}\n</question>`)
  flushText()

  return {
    input: { system: systemPrompt.text, user: parts, web_search: config.qa_prompt.codex_web_search },
    view: {
      system_prompt_name: systemPrompt.name,
      system_prompt: systemPrompt.text,
      paper: { source: content.source, length: content.text.length },
      references,
      inputs: allInputs,
      inputs_text: inputsText,
      history: historyText,
      question,
      rebuilt_with_current_config: true,
    },
  }
}
