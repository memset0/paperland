import { readFileSync } from 'fs'
import type { ResearchPaperList, ResearchSeed } from '@paperland/shared'
import { BUNDLED_SYSTEM_PROMPTS_DIR, getConfig, systemPromptPath } from '../config.js'
import type { ModelInput } from './model_invoke.js'
import { renderListForPrompt, type ParseFailure } from './research_list.js'

/** A prior step as replayed to the agent. */
export interface HistoryStep {
  step_index: number
  kind: 'agent' | 'title_edit'
  user_text: string | null
  /** Agent round: its `changes` note; title edit: unused. */
  changes_note: string | null
}

/** The version the round builds on: its report and list. */
export interface CurrentVersion {
  report: string
  list: ResearchPaperList
}

export interface ResearchPromptParts {
  topic: string
  seed: ResearchSeed | null
  /** Steps before this round, oldest first. */
  history: HistoryStep[]
  current: CurrentVersion | null
  request: string
}

/**
 * Research system prompt text: `research.system_prompt` from the configured prompts directory,
 * falling back to the bundled prompts (so a custom `qa_prompt.system_prompts_dir` without a
 * research prompt keeps working). Read on every call so edits apply without a restart.
 */
export function getResearchSystemPrompt(): string {
  const config = getConfig()
  const name = config.research.system_prompt
  const dirs = [config.qa_prompt.system_prompts_dir, BUNDLED_SYSTEM_PROMPTS_DIR].filter(Boolean) as string[]
  for (const dir of [...new Set(dirs)]) {
    try {
      return readFileSync(systemPromptPath(dir, name), 'utf-8').trim()
    } catch {
      // try the next directory
    }
  }
  throw new Error(`Research system prompt not found: ${name}`)
}

function renderStep(step: HistoryStep, full: boolean): string {
  if (step.kind === 'title_edit') {
    return `<step index="${step.step_index}" kind="title_edit">\nThe user edited titles: ${step.user_text ?? ''}\n</step>`
  }
  const request = `<request>\n${step.user_text ?? ''}\n</request>`
  const changes = full && step.changes_note ? `\n<changes>\n${step.changes_note}\n</changes>` : ''
  return `<step index="${step.step_index}" kind="agent">\n${request}${changes}\n</step>`
}

/**
 * `<history>` body: steps are filled newest-first in full while they fit `budget` characters; older
 * steps keep only their user text (title edits are always kept whole — they are short).
 */
export function renderHistory(history: HistoryStep[], budget: number): string {
  const rendered: string[] = new Array(history.length)
  let used = 0
  let fullAllowed = true
  for (let i = history.length - 1; i >= 0; i--) {
    const full = renderStep(history[i], true)
    if (fullAllowed && used + full.length <= budget) {
      rendered[i] = full
      used += full.length
    } else {
      fullAllowed = false
      rendered[i] = renderStep(history[i], false)
    }
  }
  return rendered.join('\n')
}

function renderSeed(seed: ResearchSeed): string {
  return [
    `<paper id="${seed.paper_id}">${seed.paper_title}</paper>`,
    `<question>\n${seed.question}\n</question>`,
    `<answer>\n${seed.answer}\n</answer>`,
  ].join('\n')
}

/** Model input for one research round (system prompt + tagged user message, web search on). */
export async function buildResearchInput(parts: ResearchPromptParts): Promise<ModelInput> {
  const { history_char_budget: budget, abstract_char_limit: abstractLimit } = getConfig().research
  const sections = [`<topic>\n${parts.topic}\n</topic>`]
  if (parts.seed) sections.push(`<seed>\n${renderSeed(parts.seed)}\n</seed>`)
  if (parts.history.length) sections.push(`<history>\n${renderHistory(parts.history, budget)}\n</history>`)
  if (parts.current) {
    const list = await renderListForPrompt(parts.current.list, abstractLimit)
    sections.push(`<current_version>\n<report>\n${parts.current.report}\n</report>\n${list}\n</current_version>`)
  }
  sections.push(`<request>\n${parts.request}\n</request>`)
  return {
    system: getResearchSystemPrompt(),
    user: [{ type: 'text', text: sections.join('\n\n') }],
    web_search: true,
  }
}

const LIST_RULES = `The paper list is exactly one fenced code block with info string \`paperlist\` containing valid JSON:
{"title": string, "changes"?: string, "sections": [{"title": string, "description"?: string, "items": [item]}]}
An item is either a paper {"s2_id": "<40-character Semantic Scholar paperId>", "comment"?: string} (no title, authors, or other metadata)
or a non-paper link {"url": "https://...", "citation": {"title": string, "author"?: string[], "year"?: number, "month"?: string, "howpublished"?: string, "note"?: string}, "comment"?: string}.
An item has exactly one of s2_id or url. Use double quotes, no comments, no trailing commas.`

/**
 * Model input for the one automatic repair of an invalid round output (no web search). A list-only
 * failure asks for the paperlist block alone (the original report is kept); a missing report asks
 * for the full output again.
 */
export function buildRepairInput(original: string, failure: ParseFailure, error: string): ModelInput {
  let task: string
  let source: string
  if (failure === 'missing_report') {
    task = 'Your previous output is missing the research report. Output the complete answer again: the full Markdown report followed by exactly one `paperlist` block.'
    source = original
  } else if (failure === 'missing_list') {
    task = 'Your previous output has no `paperlist` block. Output ONLY the `paperlist` block for the report below — no other text.'
    source = original
  } else {
    task = 'Your previous `paperlist` block is invalid. Output ONLY a corrected `paperlist` block with the same content — no other text.'
    const start = original.lastIndexOf('```paperlist')
    source = start >= 0 ? original.slice(start) : original
  }
  const text = [
    `<task>\n${task}\n</task>`,
    `<validation_error>\n${error}\n</validation_error>`,
    `<format>\n${LIST_RULES}\n</format>`,
    `<previous_output>\n${source}\n</previous_output>`,
  ].join('\n\n')
  return { system: getResearchSystemPrompt(), user: [{ type: 'text', text }], web_search: false }
}
