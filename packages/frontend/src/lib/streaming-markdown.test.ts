import { describe, expect, test } from 'bun:test'
import { splitStreamingMarkdown } from './streaming-markdown'

describe('splitStreamingMarkdown', () => {
  test('commits completed paragraphs but retains the growing tail', () => {
    expect(splitStreamingMarkdown('First paragraph.\n\nGrowing **tail')).toEqual({
      stable: 'First paragraph.\n\n',
      tail: 'Growing **tail',
    })
  })

  test('does not commit inside unclosed fences or display math', () => {
    expect(splitStreamingMarkdown('Intro.\n\n```ts\nconst x = 1\n\n')).toEqual({
      stable: 'Intro.\n\n',
      tail: '```ts\nconst x = 1\n\n',
    })
    expect(splitStreamingMarkdown('Intro.\n\n$$\nx + y\n\n')).toEqual({
      stable: 'Intro.\n\n',
      tail: '$$\nx + y\n\n',
    })
  })

  test('keeps lists and tables provisional because later rows can change their structure', () => {
    expect(splitStreamingMarkdown('- one\n- two\n\nnext')).toEqual({ stable: '', tail: '- one\n- two\n\nnext' })
    expect(splitStreamingMarkdown('| a | b |\n| - | - |\n\nnext')).toEqual({ stable: '', tail: '| a | b |\n| - | - |\n\nnext' })
  })
})
