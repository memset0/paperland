import { mkdirSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import type { PaperBoundServiceDef } from './base_service.js'

const ARXIV_API_URL = 'http://export.arxiv.org/api/query'
const ARXIV_PDF_URL = 'https://arxiv.org/pdf'

function sanitizeId(arxivId: string): string {
  return arxivId.replace(/[./]/g, '_')
}

async function fetchArxivMetadata(arxivId: string): Promise<{
  title: string
  authors: string[]
  abstract: string
  categories: string[]
}> {
  const url = `${ARXIV_API_URL}?id_list=${arxivId}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Arxiv API returned ${response.status}`)
  }

  const xml = await response.text()

  // Parse Atom XML with regex (arxiv API is well-structured)
  const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/)
  if (!entryMatch) {
    throw new Error(`No entry found for arxiv_id ${arxivId}`)
  }
  const entry = entryMatch[1]

  // Title
  const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/)
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : 'Untitled'

  // Abstract
  const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/)
  const abstract = summaryMatch ? summaryMatch[1].replace(/\s+/g, ' ').trim() : ''

  // Authors
  const authorMatches = entry.matchAll(/<author>\s*<name>(.*?)<\/name>/g)
  const authors: string[] = []
  for (const m of authorMatches) {
    authors.push(m[1].trim())
  }

  // Categories
  const categoryMatches = entry.matchAll(/<category[^>]*term="([^"]+)"/g)
  const categories: string[] = []
  for (const m of categoryMatches) {
    categories.push(m[1])
  }

  return { title, authors, abstract, categories }
}

async function downloadPdf(arxivId: string): Promise<string> {
  const pdfUrl = `${ARXIV_PDF_URL}/${arxivId}.pdf`
  const response = await fetch(pdfUrl, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(`PDF download failed: ${response.status}`)
  }

  const buffer = await response.arrayBuffer()
  const pdfDir = resolve(process.cwd(), 'data/pdfs')
  mkdirSync(pdfDir, { recursive: true })

  const filename = `${sanitizeId(arxivId)}.pdf`
  const filePath = resolve(pdfDir, filename)
  writeFileSync(filePath, Buffer.from(buffer))

  return `data/pdfs/${filename}`
}

export const arxivService: PaperBoundServiceDef = {
  name: 'arxiv_service',
  type: 'paper_bound',
  depends_on: ['arxiv_id'],
  produces: ['pdf_path', 'link'],

  async execute(paperId: number, paper: any): Promise<Record<string, any>> {
    const arxivId = paper.arxiv_id
    if (!arxivId) throw new Error('No arxiv_id on paper')

    const result: Record<string, any> = {}

    // Set link if not already set
    if (!paper.link) {
      result.link = `https://arxiv.org/abs/${arxivId}`
    }

    // Fetch metadata
    try {
      const meta = await fetchArxivMetadata(arxivId)
      result.title = meta.title
      result.authors = meta.authors
      result.abstract = meta.abstract
      result.arxiv_categories = meta.categories
    } catch (err: any) {
      console.error(`Arxiv metadata fetch failed for ${arxivId}:`, err.message)
    }

    // Download PDF
    try {
      result.pdf_path = await downloadPdf(arxivId)
    } catch (err: any) {
      console.error(`Arxiv PDF download failed for ${arxivId}:`, err.message)
    }

    return result
  },
}
