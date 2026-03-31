import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core'

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
  name: text('name').notNull().unique(),
  color: text('color').notNull().default(''),
  visible: integer('visible').notNull().default(1),
})

export const paperTags = sqliteTable('paper_tags', {
  paper_id: integer('paper_id').notNull().references(() => papers.id),
  tag_id: integer('tag_id').notNull().references(() => tags.id),
}, (table) => [
  primaryKey({ columns: [table.paper_id, table.tag_id] }),
])

export const qaEntries = sqliteTable('qa_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  paper_id: integer('paper_id').notNull().references(() => papers.id),
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
  created_at: text('created_at').notNull(),
  revoked_at: text('revoked_at'),
})
