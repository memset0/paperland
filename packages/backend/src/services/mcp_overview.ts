import { and, desc, eq } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { listTopics } from './topics.js'

const MAX_TOPICS = 20
const RECENT_PAPERS = 5
const clip = (text: string, max = 160) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)
const day = (iso: string) => iso.slice(0, 10)
const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * Per-user "Your workspace" section appended to MCP `initialize` instructions: the readable active
 * Topics (archived ones excluded) and the papers most recently added to the user's list. Returns ''
 * when it cannot be built, so initialize never fails because of it.
 */
export function workspaceOverview(userId: number): string {
  try {
    const topics = listTopics(userId, 'all', { archived: false })
    const papers = getDatabase().select({ id: schema.papers.id, title: schema.papers.title, added: schema.userPapers.created_at })
      .from(schema.userPapers).innerJoin(schema.papers, eq(schema.papers.id, schema.userPapers.paper_id))
      .where(and(eq(schema.userPapers.user_id, userId), eq(schema.userPapers.in_library, 1)))
      .orderBy(desc(schema.userPapers.created_at), desc(schema.userPapers.paper_id)).limit(RECENT_PAPERS).all()
    const lines = ['Your workspace (as of this connection):']
    lines.push(topics.length ? 'Active Topics:' : 'Active Topics: none.')
    for (const t of topics.slice(0, MAX_TOPICS)) lines.push(`- Topic ${t.id} "${clip(t.title)}" (${count(t.page_count, 'page')}, ${count(t.reference_count, 'reference')}, updated ${day(t.updated_at)})`)
    if (topics.length > MAX_TOPICS) lines.push(`- …and ${topics.length - MAX_TOPICS} more; call list_topics.`)
    lines.push(papers.length ? `Most recently added papers in your list:` : 'Your paper list is empty.')
    for (const p of papers) lines.push(`- Paper ${p.id} "${clip(p.title || 'Untitled')}" (added ${day(p.added)})`)
    lines.push('Archived Topics are not shown; call list_archived_topics for them. Use search_papers to find other papers.')
    return lines.join('\n')
  } catch { return '' }
}
