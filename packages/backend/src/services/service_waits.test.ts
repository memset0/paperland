import { describe, expect, test } from 'bun:test'
import { RateLimiter } from './rate_limiter.js'
import { Semaphore } from './semaphore.js'

describe('abortable service waits', () => {
  test('cancelled semaphore waiter is removed and does not consume a later slot', async () => {
    const semaphore = new Semaphore(1)
    await semaphore.acquire()
    const controller = new AbortController()
    const cancelled = semaphore.acquire(controller.signal)
    expect(semaphore.pending).toBe(1)
    controller.abort()
    await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' })
    expect(semaphore.pending).toBe(0)

    semaphore.release()
    await semaphore.acquire()
    expect(semaphore.running).toBe(1)
    semaphore.release()
    expect(semaphore.running).toBe(0)
  })

  test('cancelled rate-limit wait rejects without moving the cooldown clock', async () => {
    const limiter = new RateLimiter(40)
    await limiter.waitIfNeeded()
    const controller = new AbortController()
    const cancelled = limiter.waitIfNeeded(controller.signal)
    controller.abort()
    await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' })
    await limiter.waitIfNeeded()
  })
})
