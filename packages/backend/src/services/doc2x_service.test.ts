import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { PDFDocument } from 'pdf-lib'
import { loadConfig } from '../config.js'
import { describeDoc2xFailure, runDoc2x } from './doc2x_cli.js'
import { doc2xParseService, isDoc2xParseEligible } from './doc2x_parse_service.js'
import { cropRightHalf, doc2xTranslateService, isDoc2xTranslateEligible } from './doc2x_translate_service.js'
import { translateFromParse } from './doc2x_gateway.js'

// These tests use a fake doc2x executable — they never call the real CLI (no quota spent).
let dir = ''
let fakeCli = ''

function writeConfig(extra: string): void {
  const file = join(dir, `config-${Math.random().toString(16).slice(2)}.yml`)
  writeFileSync(file, `
database: { type: sqlite, path: ':memory:' }
auth: { enabled: false }
models:
  default: m
  available:
    - { name: m, type: openai_api, endpoint: https://example.test/v1 }
qa:
  - { name: summary, prompt: Summary }
translation: { prompt: 'Translate {TEXT}' }
${extra}
`, 'utf8')
  loadConfig(file)
}

/** Fake CLI: records its argv, then behaves per FAKE_MODE (parse | translate | auth | fail | hang). */
function writeFakeCli(): void {
  fakeCli = join(dir, 'doc2x')
  writeFileSync(fakeCli, `#!/usr/bin/env bun
const { writeFileSync, mkdirSync } = require('fs')
const { join } = require('path')
const args = process.argv.slice(2)
writeFileSync(${JSON.stringify(join(dirTemplate(), 'argv.json'))}, JSON.stringify(args))
const mode = process.env.FAKE_MODE
const out = args[args.indexOf('--out') + 1]
const name = args[args.indexOf('--name') + 1]
if (mode === 'auth') { console.error(JSON.stringify({ error: 'unauthorized', exitCode: 2 })); process.exit(2) }
if (mode === 'fail') { console.error(JSON.stringify({ error: 'Task did not complete (quota)', exitCode: 4 })); process.exit(4) }
if (mode === 'hang') { setTimeout(() => {}, 60000); return }
mkdirSync(out, { recursive: true })
if (mode === 'translate') {
  const { PDFDocument } = require(${JSON.stringify(require.resolve('pdf-lib'))})
  PDFDocument.create().then(async (doc) => {
    doc.addPage([1224, 792]); doc.addPage([1224, 792])
    const file = join(out, name + '.pdf')
    writeFileSync(file, await doc.save())
    console.log(JSON.stringify({ outputFiles: [file], receipt: { taskIds: { parseId: 'op_cli', translateId: 'ot_cli' } } }))
  })
} else {
  const file = join(out, name + '.md')
  writeFileSync(file, '# Title\\n\\n$x$\\n\\n## REFERENCES\\n\\n[1] ref')
  console.log(JSON.stringify({ outputFiles: [file], receipt: { taskIds: { parseId: 'op_fake' } } }))
}
`, 'utf8')
  chmodSync(fakeCli, 0o755)
}
function dirTemplate() { return dir }

const lastArgv = () => JSON.parse(readFileSync(join(dir, 'argv.json'), 'utf8')) as string[]
const baseDoc2x = () => `doc2x:
  enabled: true
  cli_path: ${fakeCli}
  timeout: 5
  output_dir: ${join(dir, 'out')}
  auto_since: '2026-10-09T00:00:00Z'
  token_file: ${join(dir, 'tokens.json')}
  gateway_url: https://gateway.test`

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'paperland-doc2x-test-'))
  writeFakeCli()
  writeFileSync(join(dir, 'paper.pdf'), 'pdf')
})
afterAll(() => {
  delete process.env.FAKE_MODE
  rmSync(dir, { recursive: true, force: true })
})

