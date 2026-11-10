import { describe, expect, test } from 'bun:test'
import { localProcess } from './local_process'

describe('bounded local subprocess execution (offline fake producers)', () => {
  test('kills an overlong process and bounds output without blocking the caller', async () => {
    await expect(localProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeout_ms: 50, max_bytes: 1000 })).rejects.toThrow('timed out')
    await expect(localProcess(process.execPath, ['-e', 'process.stdout.write("x".repeat(10000))'], { timeout_ms: 1000, max_bytes: 100 })).rejects.toThrow('limit')
  })
})
