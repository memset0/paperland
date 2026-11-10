import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { and, asc, eq } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import type { ResearchListItem, ResearchPaperList, TopicSnapshot } from '@paperland/shared'
import { getConfig } from '../config.js'
import { getDatabase, schema } from '../db/index.js'
import { parseS2Input } from '../utils/s2_ids.js'
import { parseTopicFiles, topicFiles, TopicError } from './topic_format.js'
import { commitTopicFiles, hasTopicPublicationJournal, initializeTopicRepo, readTopicCommit, reconcileTopic, type TopicCommitOptions } from './topic_git.js'

type DB = ReturnType<typeof getDatabase>
type Session = typeof schema.researchSessions.$inferSelect
type Step = typeof schema.researchSteps.$inferSelect
export interface LegacySource { session: Session; steps: Step[] }
interface ImportedVersion { source_step_id: number | null; source_step_index: number; source_time: string; kind: string; model_name: string | null; change_note: string; snapshot: TopicSnapshot }
export interface ResearchMigrationPlan { format_version: 1; session_id: number; owner_id: number; source_hash: string; viewer_ids: number[]; created_at: string; updated_at: string; versions: ImportedVersion[] }
interface Metadata { title: string; authors?: string[]; year?: number }
const systemActor = { user_id: 0, token_id: null, display_name: 'Paperland migration' }
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const json = <T>(value: string | null, fallback: T): T => { try { return value ? JSON.parse(value) : fallback } catch { return fallback } }

export function researchSources(db: DB): LegacySource[] {
  const steps = db.select().from(schema.researchSteps).orderBy(asc(schema.researchSteps.step_index), asc(schema.researchSteps.id)).all()
  return db.select().from(schema.researchSessions).orderBy(asc(schema.researchSessions.id)).all().map((session) => ({ session, steps: steps.filter((s) => s.session_id === session.id) }))
}
export function researchSourceHash(source: LegacySource): string { return hash(JSON.stringify(source)) }

function localMetadata(db: DB): Map<string, Metadata> {
  const output = new Map<string, Metadata>()
  for (const row of db.select({ s2: schema.s2Papers.s2_paper_id, corpus: schema.s2Papers.corpus_id, title: schema.s2Papers.title, authors: schema.s2Papers.authors, year: schema.s2Papers.year }).from(schema.s2Papers).all()) {
    if (!row.title) continue
    const metadata: Metadata = { title: row.title, authors: json<string[]>(row.authors, []).slice(0, 200), ...(row.year && row.year >= 1000 ? { year: row.year } : {}) }
    if (row.s2) output.set(row.s2, metadata)
    if (row.corpus) output.set(`CorpusId:${row.corpus}`, metadata)
  }
  for (const row of db.select({ s2: schema.papers.s2_paper_id, corpus: schema.papers.corpus_id, title: schema.papers.title, authors: schema.papers.authors, metadata: schema.papers.metadata }).from(schema.papers).all()) {
    const year = json<Record<string, any>>(row.metadata, {}).year
    const metadata: Metadata = { title: row.title, authors: json<string[]>(row.authors, []).slice(0, 200), ...(Number.isInteger(year) && year >= 1000 && year <= 9999 ? { year } : {}) }
    if (row.s2) output.set(row.s2, metadata)
    if (row.corpus) output.set(`CorpusId:${row.corpus}`, metadata)
  }
  return output
}

