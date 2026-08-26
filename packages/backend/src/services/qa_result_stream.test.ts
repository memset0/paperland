import { afterEach, describe, expect, test } from 'bun:test'
import { qaResultStreamBroker } from './qa_result_stream.js'

afterEach(() => qaResultStreamBroker.clear())

describe('QA Result stream broker', () => {
  test('publishes to multiple subscribers and unsubscribe is isolated', () => {
    const first: string[] = []
    const second: string[] = []
    const unsubscribe = qaResultStreamBroker.subscribe(7, (event) => first.push(event.event))
    qaResultStreamBroker.subscribe(7, (event) => second.push(event.event))
    qaResultStreamBroker.publish(7, { event: 'delta', result_id: 7, delta: 'a', answer_length: 1, first_chunk_at: null, thinking_duration_ms: null })
    unsubscribe()
    qaResultStreamBroker.publish(7, { event: 'delta', result_id: 7, delta: 'b', answer_length: 2, first_chunk_at: null, thinking_duration_ms: null })
    expect(first).toEqual(['delta'])
    expect(second).toEqual(['delta', 'delta'])
  })

  test('terminal publication cleans subscribers and no-subscriber generation is harmless', () => {
    const events: string[] = []
    qaResultStreamBroker.publish(9, { event: 'delta', result_id: 9, delta: 'ignored', answer_length: 7, first_chunk_at: null, thinking_duration_ms: null })
    qaResultStreamBroker.subscribe(9, (event) => events.push(event.event))
    qaResultStreamBroker.publish(9, { event: 'done', result: { id: 9 } })
    expect(events).toEqual(['done'])
    expect(qaResultStreamBroker.subscriberCount(9)).toBe(0)
  })
})
