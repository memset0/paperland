import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { highlightApi } from '@/api/client'
import type { Highlight, HighlightColor, VisibilityScope } from '@paperland/shared'
import { useQAStore } from './qa'

export const useHighlightStore = defineStore('highlights', () => {
  const highlights = ref<Highlight[]>([])
  const currentPathname = ref<string | null>(null)
  const loading = ref(false)

  // Mine (default) / All: All overlays other users' shared highlights (admins: every user's) as
  // read-only marks. Remembered per browser; storage may be unavailable, so fall back to mine.
  const SCOPE_KEY = 'paperland.highlights.scope'
  function readScope(): VisibilityScope {
    try { return localStorage.getItem(SCOPE_KEY) === 'all' ? 'all' : 'mine' } catch { return 'mine' }
  }
  const scope = ref<VisibilityScope>(readScope())
  let loadedKey: string | null = null // `${scope}|${pathname}` of the current data

  /** Switch scope and reload the current page's highlights. */
  async function setScope(next: VisibilityScope) {
    if (scope.value === next) return
    scope.value = next
    try { localStorage.setItem(SCOPE_KEY, next) } catch { /* ignore */ }
    if (currentPathname.value) await loadForPathname(currentPathname.value, true)
  }

  /** All highlights grouped by content_hash */
  const byContentHash = computed(() => {
    const map = new Map<string, Highlight[]>()
    for (const h of highlights.value) {
      const list = map.get(h.content_hash) || []
      list.push(h)
      map.set(h.content_hash, list)
    }
    return map
  })

  /** Get highlights for a specific content_hash */
  function getForHash(contentHash: string): Highlight[] {
    return byContentHash.value.get(contentHash) || []
  }

  /** Load all highlights for the current page */
  async function loadForPathname(pathname: string, force = false) {
    const key = `${scope.value}|${pathname}`
    if (!force && loadedKey === key && highlights.value.length > 0) return
    currentPathname.value = pathname
    loadedKey = key
    loading.value = true
    try {
      const res = await highlightApi.fetch(pathname, scope.value)
      if (loadedKey === key) highlights.value = res.data
    } finally {
      loading.value = false
    }
  }

  /** Create a new highlight. If pathname is provided, use it instead of currentPathname. */
  async function create(data: {
    content_hash: string
    qa_result_id?: number
    start_offset: number
    end_offset: number
    text: string
    color: HighlightColor
    pathname?: string
  }) {
    const targetPathname = data.pathname || currentPathname.value
    if (!targetPathname) return null
    const { pathname: _, ...rest } = data
    const res = await highlightApi.create({
      ...rest,
      pathname: targetPathname,
    })
    highlights.value.push(res.data)
    if (res.data.qa_result_id != null) useQAStore().adjustHighlightCount(res.data.qa_result_id, 1)
    return res.data
  }

  /** Update a highlight's color */
  async function update(id: number, data: { color?: HighlightColor }) {
    const res = await highlightApi.update(id, data)
    const idx = highlights.value.findIndex(h => h.id === id)
    if (idx !== -1) highlights.value[idx] = res.data
    return res.data
  }

  /** Delete a highlight */
  async function remove(id: number) {
    const existing = highlights.value.find(h => h.id === id)
    await highlightApi.remove(id)
    highlights.value = highlights.value.filter(h => h.id !== id)
    if (existing?.qa_result_id != null) useQAStore().adjustHighlightCount(existing.qa_result_id, -1)
  }

  return {
    highlights, currentPathname, loading, scope,
    byContentHash, getForHash,
    loadForPathname, setScope, create, update, remove,
  }
})
