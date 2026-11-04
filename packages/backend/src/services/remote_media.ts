import { lookup } from 'dns/promises'
import { isIP } from 'net'
import { getConfig } from '../config.js'
import { maxMediaBytes } from './image_store.js'

/** Remote URL refused before fetching (bad scheme, private address, too many redirects) → 422. */
export class RemoteUrlNotAllowedError extends Error {}
/** Remote download failed (HTTP status, timeout, size) → 422 with the message. */
export class RemoteFetchError extends Error {}

const MAX_REDIRECTS = 5

function ipv4Private(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number)
  return a === 0 || a === 10 || a === 127
    || (a === 100 && b >= 64 && b <= 127) // CGNAT
    || (a === 169 && b === 254) // link-local
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a >= 224 // multicast / reserved
}

/** True for loopback, private, link-local, CGNAT, unique-local, multicast and unspecified addresses. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) return ipv4Private(ip)
  const v6 = ip.toLowerCase()
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return ipv4Private(mapped[1])
  return v6 === '::' || v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd')
    || v6.startsWith('fe8') || v6.startsWith('fe9') || v6.startsWith('fea') || v6.startsWith('feb')
    || v6.startsWith('ff')
}

type Resolver = (host: string) => Promise<string[]>
const defaultResolver: Resolver = async (host) => (await lookup(host, { all: true })).map((a) => a.address)

async function assertPublicUrl(raw: string, resolve: Resolver): Promise<URL> {
  let url: URL
  try { url = new URL(raw) } catch { throw new RemoteUrlNotAllowedError('Invalid URL') }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new RemoteUrlNotAllowedError('Only http and https URLs can be fetched')
  }
  const host = url.hostname.replace(/^\[|\]$/g, '')
  let addresses: string[]
  try {
    addresses = isIP(host) ? [host] : await resolve(host)
  } catch {
    throw new RemoteFetchError(`Could not resolve ${host}`)
  }
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new RemoteUrlNotAllowedError(`${host} resolves to a private or local address`)
  }
  return url
}

export interface RemoteMedia {
  buf: Buffer
  /** Last path segment of the final URL, used as the original file name. */
  filename: string | null
}

/**
 * Download an image or video for the image host: http(s) only, every hop checked against private
 * addresses, at most 5 redirects, `image_host.download_timeout`, aborted above the largest
 * configured size limit. Type validation is left to storeImageBytes.
 */
export async function fetchRemoteMedia(
  raw: string,
  deps: { fetchFn?: typeof fetch; resolve?: Resolver } = {},
): Promise<RemoteMedia> {
  const fetchFn = deps.fetchFn ?? fetch
  const resolve = deps.resolve ?? defaultResolver
  const cfg = getConfig().image_host
  const maxBytes = maxMediaBytes()
  const signal = AbortSignal.timeout(cfg.download_timeout * 1000)

  let url = await assertPublicUrl(raw, resolve)
  let response: Response
  for (let hop = 0; ; hop++) {
    try {
      response = await fetchFn(url, { redirect: 'manual', signal, headers: { 'User-Agent': 'Mozilla/5.0 (paperland image host)' } })
    } catch (err: any) {
      if (err?.name === 'TimeoutError') throw new RemoteFetchError(`Download timed out after ${cfg.download_timeout}s`)
      throw new RemoteFetchError(`Download failed: ${err?.message || err}`)
    }
    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location) {
      if (hop >= MAX_REDIRECTS) throw new RemoteUrlNotAllowedError('Too many redirects')
      url = await assertPublicUrl(new URL(location, url).toString(), resolve)
      continue
    }
    break
  }
  if (!response.ok) throw new RemoteFetchError(`Download returned HTTP ${response.status}`)
  const declared = Number(response.headers.get('content-length') || 0)
  if (declared > maxBytes) throw new RemoteFetchError(`File exceeds ${Math.round(maxBytes / 1024 / 1024)} MB`)

  const chunks: Uint8Array[] = []
  let total = 0
  const reader = response.body?.getReader()
  try {
    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.length
      if (total > maxBytes) {
        await reader.cancel().catch(() => {})
        throw new RemoteFetchError(`File exceeds ${Math.round(maxBytes / 1024 / 1024)} MB`)
      }
      chunks.push(value)
    }
  } catch (err: any) {
    if (err instanceof RemoteFetchError) throw err
    if (err?.name === 'TimeoutError') throw new RemoteFetchError(`Download timed out after ${cfg.download_timeout}s`)
    throw new RemoteFetchError(`Download failed: ${err?.message || err}`)
  }
  const segment = decodeURIComponent(url.pathname.split('/').pop() || '')
  return { buf: Buffer.concat(chunks), filename: segment || null }
}
