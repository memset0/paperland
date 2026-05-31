import { getConfig } from '../config.js'
import type { QATemplate } from '@paperland/shared'

export function loadTemplates(): QATemplate[] {
  return getConfig().qa
}

export function loadTemplate(name: string): QATemplate | null {
  return getConfig().qa.find((t) => t.name === name) || null
}

export function getSystemPrompt(): string {
  return getConfig().system_prompt
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
