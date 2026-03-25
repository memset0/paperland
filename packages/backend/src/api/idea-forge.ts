import type { FastifyInstance } from 'fastify'
import { readFileSync, writeFileSync, renameSync, existsSync, copyFileSync } from 'fs'
import { resolve } from 'path'
import { inArray, sql } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { getConfig } from '../config.js'
import type { IdeaCategory, Idea, IdeaDetail, IdeaForgeProject, ProjectConfig } from '@paperland/shared'
import { eq } from 'drizzle-orm'
import {
  getIdeaForgeRoot, getProjectPath, IDEA_CATEGORIES,
  isValidProjectName, isValidCategory, contentHash,
  listDirs, getDirCreatedAt, sanitizeDirName, ensureProjectDirs,
} from '../idea-forge/utils.js'
import { parseIdeaReadme, serializeIdeaReadme } from '../idea-forge/frontmatter.js'

/** Read the AGENTS.md template from demo-project if it exists */
function getAgentsMdTemplate(): string | null {
  const demoPath = resolve(getIdeaForgeRoot(), 'demo-project', 'AGENTS.md')
  if (existsSync(demoPath)) {
    return readFileSync(demoPath, 'utf-8')
  }
  return null
}

/** Read project.json config */
function readProjectConfig(projectPath: string): ProjectConfig {
  const configPath = resolve(projectPath, 'project.json')
  if (!existsSync(configPath)) return {}
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'))
  } catch {
    return {}
  }
}

/** Write project.json config */
function writeProjectConfig(projectPath: string, config: ProjectConfig): void {
  writeFileSync(resolve(projectPath, 'project.json'), JSON.stringify(config, null, 2), 'utf-8')
}

/** Scan a project and list all ideas across categories */
function scanIdeas(projectPath: string, options?: {
  category?: string
  tag?: string
  sort?: string
  order?: string
}): Idea[] {
  const ideas: Idea[] = []
  const categories = options?.category && isValidCategory(options.category)
    ? [options.category]
    : [...IDEA_CATEGORIES]

  for (const cat of categories) {
    const catDir = resolve(projectPath, 'ideas', cat)
    for (const dirName of listDirs(catDir)) {
      const readmePath = resolve(catDir, dirName, 'README.md')
      if (!existsSync(readmePath)) continue

      const raw = readFileSync(readmePath, 'utf-8')
      const { frontmatter, parse_error } = parseIdeaReadme(raw)

      const idea: Idea = {
        dir_name: dirName,
        category: cat as IdeaCategory,
        name: frontmatter.name,
        author: frontmatter.author,
        tags: frontmatter.tags,
        create_time: frontmatter.create_time,
        update_time: frontmatter.update_time,
        my_score: frontmatter.my_score,
        llm_score: frontmatter.llm_score,
        my_comment: frontmatter.my_comment,
        summary: frontmatter.summary,
        ...(parse_error ? { parse_error: true } : {}),
      }
      ideas.push(idea)
    }
  }

  // Filter by tag
  if (options?.tag) {
    const tagFilter = options.tag.toLowerCase()
    const filtered = ideas.filter(i => i.tags.some(t => t.toLowerCase().includes(tagFilter)))
    ideas.length = 0
    ideas.push(...filtered)
  }

  // Sort
  const sortField = options?.sort === 'create_time' ? 'create_time' : 'update_time'
  const sortAsc = options?.order === 'asc'
  ideas.sort((a, b) => {
    const av = a[sortField] || ''
    const bv = b[sortField] || ''
    return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
  })

  return ideas
}

/** Resolve paper content following content_priority */
function resolvePaperContent(contents: Record<string, string | null> | null): string {
  if (!contents) return ''
  const priority = getConfig().content_priority
  for (const key of priority) {
    if (contents[key]) return contents[key]!
  }
  return ''
}

