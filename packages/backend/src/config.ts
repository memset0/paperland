import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import yaml from 'js-yaml'
import { z } from 'zod'
import type { AppConfig } from '@paperland/shared'

const databaseBackupSchema = z.object({
  enabled: z.boolean().default(false),
  dir: z.string().default('./data/backups'),
  retention_days: z.number().default(30),
})

const databaseSchema = z.object({
  type: z.enum(['sqlite', 'postgresql']).default('sqlite'),
  path: z.string().optional(),
  url: z.string().optional(),
  backup: databaseBackupSchema.optional(),
})

const authUserSchema = z.object({
  username: z.string(),
  password: z.string(),
})

const authSchema = z.object({
  enabled: z.boolean().default(true),
  // Deprecated: website credentials now live in the `users` DB table.
  // Kept optional for backward-compatible parsing of existing config.yml files.
  users: z.array(authUserSchema).optional(),
})

const serviceSchema = z.object({
  max_concurrency: z.number().int().positive().default(2),
  rate_limit_interval: z.number().optional(),
  method: z.string().optional(),
  python_script: z.string().optional(),
  api_key: z.string().optional(),
  api_key_env: z.string().optional(),
})

const modelSchema = z.object({
  name: z.string(),
  type: z.enum(['openai_api', 'claude_cli', 'codex_cli', 'codex']),
  endpoint: z.string().optional(),
  api_key_env: z.string().optional(),
  shell: z.string().optional(),       // For codex type: full shell command prefix, e.g. 'codex exec --skip-git-repo-check --model "gpt-5.4"'
  timeout: z.number().optional(),     // Timeout in seconds, default 120
})

const modelsSchema = z.object({
  default: z.string(),
  available: z.array(modelSchema).min(1),
})

const qaTemplateSchema = z.object({
  name: z.string(),
  prompt: z.string(),
})

// Default English→Chinese translation prompt. The `{TEXT}` placeholder is replaced with the
// source text at translation time. Override `translation.prompt` in config.yml to tune wording
// without touching code (see translation_service.ts).
const DEFAULT_TRANSLATION_PROMPT = `You are a professional translator. Translate the following English text into Simplified Chinese.
Strictly preserve the original formatting: keep all Markdown syntax, code blocks, inline code, LaTeX math,
lists, tables, and line breaks exactly as in the source. Translate only the natural-language text; do NOT
translate code, math, URLs, or identifiers. Output only the translation, with no extra explanation or wrapping.

{TEXT}`

const translationSchema = z.object({
  // Which entry of models.available to use; falls back to models.default when absent.
  model: z.string().optional(),
  // Prompt template containing a {TEXT} placeholder for the source text.
  prompt: z.string().default(DEFAULT_TRANSLATION_PROMPT),
}).default({})

const imageHostSchema = z.object({
  dir: z.string().default('./data/images'),
  max_size_mb: z.number().positive().default(18),
  allowed_types: z.array(z.string()).default(['image/png', 'image/jpeg', 'image/gif', 'image/webp']),
  public_base_url: z.string().default(''),
})

const pdfViewerSchema = z.object({
  // DPI used when rendering a PDF region screenshot to PNG (PdfViewer "框选截图").
  // Render scale = screenshot_dpi / 72 (PDF user-space units are 1/72 inch).
  screenshot_dpi: z.number().positive().default(300),
})

// Browser-like UA: many sites (e.g. blogs behind CDNs) return a usable <title> only for a
// real-looking browser agent and 403 obvious bots. Note: some sites (e.g. zhihu) still block
// server-side fetches entirely — those simply yield no description and fall back to url/title.
const DEFAULT_LINK_PREVIEW_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const referenceLinksSchema = z.object({
  // Server-side crawl tunables for the 参考链接 description auto-fetch (page <title>).
  fetch_timeout_ms: z.number().int().positive().default(8000),
  max_bytes: z.number().int().positive().default(524288), // 512KB — enough to reach <title>
  user_agent: z.string().default(DEFAULT_LINK_PREVIEW_UA),
})

// Pixel `max-width` for the three note-image width tiers selected via the `w=sm|md|lg`
// directive in a markdown image's alt text (see frontend MarkdownContent). The cap is layered
// on top of the default `width:100%` and never causes overflow (applied as min(tier, 100%)).
const notesImageWidthTiersSchema = z.object({
  sm: z.number().int().positive().default(240),
  md: z.number().int().positive().default(480),
  lg: z.number().int().positive().default(720),
})

const notesSchema = z.object({
  image_width_tiers: notesImageWidthTiersSchema.default({ sm: 240, md: 480, lg: 720 }),
})

const configSchema = z.object({
  database: databaseSchema,
  auth: authSchema,
  services: z.record(z.string(), serviceSchema).default({}),
  models: modelsSchema,
  content_priority: z.array(z.string()).default(['user_input', 'pdf_parsed']),
  system_prompt: z.string(),
  qa: z.array(qaTemplateSchema).min(1),
  translation: translationSchema,
  image_host: imageHostSchema.default({}),
  // Note: `.default({})` on an object schema is returned as-is when the key is absent, so the
  // inner `screenshot_dpi` default would NOT apply for a config.yml without a `pdf_viewer` block.
  // Use an explicit literal default so the 300 fallback holds whether the key is absent or empty.
  pdf_viewer: pdfViewerSchema.default({ screenshot_dpi: 300 }),
  // Explicit literal default (not `.default({})`) so inner defaults hold when the key is absent.
  reference_links: referenceLinksSchema.default({ fetch_timeout_ms: 8000, max_bytes: 524288, user_agent: DEFAULT_LINK_PREVIEW_UA }),
  // Explicit literal default (not `.default({})`) so inner tier defaults hold when the key is absent.
  notes: notesSchema.default({ image_width_tiers: { sm: 240, md: 480, lg: 720 } }),
})

let _config: AppConfig | null = null

/** Traverse upward from cwd looking for config.yml */
function findConfigFile(): string {
  let dir = process.cwd()
  while (true) {
    const candidate = resolve(dir, 'config.yml')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) break // reached filesystem root
    dir = parent
  }
  return resolve(process.cwd(), 'config.yml') // fall through to error handling below
}

export function loadConfig(configPath?: string): AppConfig {
  const filePath = configPath || findConfigFile()

  let rawContent: string
  try {
    rawContent = readFileSync(filePath, 'utf-8')
  } catch (err) {
    throw new Error(`Config file not found: ${filePath}\n  Please copy config.example.yml to config.yml and update it with your settings:\n    cp config.example.yml config.yml`)
  }

  const rawConfig = yaml.load(rawContent)
  const result = configSchema.safeParse(rawConfig)

  if (!result.success) {
    throw new Error(`Invalid config.yml:\n${result.error.issues.map(i => `  - ${i.path.join('.')}: ${i.message}`).join('\n')}`)
  }

  _config = result.data as AppConfig
  return _config
}

export function getConfig(): AppConfig {
  if (!_config) {
    throw new Error('Config not loaded. Call loadConfig() first.')
  }
  return _config
}
