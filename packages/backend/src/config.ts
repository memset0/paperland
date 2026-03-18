import { readFileSync } from 'fs'
import { resolve } from 'path'
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
  type: z.enum(['openai_api', 'claude_cli', 'codex_cli']),
  endpoint: z.string().optional(),
  api_key_env: z.string().optional(),
})

const modelsSchema = z.object({
  default: z.string(),
  available: z.array(modelSchema).min(1),
})

const configSchema = z.object({
  database: databaseSchema,
  auth: authSchema,
  services: z.record(z.string(), serviceSchema).default({}),
  models: modelsSchema,
  content_priority: z.array(z.string()).default(['user_input', 'alphaxiv', 'pdf_parsed']),
})

let _config: AppConfig | null = null

export function loadConfig(configPath?: string): AppConfig {
  const filePath = configPath || resolve(process.cwd(), 'config.yml')

  let rawContent: string
  try {
    rawContent = readFileSync(filePath, 'utf-8')
  } catch (err) {
    throw new Error(`Config file not found: ${filePath}`)
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
