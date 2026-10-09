import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Paper, PaginatedResponse } from '@paperland/shared'
import { api } from '@/api/client'

export const usePapersStore = defineStore('papers', () => {
  const papers = ref<Paper[]>([])
  const currentPaper = ref<Paper | null>(null)
  const pagination = ref({ page: 1, page_size: 20, total: 0, total_pages: 0 })
  const loading = ref(false)
  const sortBy = ref<'created_at' | 'updated_at'>((localStorage.getItem('paperland_sort_by') as 'created_at' | 'updated_at') || 'updated_at')
  const sortOrder = ref<'asc' | 'desc'>((localStorage.getItem('paperland_sort_order') as 'asc' | 'desc') || 'desc')
  // Visibility mode: 'listed' (default) | 'unlisted' (metadata-only) | 'all'
  const listedMode = ref<'listed' | 'unlisted' | 'all'>('listed')
  // Library scope: 'mine' = the user's personal paper list (default), 'all' = site-wide. Remembered per browser.
  const scope = ref<'mine' | 'all'>(readScope())

  function readScope(): 'mine' | 'all' {
    try { return localStorage.getItem('paperland_paper_scope') === 'all' ? 'all' : 'mine' } catch { return 'mine' }
  }
  function setScope(value: 'mine' | 'all') {
    scope.value = value
    try { localStorage.setItem('paperland_paper_scope', value) } catch {}
  }

  async function fetchPapers(page = 1, search = '', tagIds?: number[]) {
    loading.value = true
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '20' })
      if (search) params.set('search', search)
      if (tagIds && tagIds.length > 0) params.set('tag_ids', tagIds.join(','))
      params.set('sort_by', sortBy.value)
      params.set('sort_order', sortOrder.value)
      params.set('listed', listedMode.value)
      params.set('scope', scope.value)
      const res = await api.get<PaginatedResponse<Paper>>(`/api/papers?${params}`)
      papers.value = res.data
      pagination.value = res.pagination
    } finally {
      loading.value = false
    }
  }

  async function fetchPaper(id: number) {
    loading.value = true
    try {
      currentPaper.value = await api.get<Paper & { tags: string[] }>(`/api/papers/${id}`)
    } finally {
      loading.value = false
    }
  }

  async function createPaper(data: { arxiv_id?: string; corpus_id?: string; s2_paper_id?: string; title?: string; authors?: string[]; content?: string }) {
    return await api.post<Paper & { created: boolean }>('/api/papers', data)
  }

  async function updatePaper(id: number, data: { title?: string; authors?: string[]; link?: string; content?: string }) {
    const updated = await api.patch<Paper>(`/api/papers/${id}`, data)
    if (currentPaper.value && currentPaper.value.id === id) {
      Object.assign(currentPaper.value, updated)
    }
    return updated
  }

  async function deletePaper(id: number) {
    return await api.delete<{ success: boolean; deleted_id: number }>(`/api/papers/${id}`)
  }

  /**
   * Promote a metadata-only paper into the library (listed=true → full pipeline).
   * On rejection the API client surfaces the error message and this throws BEFORE
   * mutating any local state, so the paper stays unlisted. Callers should catch to
   * suppress the rethrow.
   */
  async function promote(id: number) {
    const updated = await api.patch<Paper>(`/api/papers/${id}`, { listed: true })
    const row = papers.value.find(p => p.id === id)
    if (row) row.listed = true
    if (currentPaper.value && currentPaper.value.id === id) currentPaper.value.listed = true
    return updated
  }

  /** Add a paper to / remove it from the current user's personal library (Mine list). */
  async function setInLibrary(id: number, inLibrary: boolean) {
    const res = inLibrary
      ? await api.put<{ paper_id: number; in_library: boolean }>(`/api/papers/${id}/library`)
      : await api.delete<{ paper_id: number; in_library: boolean }>(`/api/papers/${id}/library`)
    const row = papers.value.find(p => p.id === id)
    if (row) row.in_library = res.in_library
    if (currentPaper.value && currentPaper.value.id === id) currentPaper.value.in_library = res.in_library
    return res
  }

  // Re-fetch the open paper without toggling `loading` (used while polling PDF status).
  async function refreshCurrentPaper() {
    const id = currentPaper.value?.id
    if (id == null) return
    const fresh = await api.get<Paper & { tags: string[] }>(`/api/papers/${id}`)
    if (currentPaper.value?.id === id) currentPaper.value = fresh
  }

  // Upload a PDF for a paper that has none (closed access / failed download).
  async function uploadPdf(id: number, file: File) {
    const updated = await api.upload<Paper & { tags: string[] }>(`/api/papers/${id}/pdf`, file, 'application/pdf')
    if (currentPaper.value?.id === id) currentPaper.value = updated
    return updated
  }

  return { papers, currentPaper, pagination, loading, sortBy, sortOrder, listedMode, scope, setScope, fetchPapers, fetchPaper, refreshCurrentPaper, uploadPdf, createPaper, updatePaper, deletePaper, promote, setInLibrary }
})
