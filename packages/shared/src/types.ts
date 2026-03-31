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
  link: string | null
  tags_json: string | null
  created_at: string
  updated_at: string
}

// Tag
export interface Tag {
  id: number
  name: string
  color: string
  visible: boolean
}

export interface PaperTag {
  paper_id: number
  tag_id: number
}

// QA
export type QAEntryStatus = 'pending' | 'running' | 'done' | 'failed'

export interface QAEntry {
  id: number
  paper_id: number
  type: 'template' | 'free'
  template_name: string | null
  status: QAEntryStatus
  error: string | null
  created_at: string
}

export interface QAFeedEntry {
  entry_id: number
  paper_id: number
  paper_title: string
  status: string
  error: string | null
  prompt: string | null
  created_at: string
  results: QAResult[]
}

export interface QAResult {
  id: number
  qa_entry_id: number
  prompt: string
  answer: string
  model_name: string
  completed_at: string
  execution_id: number | null
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
  enabled: boolean
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
  type: 'openai_api' | 'claude_cli' | 'codex_cli' | 'codex'
  endpoint?: string
  api_key_env?: string
  shell?: string
  timeout?: number
}

export interface ModelsConfig {
  default: string
  available: ModelConfig[]
}

export interface QATemplate {
  name: string
  prompt: string
}

export interface AppConfig {
  database: DatabaseConfig
  auth: AuthConfig
  services: Record<string, ServiceConfig>
  models: ModelsConfig
  content_priority: string[]
  system_prompt: string
  qa: QATemplate[]
}

// Highlight
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink'

export interface Highlight {
  id: number
  pathname: string
  content_hash: string
  start_offset: number
  end_offset: number
  text: string
  color: HighlightColor
  note: string | null
  created_at: string
}

// Idea Forge
export type IdeaCategory = 'unreviewed' | 'under-review' | 'validating' | 'archived'

export interface IdeaFrontmatter {
  name: string
  author: string
  tags: string[]
  create_time: string
  update_time: string
  my_score: number
  llm_score: number
  my_comment: string
  summary: string
  [key: string]: unknown // preserve unknown fields
}

export interface Idea {
  dir_name: string
  category: IdeaCategory
  name: string
  author: string
  tags: string[]
  create_time: string
  update_time: string
  my_score: number
  llm_score: number
  my_comment: string
  summary: string
  parse_error?: boolean
}

export interface IdeaDetail {
  frontmatter: IdeaFrontmatter
  body: string
  content_hash: string
  category: IdeaCategory
  dir_name: string
}

export interface ProjectConfig {
  paper_filter?: {
    tag_names: string[]
  }
}

export interface IdeaForgeProject {
  name: string
  idea_count: number
  paper_count: number
  created_at: string
  config: ProjectConfig
}

export interface DumpPapersRequest {
  tag_ids?: number[]
  paper_ids?: number[]
}

export interface DumpPapersResponse {
  dumped_count: number
  project_name: string
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