describe('doc2x CLI wrapper', () => {
  test('missing binary reports install hint', async () => {
    await expect(runDoc2x(['parse', 'x'], { cliPath: join(dir, 'nope'), timeoutSeconds: 5 }))
      .rejects.toThrow(/未检测到 doc2x CLI/)
  })

  test('exit code 2 asks for doc2x login', async () => {
    process.env.FAKE_MODE = 'auth'
    await expect(runDoc2x(['parse', 'x', '--out', dir, '--name', 'n'], { cliPath: fakeCli, timeoutSeconds: 5 }))
      .rejects.toThrow(/doc2x login/)
  })

  test('other failures surface the CLI error', async () => {
    process.env.FAKE_MODE = 'fail'
    await expect(runDoc2x(['parse', 'x', '--out', dir, '--name', 'n'], { cliPath: fakeCli, timeoutSeconds: 5 }))
      .rejects.toThrow(/quota/)
    expect(describeDoc2xFailure(3, '', 'plain text error')).toContain('plain text error')
  })

  test('timeouts kill the process', async () => {
    process.env.FAKE_MODE = 'hang'
    await expect(runDoc2x(['parse', 'x', '--out', dir, '--name', 'n'], { cliPath: fakeCli, timeoutSeconds: 0.3 }))
      .rejects.toThrow(/超时/)
  })
})

describe('doc2x parse service', () => {
  test('eligibility: new papers, explicit requests, never without PDF or when disabled', () => {
    writeConfig(baseDoc2x())
    expect(isDoc2xParseEligible({ pdf_path: 'a.pdf', created_at: '2026-10-10T00:00:00Z' })).toBe(true)
    expect(isDoc2xParseEligible({ pdf_path: 'a.pdf', created_at: '2026-01-01T00:00:00Z' })).toBe(false)
    expect(isDoc2xParseEligible({ pdf_path: 'a.pdf', created_at: '2026-01-01T00:00:00Z', metadata: '{"doc2x_parse_requested":"t"}' })).toBe(true)
    expect(isDoc2xParseEligible({ pdf_path: null, created_at: '2026-10-10T00:00:00Z' })).toBe(false)
    writeConfig('')
    expect(isDoc2xParseEligible({ pdf_path: 'a.pdf', created_at: '2026-10-10T00:00:00Z' })).toBe(false)
  })

  test('produces contents.doc2x_parsed with dollar formulas and references kept', async () => {
    writeConfig(baseDoc2x())
    process.env.FAKE_MODE = 'parse'
    const result = await doc2xParseService.execute(7, { pdf_path: join(dir, 'paper.pdf') })
    expect(result['contents.doc2x_parsed']).toContain('REFERENCES')
    expect(result.doc2x_parse_id).toBe('op_fake')
    expect(lastArgv()).toEqual(expect.arrayContaining(['parse', '--to', 'md', '--formula-mode', 'dollar', '--overwrite']))
    expect(existsSync(join(dir, 'out', '7', 'parse', 'paper.md'))).toBe(true)
  })
})

describe('doc2x translate service', () => {
  test('eligibility requires a request and a finished doc2x parse', () => {
    writeConfig(baseDoc2x())
    const requested = '{"doc2x_translate_requested":"t"}'
    expect(isDoc2xTranslateEligible({ pdf_path: 'a.pdf', metadata: requested, contents: '{"doc2x_parsed":"md"}' })).toBe(true)
    expect(isDoc2xTranslateEligible({ pdf_path: 'a.pdf', metadata: requested, contents: '{}' })).toBe(false)
    expect(isDoc2xTranslateEligible({ pdf_path: 'a.pdf', metadata: '{}', contents: '{"doc2x_parsed":"md"}' })).toBe(false)
  })

  test('cropRightHalf keeps page count and halves the width', async () => {
    const doc = await PDFDocument.create()
    doc.addPage([1224, 792]); doc.addPage([1224, 792]); doc.addPage([1224, 792])
    const cropped = await PDFDocument.load(await cropRightHalf(await doc.save()))
    expect(cropped.getPageCount()).toBe(3)
    for (const page of cropped.getPages()) {
      expect(page.getCropBox()).toEqual({ x: 612, y: 0, width: 612, height: 792 })
      expect(page.getMediaBox().width).toBe(612)
    }
  })

  test('translates with configured model, skips references, writes both PDFs', async () => {
    writeConfig(`${baseDoc2x()}
  translate:
    model: '85'`)
    process.env.FAKE_MODE = 'translate'
    const { doc2x_translation: t } = await doc2xTranslateService.execute(9, { pdf_path: join(dir, 'paper.pdf') })
    const argv = lastArgv()
    expect(argv).toEqual(expect.arrayContaining(['translate', '--translate-type', 'pdf', '--target-model', '85', '--ignore-translate-types', 'reference']))
    expect(t.model).toBe('85')
    expect(t).toMatchObject({ parse_id: 'op_cli', translate_id: 'ot_cli' })
    const translated = await PDFDocument.load(readFileSync(join(process.cwd(), t.translated_pdf_path)))
    expect(translated.getPageCount()).toBe(2)
    expect(existsSync(join(process.cwd(), t.bilingual_pdf_path))).toBe(true)
  })
})

