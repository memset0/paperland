import { describe, expect, test } from 'bun:test'
import { paintStreamDelta } from './progressive-text'

describe('paintStreamDelta', () => {
  test('appends the complete provider delta and yields exactly one paint', async () => {
    let rendered = ''
    const appends: string[] = []
    const paints: string[] = []
    const completed = await paintStreamDelta('你好😀abcdef', {
      isCurrent: () => true,
      append: (delta) => {
        appends.push(delta)
        rendered += delta
      },
      nextFrame: async () => { paints.push(rendered) },
    })
    expect(completed).toBe(true)
    expect(appends).toEqual(['你好😀abcdef'])
    expect(paints).toEqual(['你好😀abcdef'])
    expect(rendered).toBe('你好😀abcdef')
  })

  test('reports cancellation that occurs during the paint yield', async () => {
    let current = true
    let rendered = ''
    const completed = await paintStreamDelta('abcdefgh', {
      isCurrent: () => current,
      append: (delta) => { rendered += delta },
      nextFrame: async () => { current = false },
    })
    expect(completed).toBe(false)
    expect(rendered).toBe('abcdefgh')
  })

  test('empty text completes without scheduling a frame', async () => {
    let frames = 0
    await expect(paintStreamDelta('', {
      isCurrent: () => true,
      append: () => {},
      nextFrame: async () => { frames++ },
    })).resolves.toBe(true)
    expect(frames).toBe(0)
  })

  test('does not append a delta for an already stale request', async () => {
    let rendered = ''
    await expect(paintStreamDelta('stale', {
      isCurrent: () => false,
      append: (delta) => { rendered += delta },
    })).resolves.toBe(false)
    expect(rendered).toBe('')
  })
})
