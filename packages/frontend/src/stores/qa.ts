import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { api } from '@/api/client'

const STORAGE_KEY = 'paperland_selected_models'

function loadCachedModels(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch { /* localStorage unavailable */ }
  return []
}

export interface QAResult {
  id: number
  qa_entry_id: number
  prompt: string
  answer: string
  model_name: string
  completed_at: string
  execution_id: number | null
}

export interface TemplateEntry {
  entry_id: number
  status: string
  error: string | null
  results: QAResult[]
}

export interface FreeEntry {
  entry_id: number
  status: string
  error: string | null
  prompt: string | null
  results: QAResult[]
}

export interface QAData {
  template: Record<string, TemplateEntry>
  free: FreeEntry[]
}

export const useQAStore = defineStore('qa', () => {
  const qaData = ref<QAData>({ template: {}, free: [] })
  const templates = ref<Array<{ name: string; prompt: string }>>([])
  const loading = ref(false)
  const submitting = ref(false)
  const polling = ref(false)
  const selectedModels = ref<string[]>(loadCachedModels())
  const currentPaperId = ref<number | null>(null)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  watch(selectedModels, (val) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(val)) } catch { /* localStorage unavailable */ }
  }, { deep: true })

  async function fetchTemplates() {
    const res = await api.get<{ data: Array<{ name: string; prompt: string }> }>('/api/templates')
    templates.value = res.data
  }

  async function fetchQA(paperId: number, showLoading = false) {
    if (showLoading) loading.value = true
    try {
      const data = await api.get<QAData>(`/api/papers/${paperId}/qa`)
      // Only update if still viewing the same paper
      if (currentPaperId.value === paperId) {
        qaData.value = data
      }
    } finally {
      if (showLoading) loading.value = false
    }
  }

  /** Call this when switching papers — resets state and sets the active paper */
  function switchPaper(paperId: number) {
    stopPolling()
    currentPaperId.value = paperId
    qaData.value = { template: {}, free: [] }
  }

  async function triggerAllTemplates(paperId: number) {
    submitting.value = true
    try {
      const res = await api.post<{ triggered: string[] }>(`/api/papers/${paperId}/qa/template`)
      // Immediately set placeholders so UI shows spinning state
      if (currentPaperId.value === paperId) {
        for (const name of res.triggered) {
          qaData.value.template[name] = {
            entry_id: 0,
            status: 'running',
            error: null,
            results: [],
          }
        }
      }
      await fetchQA(paperId)
      startPolling(paperId)
    } finally {
      submitting.value = false
    }
  }

  async function regenerateTemplate(paperId: number, templateName: string, model?: string) {
    // Immediately show running state
    if (currentPaperId.value === paperId && qaData.value.template[templateName]) {
      qaData.value.template[templateName].status = 'running'
      qaData.value.template[templateName].error = null
    }
    await api.post(`/api/papers/${paperId}/qa/template/${templateName}/regenerate`, model ? { model } : undefined)
    await fetchQA(paperId)
    startPolling(paperId)
  }

  async function submitFreeQuestion(paperId: number, question: string, models: string[]) {
    submitting.value = true
    try {
      const res = await api.post<{ entry_id: number }>(`/api/papers/${paperId}/qa/free`, { question, models })
      // Immediately add placeholder so UI shows spinning state
      if (currentPaperId.value === paperId) {
        qaData.value.free.unshift({
          entry_id: res.entry_id,
          status: 'running',
          error: null,
          prompt: question,
          results: [],
        })
      }
      startPolling(paperId)
      return res
    } finally {
      submitting.value = false
    }
  }

  async function regenerateEntry(entryId: number, paperId: number, models?: string[]) {
    // Immediately show running state
    if (currentPaperId.value === paperId) {
      const freeEntry = qaData.value.free.find(e => e.entry_id === entryId)
      if (freeEntry) { freeEntry.status = 'running'; freeEntry.error = null }
      for (const [, entry] of Object.entries(qaData.value.template)) {
        if (entry.entry_id === entryId) { entry.status = 'running'; entry.error = null; break }
      }
    }
    await api.post(`/api/qa/${entryId}/regenerate`, { models })
    await fetchQA(paperId)
    startPolling(paperId)
  }

  async function deleteResult(resultId: number, paperId: number) {
    await api.delete(`/api/qa/results/${resultId}`)
    await fetchQA(paperId)
  }

  function hasInProgress(): boolean {
    for (const entry of Object.values(qaData.value.template)) {
      if (entry.status === 'pending' || entry.status === 'running') return true
    }
    for (const entry of qaData.value.free) {
      if (entry.status === 'pending' || entry.status === 'running') return true
    }
    return false
  }

  function startPolling(paperId: number) {
    // If polling for a different paper, stop old polling first
    if (pollTimer && currentPaperId.value !== paperId) {
      stopPolling()
    }
    if (pollTimer) return
    polling.value = true
    pollTimer = setInterval(async () => {
      // Stop if user switched to a different paper
      if (currentPaperId.value !== paperId) {
        stopPolling()
        return
      }
      await fetchQA(paperId)
      if (!hasInProgress() && pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
        polling.value = false
      }
    }, 3000)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
      polling.value = false
    }
  }

  return {
    qaData, templates, loading, submitting, polling, selectedModels, currentPaperId,
    fetchTemplates, fetchQA, switchPaper, triggerAllTemplates, regenerateTemplate,
    submitFreeQuestion, regenerateEntry, deleteResult,
    startPolling, stopPolling, hasInProgress,
  }
})
