import { sqliteTable, text, integer, primaryKey, index, unique } from 'drizzle-orm/sqlite-core'

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
  note: text('note'),
  created_at: text('created_at').notNull(),
})

export const apiTokens = sqliteTable('api_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  token: text('token').notNull().unique(),
  user_id: integer('user_id').references(() => users.id), // owning user; nullable for migration
  created_at: text('created_at').notNull(),
  revoked_at: text('revoked_at'),
})

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
