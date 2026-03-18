import type { PaperBoundServiceDef } from './base_service.js'

const PAPERS_COOL_URL = 'https://papers.cool/arxiv/kimi'

function extractMarkdownFromHtml(html: string): string {
  // The page contains markdown content in the main body area.
  // Extract text content between common content container patterns,
  // then clean up HTML tags while preserving markdown structure.

  // Try to find the main content area — papers.cool typically wraps
  // the Kimi analysis in a specific container. Look for common patterns.
  // The content is essentially markdown rendered inside HTML elements.

  // Strategy: find the section with Q&A content (Q1, Q2, etc.)
  // and extract the text, stripping HTML tags but preserving markdown.

  // Look for the content between markers that indicate the Kimi analysis
  let content = html

  // Try to extract from a specific container if present
  // papers.cool uses various wrappers — try common ones
  const containerPatterns = [
    /<div[^>]*class="[^"]*markdown[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<div[^>]*class="[^"]*(?:footer|comment)|$)/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*id="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
  ]

  for (const pattern of containerPatterns) {
    const match = content.match(pattern)
    if (match && match[1] && match[1].includes('Q1')) {
      content = match[1]
      break
    }
  }

  // If we couldn't find a container, try to find the Q&A section directly
  if (content === html) {
    // Find from first Q1 marker to end of content area
    const q1Index = content.indexOf('Q1')
    if (q1Index === -1) {
      // Try bold Q1 pattern
      const boldQ1 = content.match(/\*\*Q1\*\*|<strong>Q1|<b>Q1/)
      if (!boldQ1 || boldQ1.index === undefined) {
        throw new Error('No Kimi analysis content found on page')
      }
      content = content.substring(boldQ1.index)
    } else {
      // Walk back to find a reasonable start (e.g., the beginning of the line or a tag)
      let startIdx = q1Index
      while (startIdx > 0 && content[startIdx - 1] !== '\n' && content[startIdx - 1] !== '>') {
        startIdx--
      }
      content = content.substring(startIdx)
    }
  }

  // Clean up HTML tags while preserving markdown
  content = content
    // Remove script and style tags with content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Convert <br> to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    // Convert block-level tags to newlines
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<(p|div|h[1-6]|hr)\b[^>]*>/gi, '\n')
    // Convert <li> to markdown list items
    .replace(/<li[^>]*>/gi, '- ')
    // Strip remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Clean up excessive whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!content || content.length < 50) {
    throw new Error('Extracted content too short — page may not have Kimi analysis')
  }

  return content
}

export const papersCoolService: PaperBoundServiceDef = {
  name: 'papers_cool',
  type: 'paper_bound',
  depends_on: ['arxiv_id'],
  produces: ['papers_cool_summary'],

  async execute(paperId: number, paper: any): Promise<Record<string, any>> {
    const arxivId = paper.arxiv_id
    if (!arxivId) throw new Error('No arxiv_id on paper')

    const url = `${PAPERS_COOL_URL}?paper=${arxivId}`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Paperland/1.0)',
      },
    })

    if (!response.ok) {
      throw new Error(`papers.cool returned HTTP ${response.status} for ${arxivId}`)
    }

    const html = await response.text()
    const markdown = extractMarkdownFromHtml(html)

    return { papers_cool_summary: markdown }
  },
}
