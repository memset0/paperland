import matter from 'gray-matter'
import type { IdeaFrontmatter } from '@paperland/shared'

const DEFAULTS: Omit<IdeaFrontmatter, 'name' | 'create_time' | 'update_time'> = {
  author: '',
  tags: [],
  my_score: 0,
  llm_score: 0,
  my_comment: '',
  summary: '',
}

export interface ParsedIdea {
  frontmatter: IdeaFrontmatter
  body: string
  parse_error: boolean
}

/** Parse a README.md file content into frontmatter + body */
export function parseIdeaReadme(content: string): ParsedIdea {
  try {
    const { data, content: body } = matter(content)
    const frontmatter: IdeaFrontmatter = {
      ...DEFAULTS,
      ...data,
      name: data.name || '',
      create_time: data.create_time || '',
      update_time: data.update_time || '',
    }
    return { frontmatter, body: body.trim(), parse_error: false }
  } catch {
    return {
      frontmatter: {
        ...DEFAULTS,
        name: '',
        create_time: '',
        update_time: '',
      },
      body: content,
      parse_error: true,
    }
  }
}

/** Serialize frontmatter + body back to README.md content */
export function serializeIdeaReadme(frontmatter: IdeaFrontmatter, body: string): string {
  return matter.stringify(body.endsWith('\n') ? body : body + '\n', frontmatter)
}
