import { load, dump, JSON_SCHEMA } from 'js-yaml'
import type { TopicReportEntry, TopicReports } from '@paperland/shared'
import { isTopicPage } from './topic_paths.js'
import { TopicError } from './topic_error.js'

export const MAX_REPORT_DEPTH = 8
export const MAX_REPORT_NODES = 64
export function parseTopicReports(source: string, pages: string[]): TopicReports {
  const fail = (message: string): never => { throw new TopicError(422, `reports.yml: ${message}`) }
  try {
    const value = load(source, { schema: JSON_SCHEMA }) as any
    const mapping = (v: any, keys: string[]) => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).every((key) => keys.includes(key))
    if (!mapping(value, ['schema_version', 'default_page', 'reports']) || value.schema_version !== 1 || value.default_page !== 'pages/report.md' || !Array.isArray(value.reports)) fail('expected schema_version: 1, default_page: pages/report.md and reports array')
    const seen = new Set<string>(), available = new Set(pages)
    let count = 0
    function entries(items: any[], depth: number): TopicReportEntry[] {
      if (depth > MAX_REPORT_DEPTH) fail(`nesting exceeds ${MAX_REPORT_DEPTH} levels`)
      return items.map((node) => {
        if (++count > MAX_REPORT_NODES) fail(`more than ${MAX_REPORT_NODES} entries`)
        if (!mapping(node, ['path', 'title', 'fonticon', 'children'])) fail('entries must be page or group mappings')
        if (node.path !== undefined) {
          if (typeof node.path !== 'string' || !isTopicPage(node.path) || !available.has(node.path)) fail(`unknown or unsafe page: ${String(node.path)}`)
          if (seen.has(node.path)) fail(`duplicate page: ${node.path}`)
          if (node.title !== undefined || node.fonticon !== undefined) fail(`use frontmatter title/fonticon for ${node.path}`)
          seen.add(node.path)
        } else if (typeof node.title !== 'string' || !node.title.trim() || node.title.length > 200) fail('groups need a title of 1 to 200 characters')
        if (node.fonticon !== undefined && (typeof node.fonticon !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(node.fonticon))) fail('fonticon must be an icon name')
        if (node.children !== undefined && (!Array.isArray(node.children) || !node.children.length)) fail('children must be a non-empty array')
        if (node.path === undefined && node.children === undefined) fail('groups need children')
        return { ...(node.path === undefined ? { title: node.title.trim(), ...(node.fonticon === undefined ? {} : { fonticon: node.fonticon }) } : { path: node.path }), ...(node.children === undefined ? {} : { children: entries(node.children, depth + 1) }) }
      })
    }
    const reports = entries(value.reports, 1)
    for (const path of available) if (!seen.has(path)) fail(`page missing from reports: ${path}`)
    return { schema_version: 1, default_page: 'pages/report.md', reports }
  } catch (error) {
    if (error instanceof TopicError) throw error
    return fail((error as Error).message)
  }
}
export function serializeTopicReports(value: TopicReports): string { return dump(value, { noRefs: true, lineWidth: -1 }) }

/** Deterministic legacy fallback/migration; index pages become the folder's own page. */
export function defaultTopicReports(paths: string[]): TopicReports {
  type Node = { name: string; path?: string; children: Map<string, Node> }
  const root: Node = { name: '', children: new Map() }
  for (const path of [...paths].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    const parts = path.replace(/^pages\//, '').split('/'); let node = root
    for (const part of parts.slice(0, -1)) {
      if (!node.children.has(part)) node.children.set(part, { name: part, children: new Map() })
      node = node.children.get(part)!
    }
    const name = parts.at(-1)!
    if (name === 'index.md' && node !== root) node.path = path
    else node.children.set(name, { name, path, children: new Map() })
  }
  const convert = (node: Node): TopicReportEntry => ({ ...(node.path ? { path: node.path } : { title: node.name.replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase()) }), ...(node.children.size ? { children: [...node.children.values()].map(convert) } : {}) })
  const nodes = [...root.children.values()]
  nodes.sort((a, b) => Number(b.path === 'pages/report.md') - Number(a.path === 'pages/report.md'))
  return { schema_version: 1, default_page: 'pages/report.md', reports: nodes.map(convert) }
}
