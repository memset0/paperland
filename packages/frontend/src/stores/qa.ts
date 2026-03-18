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
  results: QAResult[]
}

interface FreeEntry {
  entry_id: number
  results: QAResult[]
}

interface QAData {
  template: Record<string, TemplateEntry>
  free: FreeEntry[]
}

export const useQAStore = defineStore('qa', () => {
  const qaData = ref<QAData>({ template: {}, free: [] })
  const templates = ref<Array<{ name: string }>>([])
  const loading = ref(false)
  const submitting = ref(false)
  const selectedModels = ref<string[]>([])

  async function fetchTemplates() {
    const res = await api.get<{ data: Array<{ name: string }> }>('/api/templates')
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
    } finally {
      submitting.value = false
    }
  }

  async function regenerateTemplate(paperId: number, templateName: string) {
    await api.post(`/api/papers/${paperId}/qa/template/${templateName}/regenerate`)
  }

  async function submitFreeQuestion(paperId: number, question: string, models: string[]) {
    submitting.value = true
    try {
      return await api.post<{ entry_id: number }>(`/api/papers/${paperId}/qa/free`, { question, models })
    } finally {
      submitting.value = false
    }
  }

  async function regenerateEntry(entryId: number, models?: string[]) {
    await api.post(`/api/qa/${entryId}/regenerate`, { models })
  }

  return { qaData, templates, loading, submitting, selectedModels, fetchTemplates, fetchQA, triggerAllTemplates, regenerateTemplate, submitFreeQuestion, regenerateEntry }
})
