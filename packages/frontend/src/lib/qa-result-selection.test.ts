import { describe, expect, test } from 'bun:test'
import {
  chooseActiveQAResult,
  compareQAResultsNewestFirst,
  latestQAResultId,
  qaResultSignature,
} from './qa-result-selection'

const result = (id: number, completed_at: string) => ({ id, completed_at })

describe('QA result selection', () => {
  test('sorts and selects newest completion first', () => {
    const rows = [result(1, '2026-01-01T00:00:00Z'), result(2, '2026-01-02T00:00:00Z')]
    expect([...rows].sort(compareQAResultsNewestFirst).map((row) => row.id)).toEqual([2, 1])
    expect(latestQAResultId(rows)).toBe('2')
  })

  test('breaks tied or invalid timestamps by greatest id', () => {
    expect(latestQAResultId([result(3, 'bad'), result(8, 'bad')])).toBe('8')
    expect(latestQAResultId([
      result(4, '2026-01-01T00:00:00Z'), result(9, '2026-01-01T00:00:00Z'),
    ])).toBe('9')
  })

  test('initial render and a newly added id select latest', () => {
    const initial = [result(1, '2026-01-01T00:00:00Z'), result(2, '2026-01-02T00:00:00Z')]
    expect(chooseActiveQAResult({ results: initial, previousIds: new Set(), activeId: '' })).toBe('2')
    expect(chooseActiveQAResult({
      results: [...initial, result(3, '2026-01-03T00:00:00Z')],
      previousIds: new Set([1, 2]), activeId: '1',
    })).toBe('3')
  })

  test('equivalent polling preserves manual selection and deletion falls back', () => {
    const rows = [result(1, '2026-01-01T00:00:00Z'), result(2, '2026-01-02T00:00:00Z')]
    expect(chooseActiveQAResult({ results: rows, previousIds: new Set([1, 2]), activeId: '1' })).toBe('1')
    expect(chooseActiveQAResult({ results: [rows[1]], previousIds: new Set([1, 2]), activeId: '1' })).toBe('2')
  })

  test('requested result overrides automatic latest selection', () => {
    const rows = [result(1, '2026-01-01T00:00:00Z'), result(2, '2026-01-02T00:00:00Z')]
    expect(chooseActiveQAResult({
      results: rows, previousIds: new Set(), activeId: '', requestedId: 1,
    })).toBe('1')
  })

  test('signature ignores array order', () => {
    const a = result(1, '2026-01-01T00:00:00Z')
    const b = result(2, '2026-01-02T00:00:00Z')
    expect(qaResultSignature([a, b])).toBe(qaResultSignature([b, a]))
  })

  test('active runs sort by creation and status/answer/timer updates do not change selection signature', () => {
    const completed = { id: 1, completed_at: '2026-08-26T00:00:10Z', created_at: '2026-08-26T00:00:00Z', status: 'done' }
    const active = { id: 2, completed_at: '2026-08-26T00:00:05Z', created_at: '2026-08-26T00:00:20Z', status: 'awaiting_output' }
    expect(latestQAResultId([completed, active])).toBe('2')
    const before = qaResultSignature([completed, active])
    expect(qaResultSignature([completed, { ...active, status: 'streaming', answer: 'partial', thinking_duration_ms: 2500 }])).toBe(before)
  })
})
