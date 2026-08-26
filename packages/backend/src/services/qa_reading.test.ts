import { describe, expect, test } from 'bun:test'
import { extractPaperlandBlockHashes } from './qa_reading.js'

describe('extractPaperlandBlockHashes', () => {
  test('counts repeated same-paper block links', () => {
    const body = '[a](paperland://paper/42?h=abc) [b](paperland://paper/42?h=abc&s=1&e=2)'
    expect(extractPaperlandBlockHashes(body, 42)).toEqual(['abc', 'abc'])
  })

  test('ignores PDF, paper-only, and cross-paper links', () => {
    const body = [
      '[pdf](paperland://paper/42?pdf=2)',
      '[paper](paperland://paper/42)',
      '[other](paperland://paper/7?h=abc)',
      '[valid](paperland://paper/42?h=def)',
    ].join(' ')
    expect(extractPaperlandBlockHashes(body, 42)).toEqual(['def'])
  })
})
