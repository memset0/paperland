// Paper
export interface Paper {
  id: number
  arxiv_id: string | null
  corpus_id: string | null
  title: string
  authors: string[]
  abstract: string | null
  contents: Record<string, string | null> | null
  pdf_path: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

// Tag
export interface Tag {
  id: number
  name: string
}

export interface PaperTag {
  paper_id: number
  tag_id: number
}

// QA
export interface QAEntry {
  id: number
  paper_id: number
  type: 'template' | 'free'
  template_name: string | null
}

export interface QAResult {
  id: number
  qa_entry_id: number
  prompt: string
  answer: string
  model_name: string
  completed_at: string
}

// Service
export type ServiceExecutionStatus = 'pending' | 'waiting' | 'running' | 'done' | 'failed' | 'blocked'

export interface ServiceExecution {
  id: number
  service_name: string
  paper_id: number
  status: ServiceExecutionStatus
  progress: number
  created_at: string
  finished_at: string | null
  result: string | null
  error: string | null
}

// API Token
export interface ApiToken {
  id: number
  token: string
  created_at: string
  revoked_at: string | null
}

// Config
export interface DatabaseConfig {
  type: 'sqlite' | 'postgresql'
  path?: string
  url?: string
  backup?: {
    enabled: boolean
    dir: string
    retention_days: number
  }
}

export interface AuthUser {
  username: string
  password: string
}

export interface AuthConfig {
  users: AuthUser[]
}

export interface ServiceConfig {
  max_concurrency: number
  rate_limit_interval?: number
  method?: string
  python_script?: string
}

export interface ModelConfig {
  name: string
  type: 'openai_api' | 'claude_cli' | 'codex_cli'
  endpoint?: string
  api_key_env?: string
}

export interface ModelsConfig {
  default: string
  available: ModelConfig[]
}

export interface AppConfig {
  database: DatabaseConfig
  auth: AuthConfig
  services: Record<string, ServiceConfig>
  models: ModelsConfig
  content_priority: string[]
}

// API response types
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
}
