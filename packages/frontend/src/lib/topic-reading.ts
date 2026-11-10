import MarkdownIt from 'markdown-it'
import katex from '@traptitech/markdown-it-katex'
import { diffArrays } from 'diff'
import type { TopicPaper, TopicSnapshot } from '@paperland/shared'

const parser = new MarkdownIt({ html: false, breaks: true, linkify: true }).use(katex, { throwOnError: false })
export interface TopicSeen { schema_version: 1; commit: string; snapshot: TopicSnapshot }
export interface TopicSurfaceSeen { schema_version: 2; commit: string; body: string; entries: TopicPaper[] }
type ReadingStorage = Pick<Storage, 'getItem' | 'setItem'>

/** Same top-level block grammar as the renderer; never split/render Markdown piecemeal. */
export function reportBlocks(source: string): string[] {
  const lines = source.split('\n')
  return parser.parse(source, {}).filter((t) => t.level === 0 && t.nesting !== -1 && t.map != null)
    .map((t) => lines.slice(t.map![0], t.map![1]).join('\n').trim())
}

export function topicReadingKey(userId: number, topicId: number): string { return `paperland:topic-seen:v1:${userId}:${topicId}:latest` }
export function topicSurfaceKey(userId: number, topicId: number, path: string, surface: 'document' | 'references' | 'catalog'): string {
  return `paperland:topic-seen:v2:${userId}:${topicId}:${encodeURIComponent(path)}:${surface}:latest`
}
export function readTopicSurface(storage: ReadingStorage, key: string): TopicSurfaceSeen | null {
  try {
    const value = JSON.parse(storage.getItem(key) || 'null')
    return value?.schema_version === 2 && /^[a-f0-9]{40}$/.test(value.commit) && typeof value.body === 'string' && Array.isArray(value.entries) && value.entries.every((p: any) => typeof p.id === 'string') ? value : null
  } catch { return null }
}
export function surfaceAdditions(previous: TopicSurfaceSeen | null, next: TopicSurfaceSeen) {
  const snapshot = (v: TopicSurfaceSeen): TopicSnapshot => ({ topic: { format_version: 1, title: '', description: '' }, report: v.body, list: { format_version: 1, directories: [], papers: v.entries } })
  return topicAdditions(previous ? { schema_version: 1, commit: previous.commit, snapshot: snapshot(previous) } : null, snapshot(next))
}
export function saveTopicSurface(storage: ReadingStorage, key: string, seen: TopicSurfaceSeen): boolean {
  try { storage.setItem(key, JSON.stringify(seen)); return true } catch { return false }
}
export function readTopicSeen(storage: ReadingStorage, key: string): TopicSeen | null {
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const value = JSON.parse(raw)
    if (value.schema_version !== 1 || !/^[a-f0-9]{40}$/.test(value.commit) || typeof value.snapshot?.report !== 'string' || !Array.isArray(value.snapshot?.list?.papers) || !Array.isArray(value.snapshot?.list?.directories)) return null
    if (!value.snapshot.list.papers.every((p: any) => typeof p.id === 'string') || !value.snapshot.list.directories.every((d: any) => typeof d.id === 'string')) return null
    return value
  } catch { return null }
}

export function topicAdditions(previous: TopicSeen | null, next: TopicSnapshot): { report: number[]; papers: string[]; directories: string[] } {
  const none = { report: [] as number[], papers: [] as string[], directories: [] as string[] }
  if (!previous) return none
  const oldBlocks = reportBlocks(previous.snapshot.report), blocks = reportBlocks(next.report)
  const oldPapers = new Set(previous.snapshot.list.papers.map((p) => p.id))
  const oldDirs = new Set(previous.snapshot.list.directories.map((d) => d.id))
  const changes = diffArrays(oldBlocks, blocks)
  const familiar = changes.some((c) => !c.added && !c.removed && c.count > 0) || next.list.papers.some((p) => oldPapers.has(p.id)) || next.list.directories.some((d) => oldDirs.has(d.id))
  if (!familiar) return none
  const report: number[] = []; let position = 0
  for (let i = 0; i < changes.length; i++) {
    const part = changes[i]
    if (part.removed) continue
    if (part.added && !changes[i - 1]?.removed && !changes[i + 1]?.removed) {
      for (let j = 0; j < part.count; j++) report.push(position + j)
    }
    position += part.count
  }
  return { report, papers: next.list.papers.filter((p) => !oldPapers.has(p.id)).map((p) => p.id), directories: next.list.directories.filter((d) => !oldDirs.has(d.id)).map((d) => d.id) }
}

/** A stale request/account change/history switch must never advance the latest reading baseline. */
export class TopicReadingGate {
  private generation = 0
  private scope = ''
  begin(scope: string) { this.scope = scope; return { scope, generation: ++this.generation } }
  valid(ticket: { scope: string; generation: number }): boolean { return this.scope === ticket.scope && this.generation === ticket.generation }
  invalidate() { this.generation++ }
  save(storage: ReadingStorage, ticket: { scope: string; generation: number }, seen: TopicSeen, latest: boolean): boolean {
    if (!latest || !this.valid(ticket)) return false
    try { storage.setItem(ticket.scope, JSON.stringify(seen)); return true } catch { return false }
  }
}
