import type { PaperBoundServiceDef } from './base_service.js'

const S2_API_URL = 'https://api.semanticscholar.org/graph/v1/paper'

interface S2Response {
  paperId: string
  externalIds?: {
    ArXiv?: string
    DOI?: string
    CorpusId?: number
  }
  title?: string
  abstract?: string
  authors?: Array<{ name: string }>
  citationCount?: number
  references?: Array<{ paperId: string; title: string }>
}

async function fetchS2Data(corpusId: string): Promise<S2Response> {
  const fields = 'externalIds,title,abstract,authors,citationCount,references.title'
  const url = `${S2_API_URL}/CorpusID:${corpusId}?fields=${fields}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Semantic Scholar API returned ${response.status}`)
  }
  return response.json() as Promise<S2Response>
}

export const semanticScholarService: PaperBoundServiceDef = {
  name: 'semantic_scholar_service',
  type: 'paper_bound',
  depends_on: ['corpus_id'],
  produces: ['arxiv_id'],

  async execute(paperId: number, paper: any): Promise<Record<string, any>> {
    const corpusId = paper.corpus_id
    if (!corpusId) throw new Error('No corpus_id on paper')

    const data = await fetchS2Data(corpusId)
    const result: Record<string, any> = {}

    // Resolve arxiv_id
    if (data.externalIds?.ArXiv) {
      result.arxiv_id = data.externalIds.ArXiv
    }

    // Basic fields auto-fill
    if (data.title) result.title = data.title
    if (data.abstract) result.abstract = data.abstract
    if (data.authors) result.authors = data.authors.map((a) => a.name)

    // Metadata
    if (data.citationCount !== undefined) result.citation_count = data.citationCount
    if (data.references) {
      result.references = data.references.map((r) => ({
        paper_id: r.paperId,
        title: r.title,
      }))
    }

    return result
  },
}
