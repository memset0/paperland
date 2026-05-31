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
  listed: boolean
  /** Derived (not stored): false for OpenReview-only papers that cannot be promoted to listed=true. */
  listable?: boolean
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

// Semantic Scholar citation graph edge
export interface PaperCitation {
  id: number
  paper_id: number
  direction: 'reference' | 'citation'
  s2_paper_id: string | null
  corpus_id: string | null
  arxiv_id: string | null
  doi: string | null
  title: string | null
  authors: string[]
  year: number | null
  venue: string | null
  url: string | null
  contexts: string[]
  intents: string[]
  is_influential: boolean
  created_at: string
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
  user_id: number | null
  created_at: string
  revoked_at: string | null
}

// User accounts (stored in the DB; not in config.yml)
export type UserRole = 'admin' | 'user'

export interface User {
  id: number
  username: string
  role: UserRole
  created_at: string
}

/** Authenticated principal attached to a request and returned by /api/auth/me */
export interface SessionUser {
  id: number
  username: string
  role: UserRole
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
  /** Deprecated: website credentials now live in the `users` DB table. Kept for backward-compatible parsing. */
  users?: AuthUser[]
}

export interface ServiceConfig {
  max_concurrency: number
  rate_limit_interval?: number
  method?: string
  python_script?: string
  api_key?: string
  api_key_env?: string
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

export interface ImageHostConfig {
  dir: string
  max_size_mb: number
  allowed_types: string[]
  public_base_url: string
}

export interface TranslationConfig {
  model?: string
  prompt: string
}

export interface PdfViewerConfig {
  /** DPI used to render a PDF region screenshot to PNG (render scale = dpi / 72). */
  screenshot_dpi: number
}

export interface AppConfig {
  database: DatabaseConfig
  auth: AuthConfig
  services: Record<string, ServiceConfig>
  models: ModelsConfig
  content_priority: string[]
  system_prompt: string
  qa: QATemplate[]
  translation: TranslationConfig
  image_host: ImageHostConfig
  pdf_viewer: PdfViewerConfig
}

// A cached English→Chinese translation, content-addressed by the source text hash.
// Shared across all users (no user_id).
export interface Translation {
  id: number
  source_hash: string
  source_text: string
  source_lang: string
  target_lang: string
  translated_text: string
  model_name: string | null
  created_at: string
  updated_at: string
}

export interface TranslateRequest {
  text: string
  force?: boolean
  /** Peek mode: return the cached translation (or cached:false) without calling the AI model. */
  cache_only?: boolean
}

export interface TranslateResponse {
  // null only in a cache_only peek miss
  source_hash: string | null
  source_text: string | null
  translated_text: string | null
  source_lang: string
  target_lang: string
  model_name: string | null
  cached: boolean
}

// Image host
export interface Image {
  hash: string
  ext: string
  mime: string
  size: number
  width: number | null
  height: number | null
  path: string
  original_name: string | null
  uploaded_by: number | null
  created_at: string
}

/** An image row enriched by the API with its public URL and (on list) its reference count. */
export interface ImageWithUrl extends Image {
  url: string
  reference_count?: number
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
  created_at: string
}

// Notes — per-user, per-paper SINGLE Markdown document. The whole note is one
// `body` string; structure (the mind-map + walkthrough) is derived from its
// Markdown headings, not from rows. At most one note row per (user, paper).
// Anchors are NOT a column; they live inline in `body` as `paperland://` links.
export interface Note {
  id: number
  user_id: number
  paper_id: number
  body: string
  created_at: string
  updated_at: string
}

// A note annotated with its paper's title (for the cross-paper /notes aggregate).
export interface NoteWithPaper extends Note {
  paper_title: string
}

// ── Heading-section model (derived view of a note document) ──
// A note document is parsed into a tree of sections by its Markdown headings.
// Each section owns its heading line plus the "leaf body" (the text from its
// heading up to the next heading of any level); deeper headings are `children`.
// Hierarchy follows RELATIVE heading depth (shallowest level present = top), so
// a document works whether its top-level headings are `#` or `##`. The center
// node represents the `preamble` — any text before the first heading.

/** A [start, end) character range into the canonical Markdown string. */
export interface CharRange {
  start: number
  end: number
}

export interface NoteSection {
  /** Stable-ish id within one parse (heading path index); not persisted. */
  id: string
  /** Raw ATX heading level (1–6) as written in the document. */
  level: number
  /** Heading text (without the leading `#`s). */
  heading: string
  /** Text from just after the heading line up to the next heading (trimmed of the trailing newline run). */
  leafBody: string
  /** Range of this section's heading line in the canonical string. */
  headingRange: CharRange
  /** Range of this section's leaf body in the canonical string. */
  bodyRange: CharRange
  children: NoteSection[]
}

/** The whole parsed document: a preamble (pre-heading text) plus a forest of top-level sections. */
export interface NoteDocTree {
  /** Text before the first heading (the center node's editable content). */
  preamble: string
  preambleRange: CharRange
  sections: NoteSection[]
}

// Per-user reference link attached to a paper (blog post, project page, …).
// `title` and `url` are required; `description` is optional.
export interface PaperReferenceLink {
  id: number
  user_id: number
  paper_id: number
  title: string
  url: string
  description: string | null
  created_at: string
  updated_at: string
}

// Conferences
export interface Conference {
  id: number
  name: string
  year: number | null
  start_date: string | null
  end_date: string | null
  location: string | null
  description: string | null
  link: string | null
  created_at: string
  updated_at: string
}

/** Conference list item: a Conference plus aggregate counts of its candidate pool. */
export interface ConferenceListItem extends Conference {
  paper_count: number
  status_counts: { pending: number; candidate: number; ingested: number }
}

export type ConferencePaperStatus = 'pending' | 'candidate' | 'ingested'
export type ConferencePaperSource = 'arxiv' | 'openreview' | 'semantic_scholar' | null

export interface ConferencePaper {
  id: number
  conference_id: number
  title: string
  topic: string | null
  authors: string[]
  abstract: string | null
  source: ConferencePaperSource
  external_id: string | null
  link: string | null
  status: ConferencePaperStatus
  paper_id: number | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

/** Payload accepted by POST /api/conferences/:id/papers/import. */
export interface ConferenceImportPayload {
  papers: Array<{
    title: string
    topic?: string | null
    source?: string | null
    external_id?: string | null
    link?: string | null
    authors?: string[] | null
    abstract?: string | null
    metadata?: Record<string, unknown> | null
  }>
}

/** Summary returned by POST /api/conferences/:id/ingest. */
export interface ConferenceIngestSummary {
  ingested: number
  skipped: number
  errors: Array<{ candidate_id: number; message: string }>
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
