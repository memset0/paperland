import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api/client'

interface QAResult {
  id: number
  qa_entry_id: number
  prompt: string
  answer: string
  model_name: string
  completed_at: string
}

interface TemplateEntry {
  entry_id: number
  status: string
  error: string | null
  results: QAResult[]
}

interface FreeEntry {
  entry_id: number
  status: string
  error: string | null
  results: QAResult[]
}

interface QAData {
  template: Record<string, TemplateEntry>
  free: FreeEntry[]
}

export const useQAStore = defineStore('qa', () => {
  const qaData = ref<QAData>({ template: {}, free: [] })
  const templates = ref<Array<{ name: string; prompt: string }>>([])
  const loading = ref(false)
  const submitting = ref(false)
  const selectedModels = ref<string[]>([])
  const polling = ref(false)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  async function fetchTemplates() {
    const res = await api.get<{ data: Array<{ name: string; prompt: string }> }>('/api/templates')
    templates.value = res.data
  }

  async function fetchQA(paperId: number) {
    loading.value = true
    try {
      qaData.value = await api.get<QAData>(`/api/papers/${paperId}/qa`)
    } finally {
      loading.value = false
    }
  }

  async function triggerAllTemplates(paperId: number) {
    submitting.value = true
    try {
      await api.post(`/api/papers/${paperId}/qa/template`)
      startPolling(paperId)
    } finally {
      submitting.value = false
    }
  }

  async function regenerateTemplate(paperId: number, templateName: string) {
    await api.post(`/api/papers/${paperId}/qa/template/${templateName}/regenerate`)
    startPolling(paperId)
  }

  async function submitFreeQuestion(paperId: number, question: string, models: string[]) {
    submitting.value = true
    try {
      const res = await api.post<{ entry_id: number }>(`/api/papers/${paperId}/qa/free`, { question, models })
      startPolling(paperId)
      return res
    } finally {
      submitting.value = false
    }
  }

  async function regenerateEntry(entryId: number, paperId: number, models?: string[]) {
    await api.post(`/api/qa/${entryId}/regenerate`, { models })
    startPolling(paperId)
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
    if (pollTimer) return
    polling.value = true
    pollTimer = setInterval(async () => {
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
    qaData, templates, loading, submitting, polling, selectedModels,
    fetchTemplates, fetchQA, triggerAllTemplates, regenerateTemplate,
    submitFreeQuestion, regenerateEntry, startPolling, stopPolling,
  }
})
