import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { getConfig } from '../config.js'
import { getSystemPrompt } from './template_loader.js'
import { callModel } from './model_invoke.js'

function resolveContent(paper: any): string | null {
  const config = getConfig()
  const priority = config.content_priority || ['user_input', 'pdf_parsed']

  const contents = paper.contents
    ? (typeof paper.contents === 'string' ? JSON.parse(paper.contents) : paper.contents)
    : {}

  for (const key of priority) {
    if (contents[key]) return contents[key]
  }
  return null
}

export async function askQuestion(
  paperId: number,
  prompt: string,
  modelName: string
): Promise<{ answer: string; model_name: string }> {
  const db = getDatabase()
  const paper = db.select().from(schema.papers).where(eq(schema.papers.id, paperId)).get()
  if (!paper) throw new Error(`Paper ${paperId} not found`)

  const content = resolveContent(paper)
  if (!content) throw new Error('No content available for this paper. Please ensure PDF has been parsed or content has been provided.')

  const systemPrompt = getSystemPrompt()
  const fullPrompt = systemPrompt.replace('{PAPER}', content).replace('{PROMPT}', prompt)

  const answer = await callModel(fullPrompt, modelName)
  return { answer, model_name: modelName }
}

export { resolveContent }
