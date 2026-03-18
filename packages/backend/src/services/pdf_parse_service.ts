import { readFileSync } from 'fs'
import { resolve } from 'path'
import { getConfig } from '../config.js'
import type { PaperBoundServiceDef } from './base_service.js'

async function parseWithNodejs(pdfPath: string): Promise<string> {
  const fullPath = resolve(process.cwd(), pdfPath)
  const buffer = readFileSync(fullPath)
  const uint8 = new Uint8Array(buffer)

  const { extractText } = await import('unpdf')
  const result = await extractText(uint8)
  // result.text is an array of strings (one per page)
  const pages = Array.isArray(result.text) ? result.text : [result.text]
  return pages.join('\n\n')
}

async function parseWithPython(pdfPath: string): Promise<string> {
  const config = getConfig()
  const scriptPath = config.services.pdf_parse?.python_script || './scripts/pdf_parser.py'
  const fullPdfPath = resolve(process.cwd(), pdfPath)
  const fullScriptPath = resolve(process.cwd(), scriptPath)

  const proc = Bun.spawn(['python3', fullScriptPath, fullPdfPath], {
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const output = await new Response(proc.stdout).text()
  const exitCode = await proc.exited

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text()
    throw new Error(`Python PDF parser failed: ${stderr}`)
  }

  return output
}

export const pdfParseService: PaperBoundServiceDef = {
  name: 'pdf_parse_service',
  type: 'paper_bound',
  depends_on: ['pdf_path'],
  produces: ['contents.pdf_parsed'],

  async execute(paperId: number, paper: any): Promise<Record<string, any>> {
    const pdfPath = paper.pdf_path
    if (!pdfPath) throw new Error('No pdf_path on paper')

    const config = getConfig()
    const method = config.services.pdf_parse?.method || 'nodejs'

    let text: string
    if (method === 'python') {
      text = await parseWithPython(pdfPath)
    } else {
      text = await parseWithNodejs(pdfPath)
    }

    return { 'contents.pdf_parsed': text }
  },
}
