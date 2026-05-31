import { getConfig } from '../config.js'

// Shared model-invocation helper. Given a fully-assembled prompt and a model name (from
// config.models.available), dispatch to the right backend (OpenAI-compatible HTTP API, codex CLI,
// or claude/codex CLI) and return the model's text output. Used by qa_service and translation_service.

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
      max_tokens: 8192,
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

  // Pass prompt via stdin with '-' argument to avoid E2BIG for long content
  const fullCmd = `${shell} -`

  const proc = Bun.spawn(['bash', '-c', fullCmd], {
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: new TextEncoder().encode(prompt),
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

  const proc = Bun.spawn([cmd, '-p', '-'], {
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: new TextEncoder().encode(prompt),
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

/** Run a prompt against the named model (from config.models.available) and return its text output. */
export async function callModel(prompt: string, modelName: string): Promise<string> {
  const config = getConfig()
  const modelConfig = config.models.available.find((m) => m.name === modelName)
  if (!modelConfig) throw new Error(`Model ${modelName} not found in config`)

  if (modelConfig.type === 'openai_api') {
    return callOpenAI(prompt, modelConfig)
  } else if (modelConfig.type === 'codex') {
    return callCodex(prompt, modelConfig)
  } else {
    // claude_cli or codex_cli (legacy)
    return callCLI(prompt, modelConfig)
  }
}
