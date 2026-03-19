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
  users: z.array(authUserSchema).min(1),
})

const serviceSchema = z.object({
  max_concurrency: z.number().int().positive().default(2),
  rate_limit_interval: z.number().optional(),
  method: z.string().optional(),
  python_script: z.string().optional(),
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

const configSchema = z.object({
  database: databaseSchema,
  auth: authSchema,
  services: z.record(z.string(), serviceSchema).default({}),
  models: modelsSchema,
  content_priority: z.array(z.string()).default(['user_input', 'pdf_parsed']),
  system_prompt: z.string(),
  qa: z.array(qaTemplateSchema).min(1),
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
