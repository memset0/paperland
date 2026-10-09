import { describe, it, expect } from 'bun:test'
import { normalizeArxivId } from './arxiv_id.js'

describe('normalizeArxivId', () => {
  it('accepts new-style ids and strips version / arXiv: prefix', () => {
    expect(normalizeArxivId('2401.12345')).toBe('2401.12345')
    expect(normalizeArxivId('1706.03762v7')).toBe('1706.03762')
    expect(normalizeArxivId('arXiv:1706.03762v7')).toBe('1706.03762')
    expect(normalizeArxivId('ARXIV:0704.0001')).toBe('0704.0001')
    expect(normalizeArxivId('  2401.12345v2 ')).toBe('2401.12345')
  })

  it('accepts old-style ids', () => {
    expect(normalizeArxivId('hep-th/9901001')).toBe('hep-th/9901001')
    expect(normalizeArxivId('hep-th/9901001v1')).toBe('hep-th/9901001')
    expect(normalizeArxivId('math.GT/0309136')).toBe('math.GT/0309136')
  })

  it('rejects garbage', () => {
    expect(normalizeArxivId('not-an-id')).toBeNull()
    expect(normalizeArxivId('')).toBeNull()
    expect(normalizeArxivId(null)).toBeNull()
    expect(normalizeArxivId('2401.123')).toBeNull()
    expect(normalizeArxivId('2401.12345/../x')).toBeNull()
  })
})