describe('doc2x gateway: translate from an existing parse', () => {
  const realFetch = globalThis.fetch
  async function bilingualPdf() {
    const doc = await PDFDocument.create()
    doc.addPage([1224, 792]); doc.addPage([1224, 792])
    return doc.save()
  }
  function mockGateway(opts: { failCreate?: boolean } = {}) {
    const calls: Array<{ path: string; body: any }> = []
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = String(input)
      if (url === 'https://files.test/bilingual.pdf') return new Response(await bilingualPdf())
      const path = url.replace('https://gateway.test/gateway.v1.TaskService/', '')
      calls.push({ path, body: JSON.parse(init.body) })
      expect(init.headers.Authorization).toBe('Bearer tok')
      const ok = (data: any) => new Response(JSON.stringify({ code: 'success', data }), { headers: { 'Content-Type': 'application/json' } })
      if (path === 'CreateTranslateTask') {
        return opts.failCreate
          ? new Response(JSON.stringify({ code: 'quota_exceeded', msg: 'no points' }), { headers: { 'Content-Type': 'application/json' } })
          : ok({ output_id: 'ot_gw' })
      }
      if (path === 'GetTaskStatus') return ok({ status: 2, progress: 100 })
      if (path === 'CreateExternalPDFMergeTask') return ok({ result: 'https://files.test/bilingual.pdf' })
      throw new Error(`unexpected ${url}`)
    }) as any
    return calls
  }
  afterAll(() => { globalThis.fetch = realFetch })

  test('reuses the parse id and writes the merged PDF', async () => {
    writeConfig(baseDoc2x())
    writeFileSync(join(dir, 'tokens.json'), JSON.stringify({ accessToken: 'tok', expiresAt: Date.now() + 3600_000 }))
    const calls = mockGateway()
    const out = join(dir, 'gw', 'bilingual.pdf')
    expect(await translateFromParse('op_123', out)).toEqual({ translateId: 'ot_gw' })
    expect(calls[0]).toMatchObject({ path: 'CreateTranslateTask', body: { parse_id: 'op_123', translate_lang: 1, translate_model: 85, translate_type: 2, ignore_translate_types: ['reference'], font_strategy: 2 } })
    expect((await PDFDocument.load(readFileSync(out))).getPageCount()).toBe(2)
    globalThis.fetch = realFetch
  })

  test('service reuses metadata.doc2x_parse_id and falls back to the CLI when the gateway fails', async () => {
    writeConfig(baseDoc2x())
    writeFileSync(join(dir, 'tokens.json'), JSON.stringify({ accessToken: 'tok', expiresAt: Date.now() + 3600_000 }))
    mockGateway()
    const viaGateway = await doc2xTranslateService.execute(11, { pdf_path: join(dir, 'paper.pdf'), metadata: '{"doc2x_parse_id":"op_123"}' })
    expect(viaGateway.doc2x_translation).toMatchObject({ parse_id: 'op_123', translate_id: 'ot_gw' })

    mockGateway({ failCreate: true })
    process.env.FAKE_MODE = 'translate'
    const viaCli = await doc2xTranslateService.execute(12, { pdf_path: join(dir, 'paper.pdf'), metadata: '{"doc2x_parse_id":"op_123"}' })
    expect(viaCli.doc2x_translation).toMatchObject({ parse_id: 'op_cli', translate_id: 'ot_cli' })
    expect(lastArgv()).toContain('translate')
    globalThis.fetch = realFetch
  })
})
