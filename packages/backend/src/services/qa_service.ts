import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { getConfig } from '../config.js'
import { getSystemPrompt } from './template_loader.js'

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

async function callCodex(prompt: string, modelConfig: any): Promise<string> {
  const shell = modelConfig.shell
  if (!shell) throw new Error('Codex model missing "shell" config (e.g. \'codex exec --skip-git-repo-check --model "gpt-5.4"\')')

  const timeoutMs = (modelConfig.timeout || 120) * 1000

  // Use shell command with prompt as quoted argument
  const fullCmd = `${shell} ${shellQuote(prompt)}`

  const proc = Bun.spawn(['bash', '-c', fullCmd], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,  // Explicitly inherit all env vars (critical for multi-codex setups)
  })

  // Race between process completion and timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      proc.kill()
      reject(new Error(`Codex CLI timed out after ${modelConfig.timeout || 120}s`))
    }, timeoutMs)
  })

  try {
    const [output, exitCode] = await Promise.race([
      Promise.all([new Response(proc.stdout).text(), proc.exited]),
      timeoutPromise.then(() => { throw new Error('timeout') }),
    ]) as [string, number]

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text()
      throw new Error(`Codex CLI failed (exit ${exitCode}): ${stderr.slice(0, 500)}`)
    }

    return output.trim()
  } catch (err) {
    proc.kill()
    throw err
  }
}

async function callCLI(prompt: string, modelConfig: any): Promise<string> {
  // Claude CLI: use -p flag for single prompt
  const cmd = modelConfig.type === 'claude_cli' ? 'claude' : 'codex'
  const timeoutMs = (modelConfig.timeout || 120) * 1000

  const proc = Bun.spawn([cmd, '-p', prompt], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  })

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      proc.kill()
      reject(new Error(`${cmd} CLI timed out after ${modelConfig.timeout || 120}s`))
    }, timeoutMs)
  })

  try {
    const [output, exitCode] = await Promise.race([
      Promise.all([new Response(proc.stdout).text(), proc.exited]),
      timeoutPromise.then(() => { throw new Error('timeout') }),
    ]) as [string, number]

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text()
      throw new Error(`${cmd} CLI failed (exit ${exitCode}): ${stderr.slice(0, 500)}`)
    }

    return output.trim()
  } catch (err) {
    proc.kill()
    throw err
  }
}

function shellQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'"
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
