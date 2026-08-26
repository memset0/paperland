import { describe, expect, test } from 'bun:test'
import { AnimationFrameBatcher } from './animation-frame-batcher'

describe('AnimationFrameBatcher', () => {
  test('coalesces ordered values queued before one paint and lets terminal work await it', async () => {
    let release!: () => void
    let frames = 0
    const frame = new Promise<void>((resolve) => { release = resolve })
    const batcher = new AnimationFrameBatcher<string>(() => {
      frames++
      return frame
    })
    const flushed: string[][] = []
    const first = batcher.push('one', (items) => flushed.push(items))
    const second = batcher.push('two', (items) => flushed.push(items))
    expect(frames).toBe(1)
    expect(flushed).toEqual([])
    release()
    await Promise.all([first, second])
    expect(flushed).toEqual([['one', 'two']])
  })

  test('cancel drops queued values before their frame', async () => {
    let release!: () => void
    const batcher = new AnimationFrameBatcher<string>(() => new Promise((resolve) => { release = resolve }))
    const flushed: string[][] = []
    const pending = batcher.push('stale', (items) => flushed.push(items))
    batcher.cancel()
    release()
    await pending
    expect(flushed).toEqual([])
  })
})
