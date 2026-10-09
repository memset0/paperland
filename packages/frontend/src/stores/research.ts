import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api, researchApi } from '@/api/client'
import type { ResearchSessionDetail, ResearchSessionSummary, ResearchStep, VisibilityScope } from '@paperland/shared'

const ACTIVE: ResearchStep['status'][] = ['queued', 'awaiting_output', 'streaming']
const MAX_RECONNECTS = 5

export function isActiveStep(step: Pick<ResearchStep, 'status'>): boolean {
  return ACTIVE.includes(step.status)
}

/** Steps that produced a version (list + report), oldest first; version n = index n-1. */
export function versionSteps(steps: ResearchStep[]): ResearchStep[] {
  return steps.filter((s) => s.paper_list && s.report)
}

export const useResearchStore = defineStore('research', () => {
  const sessions = ref<ResearchSessionSummary[]>([])
  const scope = ref<VisibilityScope>('mine')
  const listLoading = ref(false)

  const current = ref<ResearchSessionDetail | null>(null)
  const detailLoading = ref(false)

  const codexModels = ref<string[]>([])
  const defaultModel = ref<string | null>(null)

  // Live SSE subscriptions per step id (only one session is open at a time).
  const subscriptions = new Map<number, AbortController>()
  /** Steps whose automatic repair request is running (from the SSE `repairing` event). */
  const repairingStepIds = ref(new Set<number>())

  async function fetchSessions() {
    listLoading.value = true
    try {
      sessions.value = (await researchApi.list(scope.value)).data
    } finally {
      listLoading.value = false
    }
  }

  async function fetchModels() {
    if (codexModels.value.length) return
    const res = await api.get<{ models: { default: string; available: Array<{ name: string; type: string }> } }>('/api/config/models')
    codexModels.value = res.models.available.filter((m) => m.type === 'codex').map((m) => m.name)
    defaultModel.value = codexModels.value.includes(res.models.default) ? res.models.default : codexModels.value[0] ?? null
  }

  function closeStreams() {
    for (const controller of subscriptions.values()) controller.abort()
    subscriptions.clear()
  }

  function replaceStep(step: ResearchStep) {
    if (!current.value || current.value.id !== step.session_id) return
    const steps = current.value.steps
    const index = steps.findIndex((s) => s.id === step.id)
    if (index >= 0) steps.splice(index, 1, step)
  }

  /** Follow every active step of the open session over SSE (reconnecting on transient drops). */
  function subscribeActive() {
    for (const step of current.value?.steps ?? []) {
      if (isActiveStep(step) && !subscriptions.has(step.id)) void follow(step.id)
    }
  }

  async function follow(stepId: number) {
    const controller = new AbortController()
    subscriptions.set(stepId, controller)
    let attempts = 0
    try {
      while (!controller.signal.aborted) {
        try {
          const terminal = await researchApi.stream(stepId, {
            signal: controller.signal,
            onStart: (step) => replaceStep(step),
            onDelta: (delta) => {
              const step = current.value?.steps.find((s) => s.id === delta.step_id)
              if (!step) return
              if (step.status !== 'streaming') step.status = 'streaming'
              step.answer += delta.delta
            },
            onRepairing: (step) => {
              repairingStepIds.value = new Set(repairingStepIds.value).add(step.id)
            },
          })
          // The terminal step carries the parsed version; refresh the session so the title/list update.
          replaceStep(terminal)
          if (current.value && current.value.id === terminal.session_id) await refreshCurrent()
          return
        } catch (error) {
          if (controller.signal.aborted) return
          if (++attempts > MAX_RECONNECTS) {
            await refreshCurrent()
            return
          }
          await new Promise((r) => setTimeout(r, 1000 * attempts))
        }
      }
    } finally {
      if (subscriptions.get(stepId) === controller) subscriptions.delete(stepId)
      if (repairingStepIds.value.has(stepId)) {
        const next = new Set(repairingStepIds.value)
        next.delete(stepId)
        repairingStepIds.value = next
      }
    }
  }

  async function openSession(id: number) {
    closeStreams()
    detailLoading.value = true
    try {
      current.value = (await researchApi.get(id)).data
      subscribeActive()
    } finally {
      detailLoading.value = false
    }
  }

  async function refreshCurrent() {
    if (!current.value) return
    const fresh = (await researchApi.get(current.value.id)).data
    // Keep the live answer text of a step we are still streaming.
    current.value = fresh
    subscribeActive()
  }

  function setDetail(detail: ResearchSessionDetail) {
    current.value = detail
    subscribeActive()
  }

  async function create(body: { topic: string; model_name: string; seed_result_id?: number }) {
    const detail = (await researchApi.create(body)).data
    closeStreams()
    setDetail(detail)
    return detail
  }

  async function submit(userText: string, modelName: string) {
    if (!current.value) return
    setDetail((await researchApi.submit(current.value.id, { user_text: userText, model_name: modelName })).data)
  }

  async function retry(stepId: number, body: { user_text?: string; model_name?: string }) {
    if (!current.value) return
    setDetail((await researchApi.retry(current.value.id, stepId, body)).data)
  }

  async function cancel(stepId: number) {
    if (!current.value) return
    await researchApi.cancel(current.value.id, stepId)
  }

  async function editTitles(title: string, sectionTitles: string[]) {
    if (!current.value) return
    setDetail((await researchApi.editTitles(current.value.id, { title, section_titles: sectionTitles })).data)
  }

  async function truncate(afterStepIndex: number) {
    if (!current.value) return
    setDetail((await researchApi.truncate(current.value.id, afterStepIndex)).data)
  }

  async function remove(id: number) {
    await researchApi.remove(id)
    sessions.value = sessions.value.filter((s) => s.id !== id)
    if (current.value?.id === id) {
      closeStreams()
      current.value = null
    }
  }

  function closeSession() {
    closeStreams()
    current.value = null
  }

  const latestModel = computed(() => {
    const steps = current.value?.steps ?? []
    for (let i = steps.length - 1; i >= 0; i--) if (steps[i].kind === 'agent' && steps[i].model_name) return steps[i].model_name
    return null
  })

  return {
    sessions, scope, listLoading, current, detailLoading, codexModels, defaultModel, latestModel, repairingStepIds,
    fetchSessions, fetchModels, openSession, refreshCurrent, create, submit, retry, cancel,
    editTitles, truncate, remove, closeSession,
  }
})
