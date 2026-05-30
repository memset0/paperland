import { sqliteTable, text, integer, primaryKey, index, unique, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// User accounts. Website credentials live here (not in config.yml).
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'), // 'admin' | 'user'
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
  status: text('status').notNull().default('pending'), // 'pending' | 'running' | 'done' | 'failed'
  error: text('error'),
  created_at: text('created_at').notNull().default(''),
})

export const qaResults = sqliteTable('qa_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  qa_entry_id: integer('qa_entry_id').notNull().references(() => qaEntries.id),
  prompt: text('prompt').notNull(),
  answer: text('answer').notNull(),
  model_name: text('model_name').notNull(),
  completed_at: text('completed_at').notNull(),
  execution_id: integer('execution_id'),
})

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
})

// Per-user, per-paper notes: a single tree anchored by one lazily-created `root` note
// (kind='root', the sole parent_id=null node), with `note` rows hanging beneath it via
// self-referential `parent_id`. Anchors live inline in `body` as `paperland://` links,
// so there is no anchor column.
export const notes = sqliteTable('notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull().references(() => users.id), // owner
  paper_id: integer('paper_id').notNull().references(() => papers.id),
  kind: text('kind').notNull(), // 'root' | 'note'
  parent_id: integer('parent_id').references((): AnySQLiteColumn => notes.id), // self-ref; null only for the `root` note
  title: text('title'),
  body: text('body').notNull().default(''),
  sort_order: integer('sort_order').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
}, (table) => [
  // At most one root note per (user, paper); guards lazy root creation against races.
  uniqueIndex('notes_root_unq').on(table.user_id, table.paper_id).where(sql`${table.kind} = 'root'`),
])

// Per-user, per-paper reference links: a flat list of external resources (blog posts,
// project pages, discussions, …) the user manually attaches to a paper. Private to the
// owning user (like notes/tags); ordered by created_at (insertion order). `description`
// is optional.
export const paperReferenceLinks = sqliteTable('paper_reference_links', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull().references(() => users.id), // owner
  paper_id: integer('paper_id').notNull().references(() => papers.id),
  title: text('title').notNull(),
  url: text('url').notNull(),
  description: text('description'), // optional
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

// Conferences: top-level entity grouping a set of candidate papers (see conferencePapers).
export const conferences = sqliteTable('conferences', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  year: integer('year'),
  start_date: text('start_date'), // ISO 8601 date
  end_date: text('end_date'),     // ISO 8601 date
  location: text('location'),
  description: text('description'),
  link: text('link'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

// Conference candidate pool. Papers live here BEFORE being ingested into `papers`.
// status: 'pending' (待确认) → 'candidate' (候选中) → 'ingested' (已入库).
// When ingested, `paper_id` is set to the matching/created papers row.
export const conferencePapers = sqliteTable('conference_papers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  conference_id: integer('conference_id').notNull().references(() => conferences.id),
  title: text('title').notNull(),
  topic: text('topic'),
  authors: text('authors'),      // JSON array
  abstract: text('abstract'),
  source: text('source'),        // 'arxiv' | 'openreview' | 'semantic_scholar' | null
  external_id: text('external_id'),
  link: text('link'),
  status: text('status').notNull().default('pending'),
  paper_id: integer('paper_id').references(() => papers.id),
  metadata: text('metadata'),    // JSON: raw pre-scraped data
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
}, (table) => [
  index('conference_papers_conf_status_idx').on(table.conference_id, table.status),
])

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
