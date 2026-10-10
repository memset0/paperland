import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { getConfig } from '../config.js'
import { ensureAgentToken } from './api_tokens.js'
import type { ModelInput } from './model_invoke.js'

// Attaches Paperland's MCP server to a Codex run Paperland launches for a user: authenticated with
// that user's agent token, optionally limited to some tools, with `upload_image` pre-approved and
// the figure instruction appended to the system prompt whenever that tool is available.

export const UPLOAD_IMAGE_TOOL = 'upload_image'
export const FIGURES_PROMPT_PATH = resolve(import.meta.dir, '../../../../prompts/agent/figures.md')

export interface AttachAgentToolsOptions {
  /** Expose only these tools (all when absent). */
  tools?: string[]
  /** Add `agent_tools.skills_dir` as an extra skill root (Deep Research). */
  skills?: boolean
}

/** Current figure instruction, or '' when the file is missing. Read on every run so edits apply. */
export function figuresPrompt(): string {
  try { return readFileSync(FIGURES_PROMPT_PATH, 'utf8').trim() } catch { return '' }
}

/** Attach the tools when `agent_tools.enabled`; returns whether anything was attached. */
export function attachAgentTools(input: ModelInput, userId: number, options: AttachAgentToolsOptions = {}): boolean {
  const tools = getConfig().agent_tools
  if (!tools.enabled) return false
  const token = ensureAgentToken(userId).token
  const canUpload = !options.tools || options.tools.includes(UPLOAD_IMAGE_TOOL)
  input.mcp_servers = [{
    name: 'paperland',
    url: `${tools.base_url.replace(/\/+$/, '')}/mcp`,
    bearer_token: token,
    ...(options.tools ? { enabled_tools: options.tools } : {}),
    ...(canUpload ? { approved_tools: [UPLOAD_IMAGE_TOOL] } : {}),
  }]
  if (options.skills && existsSync(tools.skills_dir)) input.skill_roots = [tools.skills_dir]
  const figures = canUpload ? figuresPrompt() : ''
  if (figures) input.system = input.system ? `${input.system}\n\n${figures}` : figures
  return true
}
