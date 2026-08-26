import { describe, expect, test } from 'bun:test'
import { serializeExternalQAResult } from './papers.js'

describe('External API QA Result serialization', () => {
  test('keeps the completed-answer shape and omits internal runtime fields', () => {
    const serialized = serializeExternalQAResult({
      id: 1, qa_entry_id: 2, prompt: 'q', answer: 'a', model_name: 'm',
      completed_at: '2026-08-26T00:00:00Z', execution_id: 3, content_hash: 'hash',
      status: 'done', error: null, requested_by_user_id: 4, streaming_capable: 1,
      created_at: '2026-08-26T00:00:00Z', started_at: null, first_chunk_at: null,
      finished_at: '2026-08-26T00:00:00Z', updated_at: '2026-08-26T00:00:00Z',
    })
    expect(serialized).toEqual({
      id: 1, qa_entry_id: 2, prompt: 'q', answer: 'a', model_name: 'm',
      completed_at: '2026-08-26T00:00:00Z', execution_id: 3, content_hash: 'hash',
    })
    expect(serialized).not.toHaveProperty('status')
    expect(serialized).not.toHaveProperty('requested_by_user_id')
  })
})