/** Pure conversion: preserve each occurrence/comment, match directory identity across title edits. */
export function convertResearchSource(source: LegacySource, metadata: Map<string, Metadata>, viewerIds: number[]): ResearchMigrationPlan {
  let previous: Array<{ id: string; title: string }> = [], directoryNumber = 0
  const versions: ImportedVersion[] = []
  for (const step of source.steps) {
    if (step.paper_list == null && step.report == null) continue
    if (step.paper_list == null || step.report == null) throw new TopicError(422, `Research step ${step.id} has an incomplete result`)
    let list: ResearchPaperList
    try { list = JSON.parse(step.paper_list) } catch { throw new TopicError(422, `Research step ${step.id} has invalid paper-list JSON`) }
    if (!Array.isArray(list.sections)) throw new TopicError(422, `Research step ${step.id} has no section list`)
    const used = new Set<string>()
    const matched = list.sections.map((section) => {
      const existing = previous.find((d) => d.title === section.title && !used.has(d.id))
      if (existing) used.add(existing.id)
      return existing?.id
    })
    const directories = list.sections.map((section, index) => {
      const positional = previous[index]
      const id = matched[index] ?? (positional && !used.has(positional.id) ? positional.id : `legacy-section-${++directoryNumber}`)
      used.add(id)
      return { id, name: section.title, parent_id: null, ...(section.description !== undefined ? { description: section.description } : {}) }
    })
    const snapshot: TopicSnapshot = { topic: { format_version: 1, title: list.title || source.session.topic.replace(/\s+/g, ' ').trim().slice(0, 500) || `Research ${source.session.id}`, description: '' }, report: step.report, list: { format_version: 1, directories, papers: [] } }
    for (const [index, section] of list.sections.entries()) {
      if (!Array.isArray(section.items)) throw new TopicError(422, `Research step ${step.id} has an invalid section`)
      const occurrences = new Map<string, number>()
      for (const item of section.items) {
        const link = item.kind === 'link' || 'url' in item
        const rawId = link ? (item as Extract<ResearchListItem, { kind: 'link' }>).url : (item as Extract<ResearchListItem, { kind: 'paper' }>).s2_id
        const key = `${directories[index].id}:${link ? 'url' : 's2'}:${rawId}`
        const occurrence = occurrences.get(key) ?? 0; occurrences.set(key, occurrence + 1)
        const common = { id: `legacy-entry-${hash(`${key}:${occurrence}`).slice(0, 24)}`, directory_ids: [directories[index].id], comment: item.comment ?? '' }
        if (link) {
          const reference = item as Extract<ResearchListItem, { kind: 'link' }>
          snapshot.list.papers.push({ ...common, title: reference.citation.title, url: reference.url, citation: structuredClone(reference.citation) })
        } else {
          const reference = item as Extract<ResearchListItem, { kind: 'paper' }>, parsed = parseS2Input(reference.s2_id)
          if (!parsed) throw new TopicError(422, `Research step ${step.id} has an invalid S2 identifier`)
          const id = parsed.s2_paper_id ?? `CorpusId:${parsed.corpus_id}`
          snapshot.list.papers.push({ ...common, ...(metadata.get(id) ?? { title: `Semantic Scholar paper ${id}` }), s2_id: id, verification: reference.verification ?? 'unverified' })
        }
      }
    }
    const validated = parseTopicFiles(topicFiles(snapshot), getConfig().topics.max_file_bytes)
    versions.push({ source_step_id: step.id, source_step_index: step.step_index, source_time: step.finished_at ?? step.updated_at ?? step.created_at, kind: step.kind, model_name: step.model_name, change_note: list.changes ?? '', snapshot: validated })
    previous = validated.list.directories.map((d) => ({ id: d.id, title: d.name }))
  }
  if (!versions.length) {
    const title = source.session.topic.replace(/\s+/g, ' ').trim().slice(0, 500) || `Research ${source.session.id}`
    const snapshot: TopicSnapshot = { topic: { format_version: 1, title, description: '' }, report: source.session.topic, list: { format_version: 1, directories: [], papers: [] } }
    versions.push({ source_step_id: null, source_step_index: 0, source_time: source.session.created_at, kind: 'empty', model_name: null, change_note: '', snapshot: parseTopicFiles(topicFiles(snapshot)) })
  }
  return { format_version: 1, session_id: source.session.id, owner_id: source.session.user_id, source_hash: researchSourceHash(source), viewer_ids: viewerIds.filter((id) => id !== source.session.user_id), created_at: source.session.created_at, updated_at: source.session.updated_at, versions }
}

export function planResearchMigration(db: DB): ResearchMigrationPlan[] {
  const metadata = localMetadata(db)
  const activeUsers = db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.status, 'active')).all().map((u) => u.id)
  const users = new Set(db.select({ id: schema.users.id }).from(schema.users).all().map((u) => u.id))
  const shared = new Set(db.select().from(schema.userSharingSettings).where(and(eq(schema.userSharingSettings.data_type, 'research'), eq(schema.userSharingSettings.shared, 1))).all().map((r) => r.user_id))
  return researchSources(db).map((source) => {
    if (!users.has(source.session.user_id)) throw new TopicError(422, `Research ${source.session.id} has no owner`)
    return convertResearchSource(source, metadata, shared.has(source.session.user_id) ? activeUsers : [])
  })
}
export function planReadOnlyResearchMigration(sqlite: Database): ResearchMigrationPlan[] { return planResearchMigration(drizzle(sqlite, { schema }) as DB) }
export function migrationPlanSummary(plans: ResearchMigrationPlan[]) {
  const versions = plans.flatMap((p) => p.versions)
  return { sessions: plans.length, result_versions: versions.filter((v) => v.source_step_id !== null).length, git_versions: versions.length, paper_occurrences: versions.reduce((n, v) => n + v.snapshot.list.papers.filter((p) => p.s2_id || p.paper_id).length, 0), link_occurrences: versions.reduce((n, v) => n + v.snapshot.list.papers.filter((p) => p.url).length, 0) }
}

