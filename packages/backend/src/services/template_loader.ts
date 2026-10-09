import { readFileSync } from 'fs'
import { getConfig, systemPromptPath } from '../config.js'
import type { QATemplate } from '@paperland/shared'

export function loadTemplates(): QATemplate[] {
  return getConfig().qa
}

export function loadTemplate(name: string): QATemplate | null {
  return getConfig().qa.find((t) => t.name === name) || null
}

/**
 * Current text of a named system prompt (`<qa_prompt.system_prompts_dir>/<name>.md`), read on every
 * call so edits apply without a restart. A missing/unknown name falls back to the default system
 * prompt; if that file is unreadable too, this throws and the run fails with that error.
 */
export function getSystemPrompt(name?: string | null): { name: string; text: string } {
  const { qa_prompt } = getConfig()
  const dir = qa_prompt.system_prompts_dir!
  const fallback = qa_prompt.default_system_prompt
  for (const candidate of name && name !== fallback ? [name, fallback] : [fallback]) {
    try {
      return { name: candidate, text: readFileSync(systemPromptPath(dir, candidate), 'utf-8').trim() }
    } catch {
      // try the next candidate
    }
  }
  throw new Error(`System prompt file not found: ${systemPromptPath(dir, fallback)}`)
}

/** System prompt name a preset question runs with. */
export function templateSystemPromptName(template: QATemplate | null): string {
  return template?.system_prompt || getConfig().qa_prompt.default_system_prompt
}

/** Translation prompt template (contains a {TEXT} placeholder). */
export function getTranslationPrompt(): string {
  return getConfig().translation.prompt
}

/** Model used for translation: `translation.model` if set, else `models.default`. */
export function getTranslationModel(): string {
  const config = getConfig()
  return config.translation.model || config.models.default
}
