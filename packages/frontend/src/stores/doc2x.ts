import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api/client'
import type { Doc2xStatus } from '@paperland/shared'

const POLL_INTERVAL_MS = 5000

/** Whether anything doc2x-related (or the mechanical parse) may still change soon. */
function isSettling(s: Doc2xStatus): boolean {
  return s.parse.status === 'pending' || s.parse.status === 'running'
    || s.translate.status === 'queued' || s.translate.status === 'pending' || s.translate.status === 'running'
    || (s.has_pdf && !s.text_sources.pdf_parsed)
}

/**
 * doc2x parse/translate status of the paper open in the detail page. One poller per page,
 * shared by the viewer's "对照翻译" tab and the "copy full text" buttons.
 */
export const useDoc2xStore = defineStore('doc2x', () => {
  const paperId = ref<number | null>(null)
  const status = ref<Doc2xStatus | null>(null)
  const requesting = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  function stopPolling() {
    if (timer) clearTimeout(timer)
    timer = null
  }

  function schedule() {
    stopPolling()
    if (status.value && isSettling(status.value)) timer = setTimeout(refresh, POLL_INTERVAL_MS)
  }

  async function refresh() {
    const id = paperId.value
    if (id == null) return
    try {
      const next = await api.get<Doc2xStatus>(`/api/papers/${id}/doc2x`)
      if (paperId.value === id) status.value = next
    } catch {
      // error toast already shown by the API client; keep the last known status
    }
    if (paperId.value === id) schedule()
  }

  async function load(id: number) {
    if (paperId.value !== id) {
      stopPolling()
      paperId.value = id
      status.value = null
    }
    await refresh()
  }

  function release() {
    stopPolling()
    paperId.value = null
    status.value = null
  }

  async function request(action: 'parse' | 'translate') {
    const id = paperId.value
    if (id == null) return
    requesting.value = true
    try {
      const next = await api.post<Doc2xStatus>(`/api/papers/${id}/doc2x/${action}`)
      if (paperId.value === id) status.value = next
    } catch {
      // 409 etc. — refresh to show the authoritative state
    } finally {
      requesting.value = false
      await refresh()
    }
  }

  return { paperId, status, requesting, load, refresh, release, request }
})