export function backupResearchMigrationDatabase(sqlite: Database, destination: string): void {
  if (existsSync(destination)) throw new Error('Migration backup already exists; refusing to overwrite')
  mkdirSync(dirname(destination), { recursive: true, mode: 0o700 })
  sqlite.query('VACUUM INTO ?').run(destination)
  chmodSync(destination, 0o600)
  const backup = new Database(destination, { readonly: true })
  try {
    if ((backup.query('PRAGMA integrity_check').get() as any).integrity_check !== 'ok') throw new Error('Migration backup integrity check failed')
    if (backup.query('PRAGMA foreign_key_check').all().length) throw new Error('Migration backup has foreign-key violations')
  } finally { backup.close() }
}

function commitOptions(version: ImportedVersion, sessionId: number): TopicCommitOptions {
  const date = new Date(version.source_time)
  return { message: `Import Research ${sessionId}, step ${version.source_step_index} (${version.kind})\n\nSource step: ${version.source_step_id ?? 'none'}\nSource time: ${version.source_time}\nSource model: ${version.model_name ?? 'none'}\n${version.change_note}`, author_name: 'Legacy Research', ...(Number.isNaN(date.getTime()) ? {} : { author_date: date.toISOString() }), ...(version.source_step_id == null ? {} : { legacy_research_step_id: version.source_step_id }) }
}

/** Explicit one-time execution; never called by normal startup or a scheduled job. */
export async function migrateResearchToTopics(plans = planResearchMigration(getDatabase())) {
  const root = resolve(getConfig().topics.repos_dir)
  mkdirSync(root, { recursive: true, mode: 0o700 })
  const lock = join(root, 'research-migration.lock')
  if (existsSync(lock)) {
    const old = json<{ pid: number; start_token?: string }>(readFileSync(lock, 'utf8'), { pid: -1 })
    let running = false
    if (Number.isInteger(old.pid) && old.pid > 0) {
      try { process.kill(old.pid, 0); running = old.start_token ? old.start_token === processStartToken(old.pid) : true } catch {}
    }
    if (running) throw new Error('Another Research migration is running')
    unlinkSync(lock)
  }
  const fd = openSync(lock, 'wx', 0o600)
  writeFileSync(fd, JSON.stringify({ pid: process.pid, start_token: processStartToken(process.pid), started_at: new Date().toISOString() }))
  const results: Array<{ session_id: number; topic_id: number; source_versions: number; skipped: boolean }> = []
  try {
    const db = getDatabase()
    for (const proposed of plans) {
      let topic = db.select().from(schema.topics).where(eq(schema.topics.legacy_research_session_id, proposed.session_id)).get()
      if (topic?.legacy_migration_state === 'complete') { results.push({ session_id: proposed.session_id, topic_id: topic.id, source_versions: proposed.versions.filter((v) => v.source_step_id !== null).length, skipped: true }); continue }
      if (!topic) {
        topic = db.transaction((tx) => {
          const row = tx.insert(schema.topics).values({ owner_id: proposed.owner_id, title: proposed.versions[0].snapshot.topic.title, created_at: proposed.created_at, updated_at: proposed.updated_at, snapshot: JSON.stringify(proposed.versions[0].snapshot), legacy_research_session_id: proposed.session_id, legacy_migration_state: 'pending', legacy_migration_plan: JSON.stringify(proposed) }).returning().get()
          tx.insert(schema.topicMembers).values({ topic_id: row.id, user_id: proposed.owner_id, role: 'owner' }).run()
          return row
        })
      }
      if (!topic.legacy_migration_plan) throw new Error(`Migration plan missing for Topic ${topic.id}`)
      const plan = JSON.parse(topic.legacy_migration_plan) as ResearchMigrationPlan
      const source = researchSources(db).find((s) => s.session.id === plan.session_id)
      if (!source || researchSourceHash(source) !== plan.source_hash) throw new Error(`Research ${plan.session_id} changed during migration; inspect the source before resuming`)
      if (hasTopicPublicationJournal(topic.id)) await reconcileTopic(topic.id)
      for (const version of plan.versions) {
        const already = version.source_step_id == null
          ? db.select().from(schema.topicVersions).where(eq(schema.topicVersions.topic_id, topic.id)).all().length > 0
          : !!db.select().from(schema.topicVersions).where(and(eq(schema.topicVersions.topic_id, topic.id), eq(schema.topicVersions.legacy_research_step_id, version.source_step_id))).get()
        if (already) continue
        const current = db.select().from(schema.topics).where(eq(schema.topics.id, topic.id)).get()!
        if (!current.published_commit) await initializeTopicRepo(topic.id, version.snapshot, systemActor, commitOptions(version, plan.session_id))
        else await commitTopicFiles(topic.id, current.published_commit, topicFiles(version.snapshot), systemActor, commitOptions(version, plan.session_id))
      }
      const finalSource = researchSources(db).find((s) => s.session.id === plan.session_id)
      if (!finalSource || researchSourceHash(finalSource) !== plan.source_hash) throw new Error(`Research ${plan.session_id} changed while importing`)
      db.transaction((tx) => {
        const activeIds = new Set(tx.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.status, 'active')).all().map((u) => u.id))
        for (const userId of plan.viewer_ids.filter((id) => activeIds.has(id))) tx.insert(schema.topicMembers).values({ topic_id: topic!.id, user_id: userId, role: 'viewer' }).onConflictDoNothing().run()
        tx.update(schema.topics).set({ legacy_migration_state: 'complete', legacy_migration_plan: null, updated_at: plan.updated_at }).where(eq(schema.topics.id, topic!.id)).run()
      })
      results.push({ session_id: plan.session_id, topic_id: topic.id, source_versions: plan.versions.filter((v) => v.source_step_id !== null).length, skipped: false })
    }
    const receipt = join(root, 'research-migration-receipt.json')
    writeFileSync(`${receipt}.tmp`, JSON.stringify({ completed_at: new Date().toISOString(), summary: migrationPlanSummary(plans), results }, null, 2), { mode: 0o600 }); renameSync(`${receipt}.tmp`, receipt)
    return results
  } finally { closeSync(fd); unlinkSync(lock) }
}

