import type { TopicSchemaStatus, TopicSnapshot } from '@paperland/shared'
import { getConfig } from '../config.js'
import { TopicError } from './topic_error.js'
import { MAX_TOPIC_FILES, MAX_TOPIC_PAGES } from './topic_paths.js'
import { MAX_REPORT_DEPTH, MAX_REPORT_NODES } from './topic_reports.js'

export function topicSchemaStatus(snapshot: TopicSnapshot): TopicSchemaStatus {
  return { schema_version: snapshot.topic.schema_version ?? null, encoding: snapshot.topic.schema_version === 1 ? 'schema_v1' : snapshot.topic.format_version === 2 ? 'legacy_format_2' : 'legacy_format_1', current_schema_version: 1, supported_schema_versions: [1], supported_legacy_formats: [1, 2], migration_required: snapshot.topic.schema_version !== 1 }
}
export function topicSchemaContract(version: unknown = 1) {
  if (version !== 1) throw new TopicError(422, 'Unsupported Topic schema_version. Supported schema versions: 1. Omit schema_version to read the current contract.')
  return {
    schema_version: 1, current_schema_version: 1, supported_schema_versions: [1], supported_legacy_formats: [1, 2],
    required_files: ['topic.json', 'reports.yml', 'pages/report.md', 'references.json'],
    optional_files: ['AGENTS.md', 'README.md', 'pages/**/*.md', 'other safe workspace files'],
    examples: {
      'topic.json': { schema_version: 1, title: 'Research topic', description: '' },
      'reports.yml': 'schema_version: 1\ndefault_page: pages/report.md\nreports:\n  - path: pages/report.md\n  - path: pages/research-questions/index.md\n    children:\n      - path: pages/research-questions/rq1.md\n',
      'pages/report.md': '---\ntitle: Report\nfonticon: BookOpen\nreferences: [1]\n---\n# Research topic\n\nSee [1](#ref:1).\n',
      'pages/research-questions/index.md': '---\ntitle: Research questions\nfonticon: CircleHelp\nreferences: []\n---\n# Research questions\n',
      'pages/research-questions/rq1.md': '---\ntitle: RQ1 - Research question\nfonticon: FlaskConical\nreferences: [1]\n---\n# Research question\n\nResearch findings with [1](#ref:1).\n',
      'references.json': { format_version: 1, references: [{ id: 'paper-one', reference_number: 1, title: 'Use the verified title from Semantic Scholar', s2_id: 'CorpusId:13756489', comment: 'Research notes' }] },
    },
    navigation: 'reports.yml is the ordered navigation index. List every pages/**/*.md file exactly once, using {path, children?} for a page and {title, fonticon?, children} for a group. A group overview page has its children on the same entry, not a duplicated index row. Default is pages/report.md. Page labels/icons come from frontmatter; groups need a title and non-empty children. Root AGENTS.md is a separate guide and must not be listed.',
    stable_ids: 'A work has one stable ID, immutable source and reference_number, reused by any number of report frontmatter subsets. New entries append at get_topic.next_reference_number; removed numbers stay reserved. Use exactly one of paper_id, s2_id, or HTTP(S) url with citation metadata. Different method versions may be distinct works even with shared arXiv lineage. No push/read automatically imports papers.',
    reference_fields: { required: ['id', 'reference_number', 'title', 'exactly one of paper_id/s2_id/url'], optional: ['comment', 'authors', 'year', 'verification'], url_citation: { required: ['title'], optional: ['author', 'year', 'month', 'howpublished', 'note'] }, catalog_version: 'references.json format_version: 1 is the catalog encoding, distinct from the repository schema_version.' },
    pages: 'All reports are pages/**/*.md. YAML frontmatter: title, fonticon and references: [1, 3] with unique positive integers from this commit catalog. The same number can belong to many reports. Use [3](#ref:3), relative page links and read_pdf_page native Markdown citations. Clean URLs omit pages/ and .md; nested index.md uses the folder route. README.md never replaces pages/report.md.',
    fonticons: ['BookOpen','CircleHelp','FlaskConical','Bot','Code','Wrench','Sparkles','BrainCircuit','RefreshCw','Compass','Archive','MessagesSquare','Telescope','Target','Trophy','ChartNoAxesCombined','Library','ListChecks','GitBranch','History','Layers','Lightbulb','Search','FileText'],
    workspace: 'Root AGENTS.md is the agent guide; README.md describes the repo. Other safe regular files are a Git workspace, never executed/rendered by the website. All files share Topic permissions. No symlinks/submodules; executable mode only on auxiliary files. Keep secrets, PDFs and large media outside Git.',
    limits: { max_pages: MAX_TOPIC_PAGES, max_files: MAX_TOPIC_FILES, max_navigation_depth: MAX_REPORT_DEPTH, max_navigation_nodes: MAX_REPORT_NODES, max_file_bytes: getConfig().topics.max_file_bytes, max_total_bytes: getConfig().topics.max_file_bytes * 8, max_push_bytes: getConfig().topics.max_push_bytes, max_commits_per_push: getConfig().topics.max_commits_per_push },
    legacy_contracts: [
      { encoding: 'legacy_format_1', marker: { format_version: 1 }, required_files: ['topic.json', 'report.md', 'papers.json'], navigation: 'Folder-derived pages fallback; root report is home. Directory IDs are legacy associations.' },
      { encoding: 'legacy_format_2', marker: { format_version: 2 }, required_files: ['topic.json', 'pages/report.md', 'references.json'], navigation: 'Folder-derived pages fallback; pages/report.md is home.' },
    ],
    migrations: [
      { from: 'legacy_format_2', to_schema_version: 1, steps: ['Pull main and read get_topic(metadata_only=true) to inspect the selected/current encoding and all page paths.', 'Replace format_version in topic.json with schema_version: 1; preserve title/description. Do not declare both markers.', 'Add reports.yml with schema_version: 1, default_page: pages/report.md and an ordered tree listing every page once. Use page frontmatter for titles/icons.', 'Preserve all page bodies, references.json IDs/numbers/sources, workspace and custom AGENTS.md. Add a short guide note pointing to get_topic_schema if needed.', 'Review the complete diff, commit all required files together, and push main with a Plugins service key. On conflict fetch/reconcile instead of force pushing.', 'Read get_topic again and verify repository_schema.encoding is schema_v1. Historical commits remain unchanged.'] },
      { from: 'legacy_format_1', to_schema_version: 1, steps: ['Pull main, read get_topic(metadata_only=true), and record all authoritative reference_numbers.', 'Move report.md to pages/report.md without changing its body; resolve an existing conflicting target first.', 'Create references.json with format_version: 1 and references from papers.json.papers, preserving IDs, sources, comments and authoritative reference_number; omit directory_ids. Preserve papers.json in workspace/legacy/ before removing the root legacy file.', 'Follow the legacy_format_2 migration steps to add reports.yml and canonical topic.json. Preserve additional pages and custom agent workspace.'] },
    ],
    synchronization: 'Read this contract before editing. Clone/pull/commit/push main with a Plugins service key as the Git password. Every introduced commit must validate; documents, navigation and catalog publish together immediately. Fast-forward only; canonical repositories cannot downgrade. Use get_topic(metadata_only=true) or document=... for bounded reads. Unknown future schemas are rejected until a matching reader is implemented.',
  }
}
