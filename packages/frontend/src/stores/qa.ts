import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { api, qaResultApi } from '@/api/client'
import type {
  QAEntryBackgroundColor,
  QAFeedEntry,
  PaginatedResponse,
  QAResult,
  QAResultStreamDelta,
} from '@paperland/shared'
import { AnimationFrameBatcher } from '@/lib/animation-frame-batcher'

export type { QAResult } from '@paperland/shared'

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

export interface TemplateEntry {
  entry_id: number
  status: string
  error: string | null
  can_manage: boolean
  background_color: QAEntryBackgroundColor | null
  highlight_count: number
  note_anchor_count: number
  results: QAResult[]
}

export interface FreeEntry {
  entry_id: number
  status: string
  error: string | null
  prompt: string | null
  user_id: number | null
  username: string | null
  can_manage: boolean
  background_color: QAEntryBackgroundColor | null
  highlight_count: number
  note_anchor_count: number
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
  const paperScope = ref<'mine' | 'all'>('mine')
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
      const data = await api.get<QAData>(`/api/papers/${paperId}/qa?scope=${paperScope.value}`)
      // Only update if still viewing the same paper
      if (currentPaperId.value === paperId) {
        qaData.value = data
        reconcileResultStreams()
      }
    } finally {
      if (showLoading) loading.value = false
    }
  }

  /** Call this when switching papers — resets state and sets the active paper */
  function switchPaper(paperId: number) {
    stopPolling()
    stopAllResultStreams()
    currentPaperId.value = paperId
    paperScope.value = 'mine'
    qaData.value = { template: {}, free: [] }
  }

  async function setPaperScope(scope: 'mine' | 'all') {
    if (paperScope.value === scope) return
    paperScope.value = scope
    if (currentPaperId.value != null) await fetchQA(currentPaperId.value, true)
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
            can_manage: true,
            background_color: null,
            highlight_count: 0,
            note_anchor_count: 0,
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
          user_id: null,
          username: null,
          can_manage: true,
          background_color: null,
          highlight_count: 0,
          note_anchor_count: 0,
          results: [],
        })
      }
      await fetchQA(paperId)
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
    if (currentPaperId.value === paperId) {
      await fetchQA(paperId)
      startPolling(paperId)
    }
  }

  async function deleteResult(resultId: number, paperId: number) {
    stopResultStream(resultId)
    await api.delete(`/api/qa/results/${resultId}`)
    if (currentPaperId.value === paperId) await fetchQA(paperId)
  }

  async function cancelResult(resultId: number) {
    await qaResultApi.cancel(resultId)
  }

  async function setEntryBackground(entryId: number, color: QAEntryBackgroundColor | null) {
    await api.put(`/api/qa/${entryId}/preferences`, { background_color: color })
    for (const entry of Object.values(qaData.value.template)) {
      if (entry.entry_id === entryId) entry.background_color = color
    }
    const freeEntry = qaData.value.free.find((entry) => entry.entry_id === entryId)
    if (freeEntry) freeEntry.background_color = color
    const feedEntry = feedEntries.value.find((entry) => entry.entry_id === entryId)
    if (feedEntry) feedEntry.background_color = color
  }

  function adjustHighlightCount(resultId: number, delta: number) {
    const adjust = (entry: { results: QAResult[]; highlight_count: number }) => {
      if (entry.results.some((result) => result.id === resultId)) {
        entry.highlight_count = Math.max(0, entry.highlight_count + delta)
      }
    }
    for (const entry of Object.values(qaData.value.template)) adjust(entry)
    for (const entry of qaData.value.free) adjust(entry)
    for (const entry of feedEntries.value) adjust(entry)
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
    stopAllResultStreams()
  }

  // --- Feed state (for /qa page) ---
  const feedEntries = ref<QAFeedEntry[]>([])
  const feedLoading = ref(false)
  const feedPagination = ref({ page: 1, page_size: 20, total: 0, total_pages: 0 })
  // Feed scope: 'mine' (own entries, default) or 'all' (every user's, for any logged-in viewer).
  const feedScope = ref<'mine' | 'all'>('mine')
  let feedPollTimer: ReturnType<typeof setInterval> | null = null

  type EntryWithResults = { status: string; error: string | null; results: QAResult[] }
  type ResultStreamState = {
    controller: AbortController
    generation: number
    deltaBatcher: AnimationFrameBatcher<QAResultStreamDelta>
    reconnectTimer: ReturnType<typeof setTimeout> | null
  }
  const resultStreams = new Map<number, ResultStreamState>()
  let streamGeneration = 0

  function everyVisibleEntry(): EntryWithResults[] {
    return [
      ...Object.values(qaData.value.template),
      ...qaData.value.free,
      ...feedEntries.value,
    ]
  }

  function entriesContainingResult(resultId: number): EntryWithResults[] {
    return everyVisibleEntry().filter((entry) => entry.results.some((result) => result.id === resultId))
  }

  function recomputeLocalEntry(entry: EntryWithResults) {
    if (entry.results.some((result) => result.status === 'awaiting_output' || result.status === 'streaming')) {
      entry.status = 'running'
      entry.error = null
    } else if (entry.results.some((result) => result.status === 'queued')) {
      entry.status = 'pending'
      entry.error = null
    } else if (entry.results.some((result) => result.status === 'done')) {
      entry.status = 'done'
      entry.error = null
    } else if (entry.results.length > 0) {
      entry.status = 'failed'
      entry.error = entry.results.find((result) => result.error)?.error ?? '生成失败'
    }
  }

  function replaceResult(result: QAResult) {
    for (const entry of entriesContainingResult(result.id)) {
      const target = entry.results.find((candidate) => candidate.id === result.id)
      if (target) Object.assign(target, result)
      recomputeLocalEntry(entry)
    }
  }

  function scheduleDeltaPaint(state: ResultStreamState, delta: QAResultStreamDelta): Promise<void> {
    return state.deltaBatcher.push(delta, (deltas) => {
      const text = deltas.map((item) => item.delta).join('')
      const meta = deltas.at(-1)!
      for (const entry of entriesContainingResult(meta.result_id)) {
        const result = entry.results.find((candidate) => candidate.id === meta.result_id)
        if (!result) continue
        result.answer += text
        result.status = 'streaming'
        result.first_chunk_at = meta.first_chunk_at
        result.thinking_duration_ms = meta.thinking_duration_ms
        recomputeLocalEntry(entry)
      }
    })
  }

  function isResultStillActive(resultId: number): boolean {
    return entriesContainingResult(resultId).some((entry) => entry.results.some((result) =>
      result.id === resultId && ['queued', 'awaiting_output', 'streaming'].includes(result.status),
    ))
  }

  function subscribeResult(resultId: number, attempt = 0) {
    if (resultStreams.has(resultId)) return
    const state: ResultStreamState = {
      controller: new AbortController(),
      generation: ++streamGeneration,
      deltaBatcher: new AnimationFrameBatcher<QAResultStreamDelta>(),
      reconnectTimer: null,
    }
    resultStreams.set(resultId, state)
    void qaResultApi.stream(resultId, {
      signal: state.controller.signal,
      onStart: (start) => {
        if (resultStreams.get(resultId)?.generation !== state.generation) return
        replaceResult(start.result)
      },
      onDelta: (delta) => {
        if (resultStreams.get(resultId)?.generation !== state.generation) return
        return scheduleDeltaPaint(state, delta)
      },
    }).then((terminal) => {
      if (resultStreams.get(resultId)?.generation !== state.generation) return
      replaceResult(terminal)
    }).catch((error) => {
      if (state.controller.signal.aborted) return
      if (isResultStillActive(resultId) && attempt < 3) {
        state.reconnectTimer = setTimeout(() => {
          if (resultStreams.get(resultId)?.generation !== state.generation) return
          resultStreams.delete(resultId)
          subscribeResult(resultId, attempt + 1)
        }, Math.min(4000, 500 * (2 ** attempt)))
        return
      }
      console.warn(`QA result stream ${resultId} ended:`, error)
    }).finally(() => {
      const current = resultStreams.get(resultId)
      if (current?.generation === state.generation && !state.reconnectTimer) resultStreams.delete(resultId)
    })
  }

  function stopResultStream(resultId: number) {
    const state = resultStreams.get(resultId)
    if (!state) return
    state.controller.abort()
    state.deltaBatcher.cancel()
    if (state.reconnectTimer) clearTimeout(state.reconnectTimer)
    resultStreams.delete(resultId)
  }

  function stopAllResultStreams() {
    for (const resultId of [...resultStreams.keys()]) stopResultStream(resultId)
  }

  function reconcileResultStreams() {
    const activeIds = new Set(
      everyVisibleEntry().flatMap((entry) => entry.results)
        .filter((result) => ['queued', 'awaiting_output', 'streaming'].includes(result.status))
        .map((result) => result.id),
    )
    for (const resultId of activeIds) subscribeResult(resultId)
    for (const resultId of [...resultStreams.keys()]) {
      if (!activeIds.has(resultId)) stopResultStream(resultId)
    }
  }

  // Available models for the regenerate dialog. Fetched once and shared across all
  // feed cards (previously each QAFeedPanel fetched this on mount — N duplicate requests).
  const availableModels = ref<Array<{ name: string }>>([])
  let modelsFetched = false
  async function fetchModels() {
    if (modelsFetched && availableModels.value.length) return
    try {
      const res = await api.get<{ models: { available: Array<{ name: string }> } }>('/api/config/models')
      availableModels.value = res.models.available
      modelsFetched = true
    } catch {
      if (!availableModels.value.length) availableModels.value = [{ name: 'gpt-4o' }]
    }
  }

  async function fetchFeed(showLoading = false, page = feedPagination.value.page) {
    if (showLoading) feedLoading.value = true
    try {
      const res = await api.get<PaginatedResponse<QAFeedEntry>>(
        `/api/qa/free?page=${page}&page_size=${feedPagination.value.page_size}&scope=${feedScope.value}`,
      )
      feedEntries.value = res.data
      feedPagination.value = res.pagination
      reconcileResultStreams()
    } finally {
      if (showLoading) feedLoading.value = false
    }
  }

  function feedHasInProgress(): boolean {
    return feedEntries.value.some(e => e.status === 'pending' || e.status === 'running')
  }

  function startFeedPolling() {
    if (feedPollTimer) return
    feedPollTimer = setInterval(async () => {
      await fetchFeed()
      if (!feedHasInProgress() && feedPollTimer) {
        clearInterval(feedPollTimer)
        feedPollTimer = null
      }
    }, 3000)
  }

  function stopFeedPolling() {
    if (feedPollTimer) {
      clearInterval(feedPollTimer)
      feedPollTimer = null
    }
    stopAllResultStreams()
  }

  return {
    qaData, templates, loading, submitting, polling, selectedModels, currentPaperId, paperScope,
    fetchTemplates, fetchQA, switchPaper, triggerAllTemplates, regenerateTemplate,
    submitFreeQuestion, regenerateEntry, deleteResult, cancelResult, setPaperScope, setEntryBackground, adjustHighlightCount,
    startPolling, stopPolling, hasInProgress,
    feedEntries, feedLoading, feedPagination, feedScope, fetchFeed, startFeedPolling, stopFeedPolling, feedHasInProgress,
    availableModels, fetchModels,
  }
})
