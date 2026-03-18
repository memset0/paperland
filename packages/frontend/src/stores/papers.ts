import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Paper, PaginatedResponse } from '@paperland/shared'
import { api } from '@/api/client'

export const usePapersStore = defineStore('papers', () => {
  const papers = ref<Paper[]>([])
  const currentPaper = ref<Paper | null>(null)
  const pagination = ref({ page: 1, page_size: 20, total: 0, total_pages: 0 })
  const loading = ref(false)

  async function fetchPapers(page = 1, search = '') {
    loading.value = true
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '20' })
      if (search) params.set('search', search)
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

  return { papers, currentPaper, pagination, loading, fetchPapers, fetchPaper, createPaper }
})
