import { resolve } from 'path'
import { readdirSync, statSync, mkdirSync, existsSync } from 'fs'
import { createHash } from 'crypto'

/** Root path for all idea-forge projects */
export function getIdeaForgeRoot(): string {
  return resolve(process.cwd(), 'data', 'idea-forge')
}

/** Resolve a project path */
export function getProjectPath(projectName: string): string {
  return resolve(getIdeaForgeRoot(), projectName)
}

/** Valid idea categories */
export const IDEA_CATEGORIES = ['unreviewed', 'under-review', 'validating', 'archived'] as const

/** Validate project name: lowercase alphanumeric + hyphens + underscores */
export function isValidProjectName(name: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/.test(name)
}

/** Validate idea category */
export function isValidCategory(category: string): category is typeof IDEA_CATEGORIES[number] {
  return (IDEA_CATEGORIES as readonly string[]).includes(category)
}

/** Compute SHA-256 hash of content */
export function contentHash(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex')
}

/** List subdirectories in a directory */
export function listDirs(dirPath: string): string[] {
  if (!existsSync(dirPath)) return []
  return readdirSync(dirPath, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
}

/** Get directory creation time as ISO string */
export function getDirCreatedAt(dirPath: string): string {
  try {
    const stat = statSync(dirPath)
    return stat.birthtime.toISOString()
  } catch {
    return new Date().toISOString()
  }
}

/** Sanitize a paper title for use as directory name */
export function sanitizeDirName(title: string, paperId: number): string {
  const sanitized = title
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 100)
  return `${sanitized}-${paperId}`
}

/** Ensure idea-forge root and a project's full directory structure exists */
export function ensureProjectDirs(projectPath: string): void {
  mkdirSync(resolve(projectPath, 'papers'), { recursive: true })
  for (const cat of IDEA_CATEGORIES) {
    mkdirSync(resolve(projectPath, 'ideas', cat), { recursive: true })
  }
}

/** Ensure the idea-forge root directory exists */
export function ensureIdeaForgeRoot(): void {
  mkdirSync(getIdeaForgeRoot(), { recursive: true })
}
