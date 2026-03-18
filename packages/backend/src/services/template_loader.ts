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
