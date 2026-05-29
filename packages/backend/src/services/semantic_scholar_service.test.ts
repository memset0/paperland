import { describe, it, expect, beforeAll, afterEach } from 'bun:test'
import { loadConfig } from '../config.js'
import { __test__, semanticScholarService } from './semantic_scholar_service.js'

// Load the real config.yml once so getApiKey()/getConfig() work. All network
// calls are mocked below — this test never hits the real Semantic Scholar API.
beforeAll(() => {
  loadConfig()
})

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

function makeResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers })
}

describe('mapS2ToPaperFields', () => {
  it('maps a full S2 response onto paper fields', () => {
    const data = {
      paperId: 'abc123',
      externalIds: { ArXiv: '1706.03762', DOI: '10.x', CorpusId: 13756489 },
      title: 'Attention',
      abstract: 'abs',
      authors: [{ name: 'A' }, { name: 'B' }],
      citationCount: 100,
      referenceCount: 137,
      influentialCitationCount: 9,
      references: [{ paperId: 'r1', title: 'Ref', year: 2015 }],
      tldr: { text: 'short' },
      venue: 'NeurIPS',
      year: 2017,
      fieldsOfStudy: ['CS'],
    }
    const r = __test__.mapS2ToPaperFields(data, { arxiv_id: '1706.03762', corpus_id: null })
    expect(r.corpus_id).toBe('13756489') // number coerced to string
    expect(r.citation_count).toBe(100)
    // reference_count comes from S2 referenceCount (authoritative total), not the page length
    expect(r.reference_count).toBe(137)
    expect(r.influential_citation_count).toBe(9)
    expect(r.references).toEqual([{ paper_id: 'r1', title: 'Ref', year: 2015 }])
    expect(r.tldr).toBe('short')
    expect(r.venue).toBe('NeurIPS')
    expect(r.year).toBe(2017)
    expect(r.doi).toBe('10.x')
    expect(r.fields_of_study).toEqual(['CS'])
    expect(r.s2_url).toBe('https://www.semanticscholar.org/paper/abc123')
    // arxiv_id is already present on the paper, so it is not rewritten
    expect('arxiv_id' in r).toBe(false)
  })

  it('skips missing optional fields and defaults the produced keys', () => {
    const r = __test__.mapS2ToPaperFields({ externalIds: { CorpusId: 5 } }, { arxiv_id: 'x', corpus_id: null })
    expect(r.corpus_id).toBe('5')
    expect(r.citation_count).toBe(0)
    expect(r.reference_count).toBe(0) // defaults to 0 when S2 omits referenceCount
    expect(r.influential_citation_count).toBe(0)
    expect(r.references).toEqual([])
    expect('tldr' in r).toBe(false)
    expect('venue' in r).toBe(false)
    expect('doi' in r).toBe(false)
  })

  it('does not overwrite a corpus_id the paper already has', () => {
    const r = __test__.mapS2ToPaperFields({ externalIds: { CorpusId: 999 } }, { arxiv_id: 'x', corpus_id: '111' })
    expect('corpus_id' in r).toBe(false)
  })

  it('back-fills arxiv_id from S2 for a corpus-only paper (reverse resolution)', () => {
    const data = {
      paperId: 'xyz',
      externalIds: { ArXiv: '1706.03762', CorpusId: 13756489 },
      citationCount: 5,
      referenceCount: 10,
    }
    const r = __test__.mapS2ToPaperFields(data, { arxiv_id: null, corpus_id: '13756489' })
    expect(r.arxiv_id).toBe('1706.03762') // resolved from externalIds.ArXiv
    expect('corpus_id' in r).toBe(false) // corpus_id already present, not rewritten
    expect(r.citation_count).toBe(5)
    expect(r.reference_count).toBe(10)
  })
})

