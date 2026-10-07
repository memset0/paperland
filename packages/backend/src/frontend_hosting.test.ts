import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import Fastify from 'fastify'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { registerFrontendHosting } from './frontend_hosting'

const root = mkdtempSync(join(tmpdir(), 'paperland-hosting-'))
const outside = mkdtempSync(join(tmpdir(), 'paperland-hosting-outside-'))
const html = '<!doctype html><title>Paperland test</title>'
const app = Fastify()

beforeAll(async () => {
  mkdirSync(join(root, 'assets'))
  writeFileSync(join(root, 'index.html'), html)
  writeFileSync(join(root, 'assets/app-test.js'), 'console.log("hosted")')
  writeFileSync(join(root, 'assets/app-test.css'), 'body { margin: 0 }')
  writeFileSync(join(outside, 'secret.txt'), 'outside build')
  symlinkSync(join(outside, 'secret.txt'), join(root, 'secret.txt'))
  app.get('/api/health', async () => ({ status: 'ok' }))
  app.get('/image/example.png', async (_req, reply) => reply.type('image/png').send('image'))
  expect(await registerFrontendHosting(app, root)).toBe(true)
  await app.ready()
})

afterAll(async () => {
  await app.close()
  rmSync(root, { recursive: true, force: true })
  rmSync(outside, { recursive: true, force: true })
})

describe('backend frontend hosting', () => {
  test('serves fresh entry HTML on root, index, and deep links', async () => {
    for (const url of ['/', '/index.html', '/papers/1?view=note', '/images', '/idea-forge/project']) {
      const response = await app.inject(url)
      expect(response.statusCode).toBe(200)
      expect(response.body).toBe(html)
      expect(response.headers['content-type']).toContain('text/html')
      expect(response.headers['cache-control']).toBe('no-cache')
    }
  })

  test('supports HEAD without a response body', async () => {
    const response = await app.inject({ method: 'HEAD', url: '/papers/1' })
    expect(response.statusCode).toBe(200)
    expect(response.body).toBe('')
    expect(response.headers['content-type']).toContain('text/html')
  })

  test('serves actual JavaScript and CSS assets with immutable caching', async () => {
    for (const [url, type, body] of [
      ['/assets/app-test.js', 'javascript', 'console.log("hosted")'],
      ['/assets/app-test.css', 'text/css', 'body { margin: 0 }'],
    ]) {
      const response = await app.inject(url)
      expect(response.statusCode).toBe(200)
      expect(response.body).toBe(body)
      expect(response.headers['content-type']).toContain(type)
      expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable')
    }
  })

  test('preserves specific API and image routes', async () => {
    expect((await app.inject('/api/health')).json()).toEqual({ status: 'ok' })
    expect((await app.inject('/image/example.png')).headers['content-type']).toBe('image/png')
  })

  test('does not serve HTML for missing server routes or assets', async () => {
    for (const url of ['/api', '/api/missing', '/external-api', '/external-api/v1/missing',
      '/image', '/image/missing.png', '/assets', '/assets/missing', '/missing.js', '/favicon.ico']) {
      const response = await app.inject(url)
      expect(response.statusCode).toBe(404)
      expect(response.headers['content-type']).not.toContain('text/html')
    }
  })

  test('rejects traversal and null bytes without exposing files', async () => {
    for (const url of ['/%2e%2e%2fsecret', '/%2Fetc%2Fpasswd', '/bad%00name']) {
      const response = await app.inject(url)
      expect([400, 404]).toContain(response.statusCode)
      expect(response.body).not.toBe(html)
    }
  })

  test('does not apply SPA fallback to POST', async () => {
    expect((await app.inject({ method: 'POST', url: '/papers/1' })).statusCode).toBe(404)
  })

  test('does not expose a symlink outside the build directory', async () => {
    const response = await app.inject('/secret.txt')
    expect(response.statusCode).toBe(404)
    expect(response.body).not.toContain('outside build')
  })

  test('allows API-only startup when build is absent', async () => {
    const apiOnly = Fastify()
    try {
      apiOnly.get('/api/health', async () => ({ status: 'ok' }))
      expect(await registerFrontendHosting(apiOnly, join(root, 'absent'))).toBe(false)
      expect((await apiOnly.inject('/')).statusCode).toBe(404)
      expect((await apiOnly.inject('/api/health')).statusCode).toBe(200)
    } finally {
      await apiOnly.close()
    }
  })
})
