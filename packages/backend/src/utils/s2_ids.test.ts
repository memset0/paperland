import { describe, it, expect } from 'bun:test'
import { parseS2Input, normalizeS2Ids, S2IdError } from './s2_ids.js'

const PID = '204e3073870fae3d05bcbc2f6a8e263d9b72e776'

describe('parseS2Input', () => {
  it('accepts corpus ids in plain and prefixed forms', () => {
    expect(parseS2Input('13756489')).toEqual({ corpus_id: '13756489' })
    expect(parseS2Input(' CorpusId:13756489 ')).toEqual({ corpus_id: '13756489' })
    expect(parseS2Input('corpusid:13756489')).toEqual({ corpus_id: '13756489' })
  })

  it('accepts a 40-hex paper id (lowercased)', () => {
    expect(parseS2Input(PID.toUpperCase())).toEqual({ s2_paper_id: PID })
  })

  it('parses semanticscholar.org URLs', () => {
    expect(parseS2Input(`https://www.semanticscholar.org/paper/Attention-is-All-you-Need-Vaswani/${PID}`)).toEqual({ s2_paper_id: PID })
    expect(parseS2Input(`https://www.semanticscholar.org/paper/${PID}?utm=x`)).toEqual({ s2_paper_id: PID })
    expect(parseS2Input('https://api.semanticscholar.org/CorpusID:13756489')).toEqual({ corpus_id: '13756489' })
  })

  it('rejects garbage and non-S2 URLs', () => {
    expect(parseS2Input('not-an-id')).toBeNull()
    expect(parseS2Input('')).toBeNull()
    expect(parseS2Input(`https://example.com/paper/${PID}`)).toBeNull()
    expect(parseS2Input('abc123')).toBeNull()
  })
})

describe('normalizeS2Ids', () => {
  it('routes values to the right key regardless of field', () => {
    expect(normalizeS2Ids({ corpus_id: `https://www.semanticscholar.org/paper/x/${PID}` })).toEqual({ s2_paper_id: PID })
    expect(normalizeS2Ids({ corpus_id: 'CorpusId:5', s2_paper_id: PID })).toEqual({ corpus_id: '5', s2_paper_id: PID })
    expect(normalizeS2Ids({})).toEqual({})
  })

  it('throws on invalid or conflicting values', () => {
    expect(() => normalizeS2Ids({ s2_paper_id: 'not-an-id' })).toThrow(S2IdError)
    expect(() => normalizeS2Ids({ corpus_id: '1', s2_paper_id: 'CorpusId:2' })).toThrow('Conflicting')
  })
})
