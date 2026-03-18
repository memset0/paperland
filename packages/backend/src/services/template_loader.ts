import { readdirSync, readFileSync } from 'fs'
import { resolve, basename, extname } from 'path'

const TEMPLATES_DIR = resolve(process.cwd(), 'templates')

export interface Template {
  name: string
  content: string
}

export function loadTemplates(): Template[] {
  try {
    const files = readdirSync(TEMPLATES_DIR)
    return files
      .filter((f) => f.endsWith('.md'))
      .map((f) => ({
        name: basename(f, extname(f)),
        content: readFileSync(resolve(TEMPLATES_DIR, f), 'utf-8'),
      }))
  } catch {
    return []
  }
}

export function loadTemplate(name: string): Template | null {
  try {
    const filePath = resolve(TEMPLATES_DIR, `${name}.md`)
    const content = readFileSync(filePath, 'utf-8')
    return { name, content }
  } catch {
    return null
  }
}
