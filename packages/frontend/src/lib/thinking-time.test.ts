import { describe, expect, test } from 'bun:test'
import { formatThinkingDuration } from './thinking-time'

describe('formatThinkingDuration', () => {
  test('uses stable zero-padded minute and second geometry', () => {
    expect(formatThinkingDuration(0)).toBe('00:00')
    expect(formatThinkingDuration(9_999)).toBe('00:09')
    expect(formatThinkingDuration(10_000)).toBe('00:10')
    expect(formatThinkingDuration(65_000)).toBe('01:05')
  })
})
