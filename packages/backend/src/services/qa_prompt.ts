export type QAEntryType = 'template' | 'free'

interface RegenerationPromptInput {
  type: QAEntryType
  entry_prompt: string | null
  template_prompt?: string | null
  legacy_result_prompt?: string | null
}

/**
 * Resolve the question text for a new run without letting a previous result
 * become the source of truth for new entries.
 *
 * - template: always use the latest config value
 * - free: use the immutable entry value; result fallback is migration-only
 */
export function resolveRegenerationPrompt(input: RegenerationPromptInput): string | null {
  if (input.type === 'template') return input.template_prompt ?? null
  return input.entry_prompt ?? input.legacy_result_prompt ?? null
}
