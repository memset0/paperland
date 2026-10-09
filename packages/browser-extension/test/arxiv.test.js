import { describe, it, expect } from 'bun:test'
import { extractArxivIdFromUrl, normalizeArxivId, buildOpenUrl } from '../src/arxiv.js'

describe('extractArxivIdFromUrl', () => {
  const cases = [
    ['https://arxiv.org/abs/2401.12345v3', '2401.12345'],
    ['https://arxiv.org/abs/2401.12345', '2401.12345'],
    ['https://www.arxiv.org/abs/1706.03762?context=cs', '1706.03762'],
    ['https://export.arxiv.org/abs/2401.12345', '2401.12345'],
    ['https://arxiv.org/pdf/2401.12345v1.pdf', '2401.12345'],
    ['https://arxiv.org/pdf/2401.12345', '2401.12345'],
    ['https://arxiv.org/pdf/2401.12345v2', '2401.12345'],
    ['https://arxiv.org/html/2401.12345v2#S3', '2401.12345'],
    ['https://arxiv.org/html/2401.12345v2/', '2401.12345'],
    ['https://arxiv.org/abs/0704.0001', '0704.0001'],
    ['https://arxiv.org/abs/hep-th/9901001', 'hep-th/9901001'],
    ['https://arxiv.org/pdf/hep-th/9901001v2.pdf', 'hep-th/9901001'],
    ['https://arxiv.org/abs/math.GT/0309136', 'math.GT/0309136'],
    ['https://huggingface.co/papers/2401.12345', '2401.12345'],
    ['https://huggingface.co/papers/2401.12345#community', '2401.12345'],
    ['https://www.alphaxiv.org/abs/2401.12345v2', '2401.12345'],
    ['https://www.alphaxiv.org/overview/2401.12345', '2401.12345'],
    ['https://alphaxiv.org/abs/2401.12345', '2401.12345'],
    ['https://www.alphaxiv.org/pdf/2401.12345v1', '2401.12345'],
  ]
  for (const [url, id] of cases) {
    it(`${url} → ${id}`, () => expect(extractArxivIdFromUrl(url)).toBe(id))
  }

  it('returns null for unrelated or unsupported URLs', () => {
    expect(extractArxivIdFromUrl('https://example.com/2401.12345')).toBeNull()
    expect(extractArxivIdFromUrl('https://arxiv.org/list/cs.LG/recent')).toBeNull()
    expect(extractArxivIdFromUrl('https://huggingface.co/papers')).toBeNull()
    expect(extractArxivIdFromUrl('https://arxiv.org/abs/2401.123')).toBeNull()
    expect(extractArxivIdFromUrl('https://arxiv.org/abs/2401.1234567')).toBeNull()
    expect(extractArxivIdFromUrl('chrome://extensions')).toBeNull()
    expect(extractArxivIdFromUrl('not a url')).toBeNull()
  })
})

describe('normalizeArxivId', () => {
  it('handles meta-tag style values', () => {
    expect(normalizeArxivId('2401.12345')).toBe('2401.12345')
    expect(normalizeArxivId(' arXiv:2401.12345v4 ')).toBe('2401.12345')
    expect(normalizeArxivId('hep-th/9901001')).toBe('hep-th/9901001')
    expect(normalizeArxivId('foo')).toBeNull()
    expect(normalizeArxivId('')).toBeNull()
    expect(normalizeArxivId(null)).toBeNull()
  })
})

describe('buildOpenUrl', () => {
  it('trims trailing slashes and encodes the token', () => {
    expect(buildOpenUrl('https://paper.example.com/', '2401.12345', 't0k'))
      .toBe('https://paper.example.com/open/arxiv/2401.12345?token=t0k')
    expect(buildOpenUrl('http://localhost:5173//', 'hep-th/9901001', 'a b&c'))
      .toBe('http://localhost:5173/open/arxiv/hep-th/9901001?token=a%20b%26c')
  })
})
