import { sqliteTable, text, integer, primaryKey, index, unique, uniqueIndex } from 'drizzle-orm/sqlite-core'

// User accounts. Website credentials live here (not in config.yml).
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  // Public display name shown to others in owner attribution; not unique, null → fall back to username.
  nickname: text('nickname'),
  password_hash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'), // 'admin' | 'user'
  // Per-user CSRF token for the arxiv quick-open link (browser extension); lazily generated.
  open_token: text('open_token'),
  created_at: text('created_at').notNull(),
})

// Login sessions. `id` is an opaque random token stored in an httpOnly cookie.
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => users.id),
  created_at: text('created_at').notNull(),
  expires_at: text('expires_at').notNull(),
})

export const papers = sqliteTable('papers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  arxiv_id: text('arxiv_id').unique(),
  corpus_id: text('corpus_id').unique(),
  s2_paper_id: text('s2_paper_id').unique(), // 40-hex Semantic Scholar paperId (lowercase)
  title: text('title').notNull(),
  authors: text('authors').notNull(), // JSON array
  abstract: text('abstract'),
  contents: text('contents'), // JSON: { user_input, pdf_parsed, ... }
  pdf_path: text('pdf_path'),
  metadata: text('metadata'), // JSON
  link: text('link'),
  tags_json: text('tags_json'), // JSON: [{ id, name }]
  listed: integer('listed').notNull().default(1), // global visibility: 1 = shown + full pipeline, 0 = metadata-only/hidden
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').references(() => users.id), // owner; nullable for migration, app always sets it
  name: text('name').notNull(),
  color: text('color').notNull().default(''),
  visible: integer('visible').notNull().default(1),
}, (table) => [
  unique('tags_user_name_unq').on(table.user_id, table.name),
])

export const paperTags = sqliteTable('paper_tags', {
  paper_id: integer('paper_id').notNull().references(() => papers.id),
  tag_id: integer('tag_id').notNull().references(() => tags.id),
}, (table) => [
  primaryKey({ columns: [table.paper_id, table.tag_id] }),
])

export const qaEntries = sqliteTable('qa_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  paper_id: integer('paper_id').notNull().references(() => papers.id),
  user_id: integer('user_id').references(() => users.id), // owner for free entries; null for template (public/shared)
  type: text('type').notNull(), // 'template' | 'free'
  template_name: text('template_name'),
  prompt: text('prompt'), // persisted question text; immutable for free, refreshed from config for template runs
  status: text('status').notNull().default('pending'), // 'pending' | 'running' | 'done' | 'failed'
  error: text('error'),
  created_at: text('created_at').notNull().default(''),
  // Contextual Q&A: system prompt name (null = qa_prompt.default_system_prompt), immutable JSON
  // inputs (text_selection | image | history), and the parent entry derived from the history input.
  instruction: text('instruction'),
  inputs: text('inputs'),
  parent_entry_id: integer('parent_entry_id'),
}, (table) => [
  index('qa_entries_parent_entry_idx').on(table.parent_entry_id),
])

export const qaResults = sqliteTable('qa_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  qa_entry_id: integer('qa_entry_id').notNull().references(() => qaEntries.id),
  prompt: text('prompt').notNull(),
  answer: text('answer').notNull(),
  model_name: text('model_name').notNull(),
  completed_at: text('completed_at').notNull(),
  execution_id: integer('execution_id'),
  content_hash: text('content_hash'), // stable MD5 of answer with all whitespace removed
  status: text('status').notNull().default('done'), // queued | awaiting_output | streaming | done | failed | cancelled
  error: text('error'),
  requested_by_user_id: integer('requested_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  streaming_capable: integer('streaming_capable').notNull().default(0),
  created_at: text('created_at').notNull().default(''),
  started_at: text('started_at'),
  first_chunk_at: text('first_chunk_at'),
  finished_at: text('finished_at'),
  updated_at: text('updated_at').notNull().default(''),
  // Soft delete: hidden from every user-facing read, still used to build follow-up history.
  deleted_at: text('deleted_at'),
})

export const qaUserPreferences = sqliteTable('qa_user_preferences', {
  user_id: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  qa_entry_id: integer('qa_entry_id').notNull().references(() => qaEntries.id, { onDelete: 'cascade' }),
  background_color: text('background_color').notNull(), // gray | brown | orange | yellow | green | blue | purple | pink | red
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.user_id, table.qa_entry_id] }),
  index('qa_user_preferences_entry_idx').on(table.qa_entry_id),
])

