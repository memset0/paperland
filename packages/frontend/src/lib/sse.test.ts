import { describe, expect, test } from 'bun:test'
import { ServerSentEventParser } from './sse'

describe('ServerSentEventParser', () => {
  test('parses named events across CRLF and arbitrary chunks', () => {
    const parser = new ServerSentEventParser()
    expect(parser.push(': heartbeat\r\nevent: sta')).toEqual([])
    expect(parser.push('rt\r\ndata: {"cached":false}\r\n\r\nevent: delta\n')).toEqual([
      { event: 'start', data: '{"cached":false}' },
    ])
    expect(parser.push('data: first\ndata: second\n\n')).toEqual([
      { event: 'delta', data: 'first\nsecond' },
    ])
    expect(parser.finish()).toEqual([])
  })

  test('flushes a final non-terminated data frame and ignores comments', () => {
    const parser = new ServerSentEventParser()
    parser.push(': ignore\nevent: done\ndata: {}')
    expect(parser.finish()).toEqual([{ event: 'done', data: '{}' }])
  })
})
