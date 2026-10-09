// Paper
export interface Paper {
  id: number
  arxiv_id: string | null
  corpus_id: string | null
  /** 40-hex Semantic Scholar paperId (lowercase). */
  s2_paper_id: string | null
  title: string
  authors: string[]
  abstract: string | null
  /** Full text by source. Detail only — omitted from list (`GET /api/papers`) items. */
  contents?: Record<string, string | null> | null
  pdf_path: string | null
  metadata: Record<string, unknown> | null
  link: string | null
  tags_json: string | null
  listed: boolean
  /** Derived per caller: the paper is in the caller's personal library (Mine list). False for anonymous. */
  in_library?: boolean
  /** Derived (detail only): whether a PDF is available, being fetched, or must be uploaded. */
  pdf_status?: 'available' | 'fetching' | 'upload_required'
  /** Derived (detail only): why no PDF could be obtained automatically. */
  pdf_unavailable_reason?: 'closed_access' | 'download_failed' | 'not_found' | null
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
export type QAResultStatus = 'queued' | 'awaiting_output' | 'streaming' | 'done' | 'failed' | 'cancelled'
export type QAEntryBackgroundColor =
  | 'gray'
  | 'brown'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'red'

// Contextual Q&A inputs. Stored immutably on qa_entries.inputs; labels (`Quote1`, `Image1`) are
// assigned by the backend and unique across a whole follow-up chain.
export interface QAPdfTextSegment {
  page: number
  ts: number
  te: number
}

export interface QAPdfRegion {
  page: number
  rx: number
  ry: number
  rw: number
  rh: number
}

export interface QATextSelectionInput {
  kind: 'text_selection'
  label: string
  text: string
  /** One segment per page (a cross-page passage has several). */
  pdf: QAPdfTextSegment[]
}

export interface QAImageInput {
  kind: 'image'
  label: string
  /** Image-host hash (images.hash); images must live in the built-in image host. */
  image_hash: string
  url: string
  pdf: QAPdfRegion | null
}

export interface QAHistoryInput {
  kind: 'history'
  /** The parent answer this entry continues from. */
  result_id: number
}

export type QAInput = QATextSelectionInput | QAImageInput | QAHistoryInput

/** Inputs as submitted by a client: labels are optional and re-assigned by the backend. */
export type QAInputRequest =
  | (Omit<QATextSelectionInput, 'label'> & { label?: string })
  | (Omit<QAImageInput, 'label' | 'url'> & { label?: string; url?: string })
  | QAHistoryInput

export interface QAEntry {
  id: number
  paper_id: number
  type: 'template' | 'free'
  template_name: string | null
  prompt: string | null
  status: QAEntryStatus
  error: string | null
  created_at: string
  /** System prompt name; null = qa_prompt.default_system_prompt. */
  instruction: string | null
  inputs: QAInput[]
  parent_entry_id: number | null
  followup_count: number
}

export interface QAFeedEntry {
  entry_id: number
  paper_id: number
  paper_title: string
  status: string
  error: string | null
  prompt: string | null
  created_at: string
  user_id: number | null
  username: string | null
  /** Owner's nickname, falling back to username — what the UI shows. */
  display_name: string | null
  /** Whether the owner shares Q&A (false only ever reaches admins viewing others' entries). */
  shared: boolean
  can_manage: boolean
  background_color: QAEntryBackgroundColor | null
  highlight_count: number
  note_anchor_count: number
  results: QAResult[]
  instruction: string | null
  inputs: QAInput[]
  parent_entry_id: number | null
  followup_count: number
}

/** A node of a follow-up tree; hidden/deleted nodes carry no content. */
export interface QATreeNode {
  entry_id: number
  /** The parent answer this entry continues from (null for the root). */
  parent_result_id: number | null
  state: 'visible' | 'hidden' | 'deleted'
  entry: QAFeedEntry | null
  children: QATreeNode[]
}

/** A rebuilt (not stored) view of what a model receives for an answer. */
export interface QAModelInputView {
  system_prompt_name: string
  system_prompt: string
  paper: { source: string; length: number }
  references: string | null
  /** Passages and screenshots of the whole follow-up chain, as sent. */
  inputs: Array<QATextSelectionInput | QAImageInput>
  /** Text of the <inputs> section (image parts shown via `inputs`). */
  inputs_text: string | null
  history: string | null
  question: string
  rebuilt_with_current_config: true
}

export interface QAResult {
  id: number
  qa_entry_id: number
  prompt: string
  answer: string
  model_name: string
  completed_at: string
  execution_id: number | null
  content_hash: string | null
  status: QAResultStatus
  error: string | null
  requested_by_user_id: number | null
  streaming_capable: boolean
  created_at: string
  started_at: string | null
  first_chunk_at: string | null
  finished_at: string | null
  updated_at: string
  thinking_duration_ms: number | null
  can_cancel: boolean
}

export interface QAResultStreamStart {
  result: QAResult
  streaming_capable: boolean
  thinking_duration_ms: number | null
}

export interface QAResultStreamDelta {
  result_id: number
  delta: string
  answer_length: number
  first_chunk_at: string | null
  thinking_duration_ms: number | null
}

export interface QAResultStreamTerminal {
  result: QAResult
  error?: { code: string; message: string }
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
/** 'pending' = self-registered, awaiting admin approval (cannot log in). */
export type UserStatus = 'active' | 'pending'

export interface User {
  id: number
  username: string
  /** Optional, non-unique public display name; owner attribution falls back to username. */
  nickname: string | null
  role: UserRole
  status: UserStatus
  created_at: string
}

/** Authenticated principal attached to a request and returned by /api/auth/me */
export interface SessionUser {
  id: number
  username: string
  nickname: string | null
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
    keep_daily_days: number
    keep_checkpoint_days: number[]
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
  /** Services sharing a group share one concurrency semaphore. */
  concurrency_group?: string
}

export interface Doc2xConfig {
  enabled: boolean
  cli_path: string
  /** Seconds per CLI run. */
  timeout: number
  output_dir: string
  /** ISO timestamp; papers created at/after it are auto-translated (+ parsed). Empty = all papers. */
  auto_since: string
  /** OAuth token file written by `doc2x login`. */
  token_file: string
  /** doc2x gateway base URL (Markdown export of a translation run's parse). */
  gateway_url: string
  parse: { formula_mode: 'normal' | 'dollar' }
  translate: {
    target_language: string
    model: string
    pdf_font_strategy: 'global-consistent' | 'page-optimal'
    ignore_types: string[]
  }
}

export type Doc2xParseStatus = 'none' | 'pending' | 'running' | 'done' | 'failed'
export type Doc2xTranslateStatus = 'idle' | 'queued' | 'pending' | 'running' | 'done' | 'failed'

/** GET /api/papers/:id/doc2x */
export interface Doc2xStatus {
  enabled: boolean
  has_pdf: boolean
  parse: { status: Doc2xParseStatus; error: string | null; finished_at: string | null }
  translate: {
    status: Doc2xTranslateStatus
    error: string | null
    requested_at: string | null
    bilingual_pdf_path: string | null
    translated_pdf_path: string | null
  }
  /** Which full-text versions exist (drives the "copy full text" buttons). */
  text_sources: { pdf_parsed: boolean; doc2x_parsed: boolean }
  /** First non-empty content source per content_priority (null = no content). */
  qa_source: string | null
  /** True when Q&A would rely on mechanical text while doc2x parse is not done. */
  qa_needs_confirm: boolean
}

export interface ModelConfig {
  name: string
  type: 'openai_api' | 'codex'
  /** false/absent = JSON or codex exec; true = SSE or codex app-server. */
  stream?: boolean
  endpoint?: string
  api_key_env?: string
  shell?: string
  cli_path?: string
  codex_home?: string
  model_id?: string
  reasoning_effort?: 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'ultra'
  working_dir?: string
  timeout?: number
  /** Whether the model accepts image input. */
  vision?: boolean
}

export interface ModelsConfig {
  default: string
  available: ModelConfig[]
}

export interface QATemplate {
  name: string
  prompt: string
  /** Optional system prompt name; defaults to qa_prompt.default_system_prompt. */
  system_prompt?: string
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
  qa: QATemplate[]
  qa_prompt: QAPromptConfig
  translation: TranslationConfig
  image_host: ImageHostConfig
  pdf_viewer: PdfViewerConfig
  sharing: SharingConfig
  doc2x: Doc2xConfig
}

export interface QAPromptConfig {
  /** Absolute directory of `<name>.md` system prompt files (resolved at config load). */
  system_prompts_dir?: string
  /** System prompt used when an entry/preset does not name one. */
  default_system_prompt: string
  direct_ask: {
    system_prompt?: string
    /** Preset question appended after the input token for a direct ask. */
    question: string
  }
  /** Allow Codex models to use native web search during Q&A. */
  codex_web_search: boolean
  /** Follow-ups send at most this many most-recent ancestor turns as history. */
  max_history_turns: number
}

export interface SharingConfig {
  /** Effective value of a user's sharing switch when they have never set it. */
  default_shared: boolean
}

// Multi-user sharing: optionally-shared data types, one switch per user per type.
export type SharingDataType = 'highlights' | 'notes' | 'qa' | 'reference_links' | 'research'
export type SharingPreferences = Record<SharingDataType, boolean>
/** Read scope for optionally-shared lists. */
export type VisibilityScope = 'mine' | 'all'


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

export type TranslationStreamStatus = 'idle' | 'connecting' | 'streaming' | 'completed' | 'failed'

export interface TranslationStreamStart {
  source_hash: string
  cached: boolean
  model_name: string | null
  streaming: boolean
}

export interface TranslationStreamDelta {
  delta: string
}

export interface TranslationStreamError {
  error: {
    code: string
    message: string
  }
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
  /** Number of Q&A image inputs using this image (list only). */
  qa_reference_count?: number
}

// Highlight
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink'

export interface Highlight {
  id: number
  pathname: string
  content_hash: string
  qa_result_id: number | null
  start_offset: number
  end_offset: number
  text: string
  color: HighlightColor
  created_at: string
  /** Owner attribution — present on every read (`scope=mine|all`). */
  user_id?: number
  username?: string | null
  /** Owner's nickname, falling back to username — what the UI shows. */
  display_name?: string | null
  /** Whether the owner shares highlights (false only reaches admins for others' rows). */
  shared?: boolean
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
  /** Whether the user marked this note's reading complete. */
  completed: boolean
  /** Whether the note is published — readable by anyone, including anonymous visitors. */
  is_public: boolean
  created_at: string
  updated_at: string
}

// A note annotated with its paper's title (for the cross-paper /notes aggregate).
export interface NoteWithPaper extends Note {
  paper_title: string
}

// A note annotated with its paper title AND author username — used by cross-user
// reads: the single-note fetch (`GET /api/notes/:noteId`) and the `scope=all`
// aggregate (`GET /api/notes?scope=all`).
export interface NoteWithAuthor extends NoteWithPaper {
  username: string
  /** Author's nickname, falling back to username — what the UI shows. */
  display_name: string
  /** Visible to other non-admin users: published OR the owner shares notes. */
  shared: boolean
}

// A body-less summary of another user's public note for a paper, listed in the
// right-panel "public notes from others" section (`GET /api/papers/:id/public-notes`).
// The body is fetched lazily per entry via `GET /api/notes/:noteId`.
export interface PublicNoteSummary {
  id: number
  user_id: number
  username: string
  /** Author's nickname, falling back to username — what the UI shows. */
  display_name: string
  is_public: boolean
  /** Visible to other non-admin users: published OR the owner shares notes. */
  shared: boolean
  updated_at: string
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
// Only `url` is required. `title` is an optional label kept for legacy rows and as
// a display fallback; `description` is auto-derived from the page at preview time
// (`${document.title} (${hostname})`). Display label resolves `title → description → url`.
export interface PaperReferenceLink {
  id: number
  user_id: number
  paper_id: number
  title: string | null
  url: string
  description: string | null
  created_at: string
  updated_at: string
  /** Owner attribution — present on reads. */
  username?: string | null
  /** Owner's nickname, falling back to username — what the UI shows. */
  display_name?: string | null
  /** Whether the owner shares reference links (false only reaches admins for others' rows). */
  shared?: boolean
}

// Result of crawling a url server-side to derive a reference link's description.
// `title` is the raw page `<title>` (null if unavailable); `description` is the
// composed `${title} (${hostname})` (or null when the page could not be crawled).
export interface ReferenceLinkPreview {
  title: string | null
  hostname: string
  description: string | null
}

// Semantic Scholar metadata cache (POST /api/s2/papers/resolve)
export interface S2PaperMeta {
  s2_paper_id: string | null
  corpus_id: string | null
  arxiv_id: string | null
  doi: string | null
  title: string | null
  authors: string[]
  year: number | null
  venue: string | null
  abstract: string | null
  tldr: string | null
  citation_count: number | null
  influential_citation_count: number | null
  url: string | null
  open_access_pdf_url: string | null
  fetched_at: string
}

export type S2ResolveStatus = 'resolved' | 'not_found' | 'unavailable' | 'invalid'
export type S2ResolveSource = 'library' | 'cache' | 's2' | 'stale_cache'

export interface S2ResolveResult {
  /** The id exactly as requested. */
  id: string
  status: S2ResolveStatus
  source: S2ResolveSource | null
  paper: S2PaperMeta | null
  library_paper_id: number | null
}

// Deep Research (/research): linear steps (agent rounds + owner title edits), each producing a list version.
export type ResearchStepKind = 'agent' | 'title_edit'
export type ResearchStepStatus = 'queued' | 'awaiting_output' | 'streaming' | 'done' | 'failed' | 'cancelled'

/** BibTeX @misc-style citation the agent writes for a non-paper link (blog post, docs, talk…). */
export interface ResearchCitation {
  title: string
  author?: string[]
  year?: number
  month?: string
  howpublished?: string
  note?: string
}

/** A paper (metadata resolved from S2 by id) or a non-paper link. */
export type ResearchListItem =
  | { kind: 'paper'; s2_id: string; comment?: string; verification: 'verified' | 'unverified' }
  | { kind: 'link'; url: string; citation: ResearchCitation; comment?: string }
// `comment` is Markdown and may cite papers with `[short title](#cite:<s2_id>)`.

export interface ResearchListSection {
  title: string
  /** Markdown; may cite papers with `[short title](#cite:<s2_id>)`. */
  description?: string
  items: ResearchListItem[]
}

/** One list version (the version's report is stored next to it on the step). */
export interface ResearchPaperList {
  title: string
  /** Agent's optional note on what this round changed. */
  changes?: string
  sections: ResearchListSection[]
}

/** Snapshot of the QA answer a session started from (copied at creation; never updated). */
export interface ResearchSeed {
  qa_result_id: number
  qa_entry_id: number
  paper_id: number
  paper_title: string
  question: string
  answer: string
  model_name: string
}

export interface ResearchStep {
  id: number
  session_id: number
  step_index: number
  kind: ResearchStepKind
  user_text: string | null
  model_name: string | null
  status: ResearchStepStatus
  answer: string
  /** Report of the version this step produced (null when it produced none). */
  report: string | null
  /** Agent's short note on what this round changed. */
  changes_note: string | null
  paper_list: ResearchPaperList | null
  parse_error: string | null
  /** The version came from the automatic repair request. */
  repaired: boolean
  error: string | null
  created_at: string
  started_at: string | null
  first_chunk_at: string | null
  finished_at: string | null
  updated_at: string
}

export interface ResearchSessionSummary {
  id: number
  user_id: number
  owner_name: string
  topic: string
  /** Title of the current list version, else a truncated topic. */
  title: string
  step_count: number
  version_count: number
  latest_status: ResearchStepStatus | null
  created_at: string
  updated_at: string
}

export interface ResearchSessionDetail extends ResearchSessionSummary {
  seed: ResearchSeed | null
  steps: ResearchStep[]
  /** Viewer may submit/retry/cancel/edit/truncate (owner only). */
  can_edit: boolean
  /** Viewer may delete (owner or admin). */
  can_delete: boolean
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
