import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { ModelConfig } from '@paperland/shared'
import { appServerInput, codexProvider, execArgs, mcpTokenEnvVar } from './codex_provider.js'
import type { ModelToolCallEvent } from './types.js'

let fixtureDir = ''
let codexHome = ''

function executable(name: string, source: string): string {
  const file = join(fixtureDir, name)
  writeFileSync(file, `#!/bin/sh\n${source}\n`, 'utf8')
  chmodSync(file, 0o700)
  return file
}

function appServerConfig(cliPath: string, overrides: Partial<ModelConfig> = {}): ModelConfig {
  return {
    name: 'codex-stream',
    type: 'codex',
    stream: true,
    cli_path: cliPath,
    codex_home: codexHome,
    model_id: 'gpt-5.3-codex-spark',
    reasoning_effort: 'xhigh',
    timeout: 2,
    ...overrides,
  }
}

beforeAll(() => {
  fixtureDir = mkdtempSync(join(tmpdir(), 'paperland-codex-provider-test-'))
  codexHome = join(fixtureDir, 'codex-home')
  mkdirSync(codexHome)
})

afterAll(() => {
  rmSync(fixtureDir, { recursive: true, force: true })
})

describe('CodexProvider', () => {
  test('stream:false appends ephemeral and stdin sentinel while returning one final string', async () => {
    const config: ModelConfig = {
      name: 'codex-exec',
      type: 'codex',
      stream: false,
      shell: `sh -c 'test "$1" = "--ephemeral" && test "$2" = "-" && printf codex-final' check`,
      timeout: 2,
    }
    const deltas: string[] = []
    await expect(codexProvider.invoke('long prompt', config, { onChunk: (delta) => { deltas.push(delta) } })).resolves.toBe('codex-final')
    expect(deltas).toEqual([])
  })

  test('app-server filters commentary, streams final-answer deltas, and returns final text', async () => {
    const cliPath = executable('fake-codex-success', `
IFS= read -r initialize
printf '%s\n' '{"id":0,"result":{}}'
IFS= read -r initialized
IFS= read -r thread_start
printf '%s\n' '{"id":1,"result":{"thread":{"id":"thread-1","ephemeral":true}}}'
IFS= read -r turn_start
printf '%s\n' '{"id":2,"result":{"turn":{"id":"turn-1"}}}'
printf '%s\n' '{"method":"item/started","params":{"item":{"type":"agentMessage","id":"comment","phase":"commentary"}}}'
printf '%s\n' '{"method":"item/agentMessage/delta","params":{"itemId":"comment","delta":"ignore"}}'
printf '%s\n' '{"method":"item/started","params":{"item":{"type":"agentMessage","id":"final","phase":"final_answer"}}}'
printf '%s' '{"method":"item/agentMessage/delta","params":{"itemId":"final","delta":"第一'
printf '%s\n' '段"}}'
printf '%s\n' '{"method":"unknown/future","params":{}}'
printf '%s\n' '{"method":"item/agentMessage/delta","params":{"itemId":"final","delta":"第二段"}}'
printf '%s\n' '{"method":"item/completed","params":{"item":{"type":"agentMessage","id":"final","phase":"final_answer","text":"第一段第二段"}}}'
printf '%s\n' '{"method":"turn/completed","params":{"turn":{"id":"turn-1","status":"completed"}}}'
exec sleep 1`)
    const deltas: string[] = []
    const result = await codexProvider.invoke('translate me', appServerConfig(cliPath), {
      onChunk: (delta) => { deltas.push(delta) },
    })
    expect(deltas).toEqual(['第一段', '第二段'])
    expect(result).toBe('第一段第二段')

    await expect(codexProvider.invoke('translate me', appServerConfig(cliPath))).resolves.toBe('第一段第二段')
  })

  test('fails closed when app-server does not confirm ephemeral', async () => {
    const cliPath = executable('fake-codex-persisted', `
IFS= read -r initialize
printf '%s\n' '{"id":0,"result":{}}'
IFS= read -r initialized
IFS= read -r thread_start
printf '%s\n' '{"id":1,"result":{"thread":{"id":"thread-1","ephemeral":false}}}'
exec sleep 1`)
    await expect(codexProvider.invoke('translate', appServerConfig(cliPath))).rejects.toThrow('refused an ephemeral thread')
  })

  test('reports failed turns and empty final answers', async () => {
    const failed = executable('fake-codex-failed', `
IFS= read -r initialize; printf '%s\n' '{"id":0,"result":{}}'
IFS= read -r initialized; IFS= read -r thread_start
printf '%s\n' '{"id":1,"result":{"thread":{"id":"thread-1","ephemeral":true}}}'
IFS= read -r turn_start
printf '%s\n' '{"id":2,"result":{"turn":{"id":"turn-1"}}}'
printf '%s\n' '{"method":"turn/completed","params":{"turn":{"id":"turn-1","status":"failed","error":{"message":"provider failed"}}}}'
exec sleep 1`)
    await expect(codexProvider.invoke('translate', appServerConfig(failed))).rejects.toThrow('provider failed')

    const empty = executable('fake-codex-empty', `
IFS= read -r initialize; printf '%s\n' '{"id":0,"result":{}}'
IFS= read -r initialized; IFS= read -r thread_start
printf '%s\n' '{"id":1,"result":{"thread":{"id":"thread-1","ephemeral":true}}}'
IFS= read -r turn_start
printf '%s\n' '{"id":2,"result":{"turn":{"id":"turn-1"}}}'
printf '%s\n' '{"method":"item/started","params":{"item":{"type":"agentMessage","id":"final","phase":"final_answer"}}}'
printf '%s\n' '{"method":"item/completed","params":{"item":{"type":"agentMessage","id":"final","phase":"final_answer","text":""}}}'
printf '%s\n' '{"method":"turn/completed","params":{"turn":{"id":"turn-1","status":"completed"}}}'
exec sleep 1`)
    await expect(codexProvider.invoke('translate', appServerConfig(empty))).rejects.toThrow('no final answer')
  })

  test('kills app-server on timeout and abort', async () => {
    const hanging = executable('fake-codex-hanging', 'IFS= read -r initialize\nexec sleep 5')
    await expect(codexProvider.invoke('translate', appServerConfig(hanging, { timeout: 0.05 }))).rejects.toThrow('timed out')

    const controller = new AbortController()
    setTimeout(() => controller.abort(), 20)
    await expect(codexProvider.invoke('translate', appServerConfig(hanging), { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('CodexProvider structured input', () => {
  const structured = {
    system: "Rules: don't invent ids",
    user: [
      { type: 'text' as const, text: '<question>What is @Image1?</question>' },
      { type: 'image' as const, path: '/data/images/a b.png', mime: 'image/png' },
    ],
    web_search: true,
  }

  test('exec passes the system prompt, web search, and images as flags and keeps text on stdin', async () => {
    expect(execArgs(structured)).toBe(
      ` -c 'developer_instructions="Rules: don'\\''t invent ids"' -c 'web_search="live"' --image '/data/images/a b.png'`)
    const argsFile = join(fixtureDir, 'exec-args.txt')
    const stdinFile = join(fixtureDir, 'exec-stdin.txt')
    const config: ModelConfig = {
      name: 'codex-exec',
      type: 'codex',
      stream: false,
      shell: `sh -c 'printf "%s\\n" "$@" > ${argsFile}; cat > ${stdinFile}; printf done' check`,
      timeout: 2,
    }
    await expect(codexProvider.invoke(structured, config)).resolves.toBe('done')
    expect(require('fs').readFileSync(argsFile, 'utf8').split('\n').filter(Boolean)).toEqual([
      '-c', `developer_instructions="Rules: don't invent ids"`, '-c', 'web_search="live"',
      '--image', '/data/images/a b.png', '--ephemeral', '-',
    ])
    expect(require('fs').readFileSync(stdinFile, 'utf8')).toBe('<question>What is @Image1?</question>')
  })

  test('app-server sends developerInstructions, web search config, and localImage items', async () => {
    const logFile = join(fixtureDir, 'app-server-log.txt')
    const cliPath = executable('fake-codex-structured', `
IFS= read -r initialize
printf '%s\n' '{"id":0,"result":{}}'
IFS= read -r initialized
IFS= read -r thread_start
printf '%s\n' "$thread_start" > ${logFile}
printf '%s\n' '{"id":1,"result":{"thread":{"id":"thread-1","ephemeral":true}}}'
IFS= read -r turn_start
printf '%s\n' "$turn_start" >> ${logFile}
printf '%s\n' '{"id":2,"result":{"turn":{"id":"turn-1"}}}'
printf '%s\n' '{"method":"item/started","params":{"item":{"type":"agentMessage","id":"final","phase":"final_answer"}}}'
printf '%s\n' '{"method":"item/completed","params":{"item":{"type":"agentMessage","id":"final","phase":"final_answer","text":"ok"}}}'
printf '%s\n' '{"method":"turn/completed","params":{"turn":{"id":"turn-1","status":"completed"}}}'
exec sleep 1`)
    await expect(codexProvider.invoke(structured, appServerConfig(cliPath))).resolves.toBe('ok')
    const [threadStart, turnStart] = require('fs').readFileSync(logFile, 'utf8').trim().split('\n').map((line: string) => JSON.parse(line))
    expect(threadStart.params.developerInstructions).toBe(structured.system)
    expect(threadStart.params.baseInstructions).toBeUndefined()
    expect(threadStart.params.config).toEqual({ web_search: 'live' })
    expect(turnStart.params.input).toEqual(appServerInput(structured))
    expect(turnStart.params.input[1]).toEqual({ type: 'localImage', path: '/data/images/a b.png' })
  })

  test('app-server sets skill roots, attaches MCP servers with the token in env, and reports tool calls', async () => {
    const logFile = join(fixtureDir, 'app-server-mcp-log.txt')
    const envVar = mcpTokenEnvVar('paperland')
    const cliPath = executable('fake-codex-mcp', `
IFS= read -r initialize
printf '%s\n' '{"id":0,"result":{}}'
IFS= read -r initialized
IFS= read -r skills
printf '%s\n' "$skills" > ${logFile}
printf '%s\n' '{"id":10,"result":{}}'
IFS= read -r thread_start
printf '%s\n' "$thread_start" >> ${logFile}
printf '{"token":"%s"}\n' "$${envVar}" >> ${logFile}
printf '%s\n' '{"id":1,"result":{"thread":{"id":"thread-1","ephemeral":true}}}'
IFS= read -r turn_start
printf '%s\n' '{"id":2,"result":{"turn":{"id":"turn-1"}}}'
printf '%s\n' '{"method":"item/started","params":{"item":{"type":"mcpToolCall","id":"t1","server":"paperland","tool":"s2_search","status":"inProgress"}}}'
printf '%s\n' '{"method":"item/completed","params":{"item":{"type":"mcpToolCall","id":"t1","server":"paperland","tool":"s2_search","status":"completed"}}}'
printf '%s\n' '{"method":"item/started","params":{"item":{"type":"agentMessage","id":"final","phase":"final_answer"}}}'
printf '%s\n' '{"method":"item/completed","params":{"item":{"type":"agentMessage","id":"final","phase":"final_answer","text":"ok"}}}'
printf '%s\n' '{"method":"turn/completed","params":{"turn":{"id":"turn-1","status":"completed"}}}'
exec sleep 1`)
    const events: ModelToolCallEvent[] = []
    const input = {
      user: [{ type: 'text' as const, text: 'go' }],
      web_search: true,
      mcp_servers: [{ name: 'paperland', url: 'http://127.0.0.1:3000/mcp', bearer_token: 'secret-token' }],
      skill_roots: ['/repo/prompts/skills'],
    }
    await expect(codexProvider.invoke(input, appServerConfig(cliPath), { onToolCall: (e) => { events.push(e) } })).resolves.toBe('ok')
    const [skills, threadStart, env] = require('fs').readFileSync(logFile, 'utf8').trim().split('\n').map((line: string) => JSON.parse(line))
    expect(skills).toMatchObject({ method: 'skills/extraRoots/set', id: 10, params: { extraRoots: ['/repo/prompts/skills'] } })
    expect(threadStart.params.config).toEqual({
      web_search: 'live',
      mcp_servers: { paperland: { url: 'http://127.0.0.1:3000/mcp', bearer_token_env_var: envVar } },
    })
    expect(JSON.stringify(threadStart)).not.toContain('secret-token')
    expect(env.token).toBe('secret-token')
    expect(events).toEqual([
      { server: 'paperland', tool: 's2_search', status: 'started' },
      { server: 'paperland', tool: 's2_search', status: 'completed' },
    ])
  })
})