describe('fetchS2', () => {
  it('requests by ARXIV id with the fields list and x-api-key header', async () => {
    let captured: { url: string; headers: Record<string, string> } | null = null
    globalThis.fetch = (async (url: unknown, init: any) => {
      captured = { url: String(url), headers: (init?.headers ?? {}) as Record<string, string> }
      return makeResponse(200, { paperId: 'p', externalIds: { CorpusId: 1 } })
    }) as typeof fetch

    const data = await __test__.fetchS2('ARXIV:1706.03762')
    expect(captured!.url).toContain('/paper/ARXIV:1706.03762')
    expect(captured!.url).toContain('fields=')
    expect(captured!.url).toContain('externalIds')
    // config.yml ships an api_key, so the header must be present (value not asserted)
    expect(captured!.headers['x-api-key']).toBeTruthy()
    expect(data.externalIds?.CorpusId).toBe(1)
  })

  it('retries on HTTP 429 with backoff, then succeeds', async () => {
    let calls = 0
    globalThis.fetch = (async () => {
      calls++
      if (calls === 1) return makeResponse(429, { message: 'too many requests' })
      return makeResponse(200, { paperId: 'p', externalIds: { CorpusId: 2 } })
    }) as typeof fetch

    const data = await __test__.fetchS2('ARXIV:x', 3)
    expect(calls).toBe(2)
    expect(data.externalIds?.CorpusId).toBe(2)
  }, 10000)

  it('throws on HTTP 403 (invalid key) without retrying', async () => {
    let calls = 0
    globalThis.fetch = (async () => {
      calls++
      return makeResponse(403, { message: 'bad key' })
    }) as typeof fetch

    await expect(__test__.fetchS2('ARXIV:x')).rejects.toThrow('403')
    expect(calls).toBe(1)
  })
})

describe('mapEdge', () => {
  const now = '2026-01-01T00:00:00Z'

  it('maps a reference edge (citedPaper) with contexts/intents/link', () => {
    const edge = {
      contexts: ['Self-attention has been used successfully ...'],
      intents: ['background'],
      isInfluential: false,
      citedPaper: {
        paperId: 'p1',
        externalIds: { ArXiv: '1705.04304', DOI: '10.1/x', CorpusId: 21850704 },
        url: 'https://www.semanticscholar.org/paper/p1',
        title: 'A Deep Reinforced Model',
        venue: 'ICLR',
        year: 2017,
        authors: [{ name: 'Romain Paulus' }, { name: 'Caiming Xiong' }],
      },
    }
    const r = __test__.mapEdge(edge, 'citedPaper', 'reference', 42, now)
    expect(r.paper_id).toBe(42)
    expect(r.direction).toBe('reference')
    expect(r.s2_paper_id).toBe('p1')
    expect(r.arxiv_id).toBe('1705.04304')
    expect(r.doi).toBe('10.1/x')
    expect(r.corpus_id).toBe('21850704') // number coerced to string
    expect(r.title).toBe('A Deep Reinforced Model')
    expect(JSON.parse(r.authors)).toEqual(['Romain Paulus', 'Caiming Xiong'])
    expect(r.year).toBe(2017)
    expect(r.venue).toBe('ICLR')
    expect(r.url).toBe('https://www.semanticscholar.org/paper/p1')
    expect(JSON.parse(r.contexts)).toEqual(['Self-attention has been used successfully ...'])
    expect(JSON.parse(r.intents)).toEqual(['background'])
    expect(r.is_influential).toBe(0)
  })

  it('maps a citation edge (citingPaper); empty contexts/intents → null, influential → 1', () => {
    const edge = {
      contexts: [],
      intents: [],
      isInfluential: true,
      citingPaper: { paperId: 'c1', externalIds: { CorpusId: 999 }, title: 'Citing Work', authors: [] },
    }
    const r = __test__.mapEdge(edge, 'citingPaper', 'citation', 7, now)
    expect(r.direction).toBe('citation')
    expect(r.s2_paper_id).toBe('c1')
    expect(r.corpus_id).toBe('999')
    expect(r.arxiv_id).toBeNull()
    expect(r.contexts).toBeNull()
    expect(r.intents).toBeNull()
    expect(r.is_influential).toBe(1)
  })
})

describe('service declaration', () => {
  it('is bidirectional (eligible via arxiv_id OR corpus_id) and produces enrichment incl. reference_count', () => {
    expect(semanticScholarService.name).toBe('semantic_scholar_service')
    // Empty depends_on: eligible for every paper, picks its query id (ARXIV: or CORPUSID:) at run time
    expect(semanticScholarService.depends_on).toEqual([])
    expect(semanticScholarService.produces).toContain('corpus_id')
    expect(semanticScholarService.produces).toContain('citation_count')
    expect(semanticScholarService.produces).toContain('influential_citation_count')
    expect(semanticScholarService.produces).toContain('reference_count')
    expect(semanticScholarService.produces).toContain('references')
    // arxiv_id is resolved as a side effect but must NOT be in produces, so arxiv-keyed
    // services chain via the runner's live-key re-trigger (see service docs)
    expect(semanticScholarService.produces).not.toContain('arxiv_id')
    // tldr may be absent from S2 responses, so it must NOT gate the service
    expect(semanticScholarService.produces).not.toContain('tldr')
  })
})