export async function ideaForgeRoutes(app: FastifyInstance): Promise<void> {

  // ── Project endpoints ──

  // GET /api/idea-forge/projects
  app.get('/api/idea-forge/projects', async () => {
    const root = getIdeaForgeRoot()
    const projects: IdeaForgeProject[] = []

    for (const name of listDirs(root)) {
      const projectPath = getProjectPath(name)
      const ideas = scanIdeas(projectPath)
      const paperDirs = listDirs(resolve(projectPath, 'papers'))
      projects.push({
        name,
        idea_count: ideas.length,
        paper_count: paperDirs.length,
        created_at: getDirCreatedAt(projectPath),
        config: readProjectConfig(projectPath),
      })
    }

    return projects
  })

  // POST /api/idea-forge/projects
  app.post<{ Body: { name: string; paper_filter?: { tag_names: string[] } } }>(
    '/api/idea-forge/projects',
    async (request, reply) => {
      const { name, paper_filter } = request.body || {}
      if (!name || !isValidProjectName(name)) {
        reply.code(400).send({ error: { code: 'INVALID_NAME', message: 'Project name must match [a-z0-9][a-z0-9_-]*' } })
        return
      }

      const projectPath = getProjectPath(name)
      if (existsSync(projectPath)) {
        reply.code(409).send({ error: { code: 'PROJECT_EXISTS', message: 'A project with this name already exists' } })
        return
      }

      ensureProjectDirs(projectPath)

      // Copy AGENTS.md template from demo-project if available
      const template = getAgentsMdTemplate()
      const agentsPath = resolve(projectPath, 'AGENTS.md')
      if (template) {
        writeFileSync(agentsPath, template.replace(/demo-project/g, name), 'utf-8')
      }

      // Write project.json with paper filter if provided
      const config: ProjectConfig = {}
      if (paper_filter?.tag_names?.length) {
        config.paper_filter = { tag_names: paper_filter.tag_names }
      }
      writeProjectConfig(projectPath, config)

      return {
        name,
        idea_count: 0,
        paper_count: 0,
        created_at: getDirCreatedAt(projectPath),
        config,
      } as IdeaForgeProject
    }
  )

  // PATCH /api/idea-forge/projects/:name/config
  app.patch<{ Params: { name: string }; Body: { paper_filter?: { tag_names: string[] } } }>(
    '/api/idea-forge/projects/:name/config',
    async (request, reply) => {
      const projectPath = getProjectPath(request.params.name)
      if (!existsSync(projectPath)) {
        reply.code(404).send({ error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } })
        return
      }

      const config = readProjectConfig(projectPath)
      const { paper_filter } = request.body || {}

      if (paper_filter !== undefined) {
        if (paper_filter && paper_filter.tag_names?.length) {
          config.paper_filter = { tag_names: paper_filter.tag_names }
        } else {
          delete config.paper_filter
        }
      }

      writeProjectConfig(projectPath, config)
      return config
    }
  )

  // ── Idea endpoints ──

  // GET /api/idea-forge/projects/:name/ideas
  app.get<{ Params: { name: string }; Querystring: { category?: string; tag?: string; sort?: string; order?: string } }>(
    '/api/idea-forge/projects/:name/ideas',
    async (request, reply) => {
      const projectPath = getProjectPath(request.params.name)
      if (!existsSync(projectPath)) {
        reply.code(404).send({ error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } })
        return
      }

      if (request.query.category && !isValidCategory(request.query.category)) {
        reply.code(400).send({ error: { code: 'INVALID_CATEGORY', message: `Category must be one of: ${IDEA_CATEGORIES.join(', ')}` } })
        return
      }

      return scanIdeas(projectPath, request.query)
    }
  )

  // GET /api/idea-forge/projects/:name/ideas/:category/:ideaName
  app.get<{ Params: { name: string; category: string; ideaName: string } }>(
    '/api/idea-forge/projects/:name/ideas/:category/:ideaName',
    async (request, reply) => {
      const { name, category, ideaName } = request.params
      if (!isValidCategory(category)) {
        reply.code(400).send({ error: { code: 'INVALID_CATEGORY', message: `Category must be one of: ${IDEA_CATEGORIES.join(', ')}` } })
        return
      }

      const readmePath = resolve(getProjectPath(name), 'ideas', category, ideaName, 'README.md')
      if (!existsSync(readmePath)) {
        reply.code(404).send({ error: { code: 'IDEA_NOT_FOUND', message: 'Idea not found' } })
        return
      }

      const raw = readFileSync(readmePath, 'utf-8')
      const { frontmatter, body } = parseIdeaReadme(raw)

      return {
        frontmatter,
        body,
        content_hash: contentHash(raw),
        category: category as IdeaCategory,
        dir_name: ideaName,
      } as IdeaDetail
    }
  )

  // PUT /api/idea-forge/projects/:name/ideas/:category/:ideaName
  app.put<{ Params: { name: string; category: string; ideaName: string }; Body: { content_hash: string; frontmatter: Record<string, unknown>; body: string } }>(
    '/api/idea-forge/projects/:name/ideas/:category/:ideaName',
    async (request, reply) => {
      const { name, category, ideaName } = request.params
      if (!isValidCategory(category)) {
        reply.code(400).send({ error: { code: 'INVALID_CATEGORY', message: `Category must be one of: ${IDEA_CATEGORIES.join(', ')}` } })
        return
      }

      const readmePath = resolve(getProjectPath(name), 'ideas', category, ideaName, 'README.md')
      if (!existsSync(readmePath)) {
        reply.code(404).send({ error: { code: 'IDEA_NOT_FOUND', message: 'Idea not found' } })
        return
      }

      const { content_hash: expectedHash, frontmatter: newFm, body: newBody } = request.body
      const currentRaw = readFileSync(readmePath, 'utf-8')
      const currentHash = contentHash(currentRaw)

      if (expectedHash !== currentHash) {
        reply.code(409).send({ error: { code: 'CONFLICT', message: 'File has been modified externally' } })
        return
      }

      // Parse current to preserve unknown fields
      const { frontmatter: currentFm } = parseIdeaReadme(currentRaw)
      const mergedFm = { ...currentFm, ...newFm, update_time: new Date().toISOString() }
      const serialized = serializeIdeaReadme(mergedFm as any, newBody)
      writeFileSync(readmePath, serialized, 'utf-8')

      return {
        content_hash: contentHash(serialized),
        frontmatter: mergedFm,
      }
    }
  )

  // PATCH /api/idea-forge/projects/:name/ideas/:category/:ideaName/move
  app.patch<{ Params: { name: string; category: string; ideaName: string }; Body: { target_category: string; content_hash: string } }>(
    '/api/idea-forge/projects/:name/ideas/:category/:ideaName/move',
    async (request, reply) => {
      const { name, category, ideaName } = request.params
      const { target_category, content_hash: expectedHash } = request.body

      if (!isValidCategory(category)) {
        reply.code(400).send({ error: { code: 'INVALID_CATEGORY', message: `Category must be one of: ${IDEA_CATEGORIES.join(', ')}` } })
        return
      }

      if (!isValidCategory(target_category)) {
        reply.code(400).send({ error: { code: 'INVALID_CATEGORY', message: `Target category must be one of: ${IDEA_CATEGORIES.join(', ')}` } })
        return
      }

      if (category === target_category) {
        const readmePath = resolve(getProjectPath(name), 'ideas', category, ideaName, 'README.md')
        if (!existsSync(readmePath)) {
          reply.code(404).send({ error: { code: 'IDEA_NOT_FOUND', message: 'Idea not found' } })
          return
        }
        const raw = readFileSync(readmePath, 'utf-8')
        const { frontmatter, body } = parseIdeaReadme(raw)
        return { frontmatter, body, content_hash: contentHash(raw), category, dir_name: ideaName } as IdeaDetail
      }

      const projectPath = getProjectPath(name)
      const srcDir = resolve(projectPath, 'ideas', category, ideaName)
      const dstDir = resolve(projectPath, 'ideas', target_category, ideaName)

      if (!existsSync(srcDir)) {
        reply.code(404).send({ error: { code: 'IDEA_NOT_FOUND', message: 'Idea not found' } })
        return
      }

      if (existsSync(dstDir)) {
        reply.code(409).send({ error: { code: 'NAME_CONFLICT', message: 'Idea already exists in target category' } })
        return
      }

      // Check content hash before modifying
      const readmePath = resolve(srcDir, 'README.md')
      const currentRaw = readFileSync(readmePath, 'utf-8')
      const currentHash = contentHash(currentRaw)

      if (expectedHash !== currentHash) {
        reply.code(409).send({ error: { code: 'CONFLICT', message: 'File has been modified externally' } })
        return
      }

      // Update update_time in frontmatter before moving
      const { frontmatter, body } = parseIdeaReadme(currentRaw)
      frontmatter.update_time = new Date().toISOString()
      const serialized = serializeIdeaReadme(frontmatter, body)
      writeFileSync(readmePath, serialized, 'utf-8')

      // Move directory
      renameSync(srcDir, dstDir)

      const newReadmePath = resolve(dstDir, 'README.md')
      const newRaw = readFileSync(newReadmePath, 'utf-8')

      return {
        frontmatter,
        body,
        content_hash: contentHash(newRaw),
        category: target_category as IdeaCategory,
        dir_name: ideaName,
      } as IdeaDetail
    }
  )

  // ── Paper dump endpoint ──

  // POST /api/idea-forge/projects/:name/dump-papers
  app.post<{ Params: { name: string }; Body: { tag_ids?: number[]; paper_ids?: number[] } }>(
    '/api/idea-forge/projects/:name/dump-papers',
    async (request, reply) => {
      const projectPath = getProjectPath(request.params.name)
      if (!existsSync(projectPath)) {
        reply.code(404).send({ error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' } })
        return
      }

      const db = getDatabase()
      const { tag_ids, paper_ids } = request.body || {}

      let papers
      if (paper_ids && paper_ids.length > 0) {
        // Direct paper selection mode
        papers = db.select().from(schema.papers).where(inArray(schema.papers.id, paper_ids)).all()
      } else if (tag_ids && tag_ids.length > 0) {
        // Tag filter mode
        const rows = db.select({
          paper_id: schema.paperTags.paper_id,
          cnt: sql<number>`count(distinct ${schema.paperTags.tag_id})`.as('cnt'),
        })
          .from(schema.paperTags)
          .where(inArray(schema.paperTags.tag_id, tag_ids))
          .groupBy(schema.paperTags.paper_id)
          .all()
        const matchedIds = rows.filter(r => r.cnt === tag_ids.length).map(r => r.paper_id)
        if (matchedIds.length === 0) {
          return { dumped_count: 0, project_name: request.params.name }
        }
        papers = db.select().from(schema.papers).where(inArray(schema.papers.id, matchedIds)).all()
      } else {
        papers = db.select().from(schema.papers).all()
      }

      const papersDir = resolve(projectPath, 'papers')
      let dumpedCount = 0

      for (const paper of papers) {
        const dirName = sanitizeDirName(paper.title, paper.id)
        const paperDir = resolve(papersDir, dirName)
        const { mkdirSync } = await import('fs')
        mkdirSync(paperDir, { recursive: true })

        // Parse tags_json
        let tags: string[] = []
        if (paper.tags_json) {
          try {
            const parsed = JSON.parse(paper.tags_json)
            tags = Array.isArray(parsed) ? parsed.map((t: any) => t.name || t) : []
          } catch {}
        }

        // metadata.json
        const metadata = {
          id: paper.id,
          title: paper.title,
          authors: paper.authors,
          abstract: paper.abstract,
          arxiv_id: paper.arxiv_id,
          corpus_id: paper.corpus_id,
          link: paper.link,
          tags,
          created_at: paper.created_at,
          updated_at: paper.updated_at,
        }
        writeFileSync(resolve(paperDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8')

        // full_text.md
        const contents = typeof paper.contents === 'string' ? JSON.parse(paper.contents) : paper.contents
        const fullText = resolvePaperContent(contents)
        writeFileSync(resolve(paperDir, 'full_text.md'), fullText, 'utf-8')

        dumpedCount++
      }

      return { dumped_count: dumpedCount, project_name: request.params.name }
    }
  )
}