function processStartToken(pid: number): string | undefined {
  try { const value = readFileSync(`/proc/${pid}/stat`, 'utf8'); return value.slice(value.lastIndexOf(')') + 2).split(/\s+/)[19] } catch { return undefined }
}

export async function verifyReadOnlyResearchMigration(sqlite: Database) { return verifyResearchTopicMigration(drizzle(sqlite, { schema }) as DB) }
export async function verifyResearchTopicMigration(db: DB = getDatabase()) {
  const sources = researchSources(db)
  let versions = 0, papers = 0, links = 0
  for (const source of sources) {
    const topic = db.select().from(schema.topics).where(eq(schema.topics.legacy_research_session_id, source.session.id)).get()
    if (!topic || topic.legacy_migration_state !== 'complete' || topic.owner_id !== source.session.user_id) throw new Error(`Research ${source.session.id} was not completely migrated`)
    for (const step of source.steps.filter((s) => s.paper_list != null && s.report != null)) {
      const row = db.select().from(schema.topicVersions).where(and(eq(schema.topicVersions.topic_id, topic.id), eq(schema.topicVersions.legacy_research_step_id, step.id))).get()
      if (!row) throw new Error(`Research step ${step.id} has no Topic version`)
      const snapshot = await readTopicCommit(topic.id, row.commit), list: ResearchPaperList = JSON.parse(step.paper_list!)
      if (snapshot.report !== step.report || snapshot.topic.title !== list.title.trim() || snapshot.list.directories.length !== list.sections.length) throw new Error(`Research step ${step.id} report or structure differs`)
      for (const [index, section] of list.sections.entries()) {
        const dir = snapshot.list.directories[index], entries = snapshot.list.papers.filter((p) => p.directory_ids.includes(dir.id))
        if (dir.name !== section.title || (dir.description ?? '') !== (section.description ?? '') || entries.length !== section.items.length) throw new Error(`Research step ${step.id} section differs`)
        for (const [i, item] of section.items.entries()) {
          const entry = entries[i]
          if (entry.comment !== (item.comment ?? '')) throw new Error(`Research step ${step.id} comment differs`)
          if (item.kind === 'link') { if (entry.url !== item.url || !isDeepStrictEqual(entry.citation, item.citation)) throw new Error(`Research step ${step.id} citation differs`); links++ }
          else { const key = parseS2Input(item.s2_id)!; if (entry.s2_id !== (key.s2_paper_id ?? `CorpusId:${key.corpus_id}`) || entry.verification !== item.verification) throw new Error(`Research step ${step.id} paper differs`); papers++ }
        }
      }
      versions++
    }
  }
  return { sessions: sources.length, result_versions: versions, paper_occurrences: papers, link_occurrences: links }
}
