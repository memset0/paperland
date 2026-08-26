import { describe, expect, test } from 'bun:test'
import { markdownContentHash } from './content_hash.js'

describe('markdownContentHash', () => {
  test('matches the frontend whitespace-stripped MD5 contract', () => {
    expect(markdownContentHash('Hello **world**\n\nNew paragraph'))
      .toBe('1a4588f0d5b635a6b0df3d62ad80d47b')
  })

  test('all whitespace variants produce the same hash', () => {
    expect(markdownContentHash('a b\nc\td')).toBe(markdownContentHash('abcd'))
  })
})
