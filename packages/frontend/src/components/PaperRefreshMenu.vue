<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { RefreshCw, FileDown, Quote } from '@lucide/vue'
import type { Paper, ServiceExecution } from '@paperland/shared'
import { api } from '@/api/client'
import { usePapersStore } from '@/stores/papers'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

// Manual refresh of data that changes over time (never automatic): re-fetch the PDF from its
// source (arXiv serves the latest version) and refresh Semantic Scholar data. The backend runs
// each as an execution of the source service; we poll that execution and report its outcome.

const props = defineProps<{ paper: Paper }>()
const store = usePapersStore()

type Target = 'pdf' | 's2'
const S2_SERVICE = 'semantic_scholar_service'
const POLL_MS = 2000

const meta = computed(() => (props.paper.metadata ?? {}) as Record<string, any>)
// Same order as the backend: arXiv → user PDF URL → S2 open-access link.
const pdfService = computed(() => {
  if (props.paper.arxiv_id) return 'arxiv_pdf_service'
  if (meta.value.pdf_url) return 'url_pdf_service'
  if (meta.value.open_access_pdf_url) return 's2_pdf_service'
  return null
})
const canPdf = computed(() => props.paper.listed !== false && !!pdfService.value)
const canS2 = computed(() => !!(props.paper.arxiv_id || props.paper.corpus_id || props.paper.s2_paper_id))

/** Execution being watched per target. */
const watching = ref<Record<Target, number | null>>({ pdf: null, s2: null })
const busy = computed(() => watching.value.pdf != null || watching.value.s2 != null)
let timer: ReturnType<typeof setInterval> | null = null

function fmt(iso: unknown): string | null {
  if (typeof iso !== 'string') return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString()
}
const pdfFetchedAt = computed(() => fmt(meta.value.pdf_fetched_at))
const s2FetchedAt = computed(() => fmt(meta.value.s2_fetched_at))

async function executions(): Promise<ServiceExecution[]> {
  return (await api.get<{ data: ServiceExecution[] }>(`/api/papers/${props.paper.id}/services`)).data
}

/** Newest first (the endpoint orders by created_at desc). */
function latest(list: ServiceExecution[], service: string | null) {
  return service ? list.find((e) => e.service_name === service) ?? null : null
}

function report(target: Target, e: ServiceExecution) {
  // Keyed by execution so the same outcome shows once even when the menu is mounted twice
  // (wide and narrow layouts).
  const id = `paper-refresh-${e.id}`
  if (e.status === 'failed') {
    const what = target === 'pdf' ? 'PDF re-fetch' : 'Semantic Scholar refresh'
    toast.error(`${what} failed: ${e.error || 'unknown error'}`, { id })
  } else if (target === 'pdf') {
    toast.success(e.result === 'unchanged' ? 'PDF unchanged — you already have the latest version' : 'PDF updated', { id })
  } else {
    toast.success('Semantic Scholar data refreshed', { id })
  }
}

async function poll() {
  let list: ServiceExecution[]
  try { list = await executions() } catch { return }
  let finished = false
  for (const target of ['pdf', 's2'] as const) {
    const id = watching.value[target]
    if (id == null) continue
    const e = list.find((x) => x.id === id)
    if (!e || e.status === 'pending' || e.status === 'running' || e.status === 'waiting') continue
    watching.value[target] = null
    report(target, e)
    finished = true
  }
  if (finished) await store.refreshCurrentPaper()
  if (!busy.value) stopPolling()
}

function startPolling() {
  if (!timer) timer = setInterval(poll, POLL_MS)
}
function stopPolling() {
  if (timer) clearInterval(timer)
  timer = null
}

async function start(target: Target) {
  if (target === 'pdf' && props.paper.pdf_path &&
      !confirm('Re-fetch the PDF from its source? If it changed, the parsed text and translations are regenerated and highlights made on the old version are hidden.')) {
    return
  }
  const url = target === 'pdf' ? `/api/papers/${props.paper.id}/pdf/refetch` : `/api/papers/${props.paper.id}/s2/refresh`
  let service: string
  try {
    service = (await api.post<{ queued: true; service: string }>(url)).service
  } catch {
    return // the API client already showed the error
  }
  // The execution is created before the 202, so the newest one for the service is ours.
  const e = latest(await executions(), service)
  if (!e) return
  watching.value[target] = e.id
  if (target === 'pdf') await store.refreshCurrentPaper() // shows "Fetching PDF…" for papers without one
  startPolling()
}

// A refresh already running (e.g. started before a reload) is picked up and reported too.
async function resume() {
  stopPolling()
  watching.value = { pdf: null, s2: null }
  let list: ServiceExecution[]
  try { list = await executions() } catch { return }
  const active = (e: ServiceExecution | null) => e && (e.status === 'pending' || e.status === 'running') ? e.id : null
  watching.value = { pdf: active(latest(list, pdfService.value)), s2: active(latest(list, S2_SERVICE)) }
  if (busy.value) startPolling()
}

onMounted(resume)
watch(() => props.paper.id, resume)
onBeforeUnmount(stopPolling)
</script>

<template>
  <DropdownMenu v-if="canPdf || canS2">
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon-sm" :title="busy ? 'Refreshing…' : 'Refresh data'">
        <RefreshCw :class="busy ? 'animate-spin' : ''" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-64">
      <DropdownMenuItem v-if="canPdf" :disabled="watching.pdf != null" @click="start('pdf')">
        <FileDown class="size-3.5" />
        <div class="flex flex-col">
          <span>{{ watching.pdf != null ? 'Re-fetching PDF…' : 'Re-fetch PDF' }}</span>
          <span v-if="pdfFetchedAt" class="text-xs text-muted-foreground">Last fetched {{ pdfFetchedAt }}</span>
        </div>
      </DropdownMenuItem>
      <DropdownMenuItem v-if="canS2" :disabled="watching.s2 != null" @click="start('s2')">
        <Quote class="size-3.5" />
        <div class="flex flex-col">
          <span>{{ watching.s2 != null ? 'Refreshing…' : 'Refresh Semantic Scholar data' }}</span>
          <span v-if="s2FetchedAt" class="text-xs text-muted-foreground">Last fetched {{ s2FetchedAt }}</span>
        </div>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
