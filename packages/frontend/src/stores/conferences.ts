import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api/client'
import type {
  Conference,
  ConferenceListItem,
  ConferencePaper,
  ConferenceImportPayload,
  ConferenceIngestSummary,
  PaginatedResponse,
} from '@paperland/shared'

export const useConferencesStore = defineStore('conferences', () => {
  const list = ref<ConferenceListItem[]>([])
  const pagination = ref({ page: 1, page_size: 20, total: 0, total_pages: 1 })
  const loading = ref(false)

  const current = ref<Conference | null>(null)
  const candidates = ref<ConferencePaper[]>([])
  const candidatesLoading = ref(false)

  async function fetchConferences(opts?: { search?: string; year?: number | null; page?: number }) {
    loading.value = true
    try {
      const params = new URLSearchParams()
      if (opts?.search) params.set('search', opts.search)
      if (opts?.year) params.set('year', String(opts.year))
      if (opts?.page) params.set('page', String(opts.page))
      const q = params.toString()
      const res = await api.get<PaginatedResponse<ConferenceListItem>>(`/api/conferences${q ? '?' + q : ''}`)
      list.value = res.data
      pagination.value = res.pagination
    } finally {
      loading.value = false
    }
  }

  async function fetchConference(id: number) {
    current.value = await api.get<Conference>(`/api/conferences/${id}`)
    return current.value
  }

  async function createConference(payload: { name: string; year?: number | null; start_date?: string | null; end_date?: string | null; location?: string | null; description?: string | null; link?: string | null }) {
    const conf = await api.post<Conference>('/api/conferences', payload)
    return conf
  }

  async function updateConference(id: number, patch: Partial<Conference>) {
    const conf = await api.patch<Conference>(`/api/conferences/${id}`, patch)
    if (current.value?.id === id) current.value = conf
    return conf
  }

  async function deleteConference(id: number) {
    await api.delete<{ success: boolean }>(`/api/conferences/${id}`)
    list.value = list.value.filter(c => c.id !== id)
  }

  async function fetchCandidates(id: number, opts?: { topic?: string; status?: string }) {
    candidatesLoading.value = true
    try {
      const params = new URLSearchParams()
      if (opts?.topic !== undefined) params.set('topic', opts.topic)
      if (opts?.status) params.set('status', opts.status)
      const q = params.toString()
      candidates.value = await api.get<ConferencePaper[]>(`/api/conferences/${id}/papers${q ? '?' + q : ''}`)
      return candidates.value
    } finally {
      candidatesLoading.value = false
    }
  }

  async function importPapers(id: number, payload: ConferenceImportPayload) {
    return await api.post<{ imported: number; ids: number[] }>(`/api/conferences/${id}/papers/import`, payload)
  }

  async function updateCandidate(id: number, cpId: number, patch: { status?: string; topic?: string | null }) {
    return await api.patch<ConferencePaper>(`/api/conferences/${id}/papers/${cpId}`, patch)
  }

  async function updateCandidates(id: number, body: { ids: number[]; status?: string; topic?: string | null }) {
    return await api.patch<{ updated: number }>(`/api/conferences/${id}/papers`, body)
  }

  async function deleteCandidate(id: number, cpId: number) {
    await api.delete<{ success: boolean }>(`/api/conferences/${id}/papers/${cpId}`)
    candidates.value = candidates.value.filter(c => c.id !== cpId)
  }

  async function ingestConference(id: number) {
    return await api.post<ConferenceIngestSummary>(`/api/conferences/${id}/ingest`, {})
  }

  async function ingestCandidate(id: number, cpId: number) {
    return await api.post<ConferencePaper>(`/api/conferences/${id}/papers/${cpId}/ingest`, {})
  }

  /** Resolve unlinked candidates via S2 title match (background; poll candidates for results). */
  async function resolveConference(id: number) {
    return await api.post<{ started: boolean; pending: number }>(`/api/conferences/${id}/resolve`, {})
  }

  /** Add a resolved (metadata-only) candidate's paper to the library (listed=true). */
  async function promotePaper(paperId: number) {
    return await api.patch(`/api/papers/${paperId}`, { listed: true })
  }

  /** Bulk "加入列表": promote selected candidates (by conference_paper id) to the library. */
  async function promoteMany(id: number, ids: number[]) {
    return await api.post<{ promoted: number; skipped: number; errors: Array<{ candidate_id: number; message: string }> }>(
      `/api/conferences/${id}/papers/promote`, { ids },
    )
  }

  return {
    list, pagination, loading,
    current, candidates, candidatesLoading,
    fetchConferences, fetchConference, createConference, updateConference, deleteConference,
    fetchCandidates, importPapers, updateCandidate, updateCandidates, deleteCandidate,
    ingestConference, ingestCandidate, resolveConference, promotePaper, promoteMany,
  }
})
