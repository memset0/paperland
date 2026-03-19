import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { highlightApi } from '@/api/client'
import type { Highlight, HighlightColor } from '@paperland/shared'

export const useHighlightStore = defineStore('highlights', () => {
  const highlights = ref<Highlight[]>([])
  const currentPathname = ref<string | null>(null)
  const loading = ref(false)

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
  async function loadForPathname(pathname: string) {
    if (currentPathname.value === pathname && highlights.value.length > 0) return
    currentPathname.value = pathname
    loading.value = true
    try {
      const res = await highlightApi.fetch(pathname)
      highlights.value = res.data
    } finally {
      loading.value = false
    }
  }

  /** Create a new highlight */
  async function create(data: {
    content_hash: string
    start_offset: number
    end_offset: number
    text: string
    color: HighlightColor
    note?: string | null
  }) {
    if (!currentPathname.value) return null
    const res = await highlightApi.create({
      ...data,
      pathname: currentPathname.value,
    })
    highlights.value.push(res.data)
    return res.data
  }

  /** Update a highlight's color or note */
  async function update(id: number, data: { color?: HighlightColor; note?: string | null }) {
    const res = await highlightApi.update(id, data)
    const idx = highlights.value.findIndex(h => h.id === id)
    if (idx !== -1) highlights.value[idx] = res.data
    return res.data
  }

  /** Delete a highlight */
  async function remove(id: number) {
    await highlightApi.remove(id)
    highlights.value = highlights.value.filter(h => h.id !== id)
  }

  return {
    highlights, currentPathname, loading,
    byContentHash, getForHash,
    loadForPathname, create, update, remove,
  }
})