// Per-user, per-data-type sharing switch for optionally-shared data (highlights, notes, qa,
// reference_links). Sparse: a missing row means "use config.yml sharing.default_shared". A switch
// governs whether that user's rows of that type appear in OTHER non-admin users' `scope=all` lists.
export const userSharingSettings = sqliteTable('user_sharing_settings', {
  user_id: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  data_type: text('data_type').notNull(), // 'highlights' | 'notes' | 'qa' | 'reference_links'
  shared: integer('shared').notNull(), // 1 = shared, 0 = private
  updated_at: text('updated_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.user_id, table.data_type] }),
])

export const serviceExecutions = sqliteTable('service_executions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  service_name: text('service_name').notNull(),
  paper_id: integer('paper_id').notNull().references(() => papers.id),
  status: text('status').notNull(), // pending, waiting, running, done, failed, blocked
  progress: integer('progress').notNull().default(0),
  created_at: text('created_at').notNull(),
  finished_at: text('finished_at'),
  result: text('result'),
  error: text('error'),
})

export const highlights = sqliteTable('highlights', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').references(() => users.id), // owner; nullable for migration, app always sets it
  pathname: text('pathname').notNull(),
  content_hash: text('content_hash').notNull(),
  qa_result_id: integer('qa_result_id').references(() => qaResults.id, { onDelete: 'set null' }),
  start_offset: integer('start_offset').notNull(),
  end_offset: integer('end_offset').notNull(),
  text: text('text').notNull(),
  color: text('color').notNull(), // 'yellow' | 'green' | 'blue' | 'pink'
  // NOTE: a legacy `note` column still exists physically in the DB (old highlight-notes).
  // It is intentionally dropped from the active schema and no longer read or written — the
  // dedicated `notes` table supersedes it. No destructive migration is generated; the column
  // is left in place to preserve historical data. (A future drizzle-kit generate may propose
  // dropping it; that is expected and can be ignored.)
  created_at: text('created_at').notNull(),
}, (table) => [
  index('highlights_user_qa_result_idx').on(table.user_id, table.qa_result_id),
])

// Per-user, per-paper notes: ONE Markdown document per (user, paper). The whole note is a
// single `body` string; the mind-map and walkthrough are derived from its Markdown headings,
// not from rows. Anchors live inline in `body` as `paperland://` links, so there is no anchor
// column. At most one row per (user, paper), guarded by the unique index (guards lazy creation
// races and the optimistic-concurrency upsert).
export const notes = sqliteTable('notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull().references(() => users.id), // owner
  paper_id: integer('paper_id').notNull().references(() => papers.id),
  body: text('body').notNull().default(''),
  completed: integer('completed').notNull().default(0), // 1 = user marked this note's reading complete
  is_public: integer('is_public').notNull().default(0), // 1 = published; readable by anyone (incl. anonymous)
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('notes_user_paper_unq').on(table.user_id, table.paper_id),
])

// Per-user, per-paper reference links: a flat list of external resources (blog posts,
// project pages, discussions, …) the user manually attaches to a paper. Private to the
// owning user (like notes/tags); ordered by created_at (insertion order). Only `url`
// is required: `title` is an optional legacy/override label, and `description` is
// auto-derived from the page (`${document.title} (${hostname})`) at preview time.
export const paperReferenceLinks = sqliteTable('paper_reference_links', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull().references(() => users.id), // owner
  paper_id: integer('paper_id').notNull().references(() => papers.id),
  title: text('title'), // optional (legacy rows + display fallback `title → description → url`)
  url: text('url').notNull(),
  description: text('description'), // optional; normally the auto-derived preview string
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
}, (table) => [
  index('idx_paper_reference_links_paper_user').on(table.paper_id, table.user_id),
])

export const apiTokens = sqliteTable('api_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  token: text('token').notNull().unique(),
  user_id: integer('user_id').references(() => users.id), // owning user; nullable for migration
  created_at: text('created_at').notNull(),
  revoked_at: text('revoked_at'),
})

// Image host: one row per uploaded image, content-addressed by the SHA-256 hash of its
// bytes (the primary key). Identical bytes dedupe to a single row/file/URL. The file lives
// on disk at `<image_host.dir>/<path>` and is served publicly at `/image/<path>`.
export const images = sqliteTable('images', {
  hash: text('hash').primaryKey(),                                  // SHA-256 hex of the bytes
  ext: text('ext').notNull(),                                       // png | jpg | gif | webp
  mime: text('mime').notNull(),
  size: integer('size').notNull(),                                  // bytes
  width: integer('width'),                                          // px; null if undetectable
  height: integer('height'),                                        // px; null if undetectable
  path: text('path').notNull(),                                     // YYYY/MM/DD/{hash}.{ext}
  original_name: text('original_name'),                             // client filename, if any
  uploaded_by: integer('uploaded_by').references(() => users.id),   // uploader; nullable
  created_at: text('created_at').notNull(),
}, (table) => [
  index('idx_images_created').on(table.created_at),
])

