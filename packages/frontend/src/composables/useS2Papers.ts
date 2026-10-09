import { ref, type Ref } from 'vue'
import type { S2ResolveResult } from '@paperland/shared'
import { api } from '@/api/client'

// Server-side `s2_cache.max_ids_per_request` default.
const CHUNK = 200

// Page-session cache: one ref per normalized id, shared by citation lists and chips.
const cache = new Map<string, Ref<S2ResolveResult | null>>()
let pending = new Set<string>()
let scheduled = false

function unavailable(id: string): S2ResolveResult {
  return { id, status: 'unavailable', source: null, paper: null, library_paper_id: null }
}

async function flush() {
  scheduled = false
  const ids = [...pending]
  pending = new Set()
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    try {
      const res = await api.post<{ results: S2ResolveResult[] }>('/api/s2/papers/resolve', { ids: chunk })
      res.results.forEach((result, index) => {
        const id = chunk[index]
        const entry = cache.get(id)
        if (entry) entry.value = result
        // Transient misses are not kept, so a later mount (e.g. after login) retries.
        if (result.status === 'unavailable') cache.delete(id)
      })
    } catch {
      for (const id of chunk) {
        const entry = cache.get(id)
        if (entry) entry.value = unavailable(id)
        cache.delete(id)
      }
    }
  }
}

/**
 * Resolve one normalized S2 id (see `lib/cite-links.ts`) through `POST /api/s2/papers/resolve`.
 * Ids requested in the same tick are coalesced into one request (split at 200).
 */
export function useS2Paper(id: string): Ref<S2ResolveResult | null> {
  let entry = cache.get(id)
  if (!entry) {
    entry = ref<S2ResolveResult | null>(null)
    cache.set(id, entry)
    pending.add(id)
    if (!scheduled) {
      scheduled = true
      queueMicrotask(() => { void flush() })
    }
  }
  return entry
}

/** Resolve several ids at once; returns refs in the same order. */
export function useS2Papers(ids: string[]): Ref<S2ResolveResult | null>[] {
  return ids.map(useS2Paper)
}

/** Semantic Scholar page for a normalized id. */
export function s2PaperUrl(id: string): string {
  return /^\d+$/.test(id) ? `https://www.semanticscholar.org/paper/CorpusID:${id}` : `https://www.semanticscholar.org/paper/${id}`
}
