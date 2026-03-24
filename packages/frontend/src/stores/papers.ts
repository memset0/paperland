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

  async function fetchPapers(page = 1, search = '') {
    loading.value = true
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '20' })
      if (search) params.set('search', search)
      params.set('sort_by', sortBy.value)
      params.set('sort_order', sortOrder.value)
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

  async function createPaper(data: { arxiv_id?: string; corpus_id?: string; title?: string; authors?: string[]; content?: string }) {
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

  return { papers, currentPaper, pagination, loading, sortBy, sortOrder, fetchPapers, fetchPaper, createPaper, updatePaper, deletePaper }
})
