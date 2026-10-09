import { describe, expect, test } from 'bun:test'
import { parseS2Input } from './s2-input'

const PID = '204e3073870fae3d05bcbc2f6a8e263d9b72e776'

describe('parseS2Input', () => {
  test('corpus ids', () => {
    expect(parseS2Input('13756489')).toEqual({ corpus_id: '13756489' })
    expect(parseS2Input('CorpusId:13756489')).toEqual({ corpus_id: '13756489' })
    expect(parseS2Input('https://api.semanticscholar.org/CorpusID:13756489')).toEqual({ corpus_id: '13756489' })
  })

  test('paper ids and URLs', () => {
    expect(parseS2Input(PID.toUpperCase())).toEqual({ s2_paper_id: PID })
    expect(parseS2Input(`https://www.semanticscholar.org/paper/Attention-Vaswani/${PID}`)).toEqual({ s2_paper_id: PID })
  })

  test('invalid input', () => {
    expect(parseS2Input('')).toBeNull()
    expect(parseS2Input('hello')).toBeNull()
    expect(parseS2Input(`https://example.com/${PID}`)).toBeNull()
  })
})
