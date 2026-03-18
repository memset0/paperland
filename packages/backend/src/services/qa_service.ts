import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { getConfig } from '../config.js'

function resolveContent(paper: any): string | null {
  const config = getConfig()
  const priority = config.content_priority || ['user_input', 'alphaxiv', 'pdf_parsed']

  const contents = paper.contents
    ? (typeof paper.contents === 'string' ? JSON.parse(paper.contents) : paper.contents)
    : {}

  for (const key of priority) {
    if (contents[key]) return contents[key]
  }
  return null
}

async function callOpenAI(prompt: string, modelConfig: any): Promise<string> {
  const apiKey = process.env[modelConfig.api_key_env || 'OPENAI_API_KEY']
  if (!apiKey) throw new Error(`API key not found in env: ${modelConfig.api_key_env}`)

  const endpoint = modelConfig.endpoint || 'https://api.openai.com/v1'
  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelConfig.name,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI API error ${response.status}: ${err}`)
  }

  const data = await response.json() as any
  return data.choices?.[0]?.message?.content || ''
}

async function callCLI(prompt: string, modelConfig: any): Promise<string> {
  const cmd = modelConfig.type === 'claude_cli' ? 'claude' : 'codex'
  const proc = Bun.spawn([cmd, '-p', prompt], {
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const output = await new Response(proc.stdout).text()
  const exitCode = await proc.exited

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(`${cmd} CLI failed: ${stderr}`)
  }

  return output.trim()
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

  const fullPrompt = prompt.includes('{{content}}')
    ? prompt.replace('{{content}}', content)
    : `${prompt}\n\n论文内容：\n${content}`

  const config = getConfig()
  const modelConfig = config.models.available.find((m) => m.name === modelName)
  if (!modelConfig) throw new Error(`Model ${modelName} not found in config`)

  let answer: string
  if (modelConfig.type === 'openai_api') {
    answer = await callOpenAI(fullPrompt, modelConfig)
  } else {
    answer = await callCLI(fullPrompt, modelConfig)
  }

  return { answer, model_name: modelName }
}

export { resolveContent }
