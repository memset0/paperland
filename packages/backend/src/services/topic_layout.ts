import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { backfillTopicReferences, commitTopicFiles, readTopicCommit, reconcileTopic, type PushIdentity } from './topic_git.js'
import { topicReferenceInfo } from './topic_references.js'
import { TopicError } from './topic_error.js'
import { withTopicLock } from './topic_lock.js'

export const TOPIC_AGENT_GUIDE = `# Topic agent guide

Use your own user-bound Topic token for MCP and Git. Never commit credentials or large media.

- Published documents live under pages/. The default report is pages/report.md.
- Root topic.json and references.json hold metadata and the single global reference catalog. A work can appear in many report subsets; never duplicate metadata per report.
- Root README.md explains the repository. This AGENTS.md is the agent guide.
- Other safe regular files are agent workspace content, retained by Git but never executed or rendered by the website. All repository files share the Topic access policy.
- Keep stable entry IDs, sources and reference_number values. New references append at get_topic.next_reference_number; deleted numbers are reserved.
- Documents may declare YAML title, fonticon and references: [3, 8, 12]. Use the site's Lucide icon names; unknown names fall back safely.
- Use get_topic(metadata_only=true) for the index and get_topic(document="pages/research/rq6.md") for one page. Reuse native PDF citations from read_pdf_page.
- Pull before editing, review the complete diff and push main with fast-forward updates. Documents and catalog publish together.
- Rewrite, merge and remove obsolete prose to keep coherent reports. Git preserves the history.
- Discussion logs contain conversations with other people, not planning exchanges between the Topic owner and their assistant. Preserve mention dates, provenance and attributed comments.
`

export async function upgradeTopicLayout(topicId: number, identity: PushIdentity = { user_id: 0, token_id: null, display_name: 'Topic layout migration' }) {
  return withTopicLock(topicId, async () => {
    await reconcileTopic(topicId)
    const topic = getDatabase().select().from(schema.topics).where(eq(schema.topics.id, topicId)).get()
    if (!topic?.published_commit) throw new TopicError(503, 'Topic has no published version')
    const snapshot = await readTopicCommit(topicId, topic.published_commit)
    if (snapshot.topic.format_version === 2) return { topic_id: topicId, commit: topic.published_commit, skipped: true }
    if (snapshot.pages?.['pages/report.md'] !== undefined && snapshot.pages['pages/report.md'] !== snapshot.report) throw new TopicError(409, 'pages/report.md already contains another document; resolve the home-page conflict before migrating')
    await backfillTopicReferences(topicId)
    const numbers = topicReferenceInfo(topicId, snapshot).reference_numbers
    const commit = await commitTopicFiles(topicId, topic.published_commit, {
      'topic.json': JSON.stringify({ ...snapshot.topic, format_version: 2 }, null, 2) + '\n',
      'pages/report.md': { copy_from: 'report.md' },
      'report.md': null,
      'references.json': JSON.stringify({ format_version: 1, references: snapshot.list.papers.map(({ directory_ids, ...entry }) => ({ ...entry, reference_number: numbers[entry.id] })).sort((a, b) => a.reference_number - b.reference_number) }, null, 2) + '\n',
      'papers.json': null,
      [`workspace/legacy/papers-${topic.published_commit.slice(0, 12)}.json`]: { copy_from: 'papers.json' },
      ...(snapshot.agent_instructions === undefined ? { 'AGENTS.md': TOPIC_AGENT_GUIDE } : {}),
    }, identity, { message: 'Move published report into pages/' })
    return { topic_id: topicId, commit, previous_commit: topic.published_commit, skipped: false }
  })
}