// Semantic Scholar citation graph: one row per citation edge.
// direction = 'reference' (this paper cites the other) | 'citation' (the other cites this paper)
export const paperCitations = sqliteTable('paper_citations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  paper_id: integer('paper_id').notNull().references(() => papers.id),
  direction: text('direction').notNull(),
  s2_paper_id: text('s2_paper_id'),
  corpus_id: text('corpus_id'),
  arxiv_id: text('arxiv_id'),
  doi: text('doi'),
  title: text('title'),
  authors: text('authors'), // JSON array of author names
  year: integer('year'),
  venue: text('venue'),
  url: text('url'),
  contexts: text('contexts'), // JSON array of citation-context snippets (where the citation occurs)
  intents: text('intents'),   // JSON array of intent labels (background / methodology / result)
  is_influential: integer('is_influential').notNull().default(0),
  created_at: text('created_at').notNull(),
}, (table) => [
  index('paper_citations_paper_dir_idx').on(table.paper_id, table.direction),
])

// Translation cache: one row per (source-text content hash, target language). The English→Chinese
// translation of a piece of text is cached here and shared across ALL users (no user_id), so the
// Semantic Scholar metadata cache for papers referenced anywhere (e.g. `#cite:` links), independent
// of the library. status = 'ok' (metadata present) | 'not_found' (negative entry: S2 has no record).
// A row has at least one of s2_paper_id / corpus_id; not_found rows keep only the id that was asked.
export const s2Papers = sqliteTable('s2_papers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  s2_paper_id: text('s2_paper_id').unique(), // 40-hex, lowercase
  corpus_id: text('corpus_id').unique(),
  arxiv_id: text('arxiv_id'),
  doi: text('doi'),
  title: text('title'),
  authors: text('authors'), // JSON array of author names
  year: integer('year'),
  venue: text('venue'),
  abstract: text('abstract'),
  tldr: text('tldr'),
  citation_count: integer('citation_count'),
  influential_citation_count: integer('influential_citation_count'),
  reference_count: integer('reference_count'),
  publication_date: text('publication_date'),
  url: text('url'),
  open_access_pdf_url: text('open_access_pdf_url'),
  status: text('status').notNull(),
  fetched_at: text('fetched_at').notNull(),
  created_at: text('created_at').notNull(),
})

// same text is never translated twice. "Re-translate" overwrites the existing row in place.
export const translations = sqliteTable('translations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  source_hash: text('source_hash').notNull(),                 // SHA-256 hex of the normalized source text
  source_text: text('source_text').notNull(),                 // normalized (outer-trimmed) source
  source_lang: text('source_lang').notNull().default('en'),
  target_lang: text('target_lang').notNull().default('zh'),
  translated_text: text('translated_text').notNull(),
  model_name: text('model_name'),                             // model used; nullable
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('translations_hash_lang_idx').on(table.source_hash, table.target_lang),
  index('translations_hash_idx').on(table.source_hash),
])

// Per-(user, paper) relationship state. Papers are shared site-wide; this row is the user's
// private view of one paper. `in_library` = shown in the user's own (Mine) paper list; removing
// only clears the flag so the row can carry further per-user paper state. Tag assignments stay
// in `paper_tags` (many tags per paper; owned via tags.user_id).
export const userPapers = sqliteTable('user_papers', {
  user_id: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  paper_id: integer('paper_id').notNull().references(() => papers.id, { onDelete: 'cascade' }),
  in_library: integer('in_library').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.user_id, table.paper_id] }),
  index('user_papers_paper_idx').on(table.paper_id),
])

// Deep Research: a session is an owner's research topic (optionally seeded from a QA answer
// snapshot); its history is a linear sequence of steps (agent rounds and owner title edits).
export const researchSessions = sqliteTable('research_sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  topic: text('topic').notNull(),
  seed: text('seed'), // JSON snapshot of the source QA answer, or null
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
}, (table) => [
  index('research_sessions_user_idx').on(table.user_id),
])

export const researchSteps = sqliteTable('research_steps', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  session_id: integer('session_id').notNull().references(() => researchSessions.id, { onDelete: 'cascade' }),
  step_index: integer('step_index').notNull(), // 1-based, contiguous within a session
  kind: text('kind').notNull(), // agent | title_edit
  user_text: text('user_text'),
  model_name: text('model_name'),
  status: text('status').notNull(), // queued | awaiting_output | streaming | done | failed | cancelled
  answer: text('answer').notNull().default(''),
  report: text('report'), // Markdown report of the version this step produced (null = no version)
  changes_note: text('changes_note'), // agent's short note on what this round changed
  paper_list: text('paper_list'), // JSON list of the version this step produced (null = no version)
  parse_error: text('parse_error'),
  repaired: integer('repaired').notNull().default(0), // 1 = version came from the automatic repair request
  error: text('error'),
  created_at: text('created_at').notNull(),
  started_at: text('started_at'),
  first_chunk_at: text('first_chunk_at'),
  finished_at: text('finished_at'),
  updated_at: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('research_steps_session_step_unq').on(table.session_id, table.step_index),
])
