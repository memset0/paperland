import { describe, expect, test } from 'bun:test'
import { LatestRequest } from './latest-request'

describe('LatestRequest', () => {
  test('aborts the superseded request and rejects its stale token', () => {
    const requests = new LatestRequest()
    const first = requests.begin()
    const second = requests.begin()
    expect(first.signal.aborted).toBe(true)
    expect(requests.isCurrent(first)).toBe(false)
    expect(requests.isCurrent(second)).toBe(true)
  })

  test('cancel aborts the active request and complete clears only the current one', () => {
    const requests = new LatestRequest()
    const first = requests.begin()
    requests.complete(first)
    expect(requests.isCurrent(first)).toBe(true)
    const second = requests.begin()
    requests.cancel()
    expect(second.signal.aborted).toBe(true)
    expect(requests.isCurrent(second)).toBe(false)
  })
})
