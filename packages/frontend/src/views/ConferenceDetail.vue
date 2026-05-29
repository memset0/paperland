<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConferencesStore } from '@/stores/conferences'
import { useAuthStore } from '@/stores/auth'
import { useLoginPrompt } from '@/composables/useLoginPrompt'
import { toast } from 'vue-sonner'
import {
  ArrowLeft, CalendarDays, Upload, Play, Check, Undo2, Trash2, ExternalLink,
  Loader2, RefreshCw, FileText, FileJson,
} from '@lucide/vue'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import SourceTag from '@/components/SourceTag.vue'
import S2Badge from '@/components/S2Badge.vue'
import type { ConferencePaper, ConferencePaperSource, ConferencePaperStatus } from '@paperland/shared'

const route = useRoute()
const router = useRouter()
const store = useConferencesStore()
const auth = useAuthStore()
const { openLogin } = useLoginPrompt()

const id = computed(() => parseInt(route.params.id as string, 10))

const loading = ref(true)
const selected = ref<Set<number>>(new Set())
const editingTopicId = ref<number | null>(null)
const editingTopicValue = ref('')

const showImport = ref(false)
const importMode = ref<'file' | 'paste'>('paste')
const importText = ref('')
const importFileName = ref('')
const importing = ref(false)

const showIngest = ref(false)
const ingesting = ref(false)
const ingestSummary = ref<{ ingested: number; skipped: number; errors: Array<{ candidate_id: number; message: string }> } | null>(null)

onMounted(load)
watch(id, load)

async function load() {
  loading.value = true
  selected.value = new Set()
  try {
    await Promise.all([store.fetchConference(id.value), store.fetchCandidates(id.value)])
  } finally {
    loading.value = false
  }
}

async function refresh() { await store.fetchCandidates(id.value) }

const resolving = ref(false)
async function resolveAll() {
  resolving.value = true
  try {
    const res = await store.resolveConference(id.value)
    toast.success(`已开始解析 ${res.pending} 篇候选（后台 ~1 篇/秒，自动刷新）`)
    let n = 0
    const timer = setInterval(async () => { await refresh(); if (++n >= 30) clearInterval(timer) }, 5000)
  } catch (e: any) {
    toast.error(`解析失败：${e?.message || e}`)
  } finally {
    resolving.value = false
  }
}

const addingId = ref<number | null>(null)
async function addToLibrary(c: any) {
  if (!c.paper_id) return
  addingId.value = c.id
  try { await store.promotePaper(c.paper_id); await refresh() }
  catch (e: any) { toast.error(`加入失败：${e?.message || e}`) }
  finally { addingId.value = null }
}

// --- Grouping by topic ---
const grouped = computed(() => {
  const map = new Map<string, ConferencePaper[]>()
  for (const c of store.candidates) {
    const key = c.topic || '__未分类__'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(c)
  }
  // Stable order: known topics alphabetically, "未分类" last
  const keys = [...map.keys()].sort((a, b) => {
    if (a === '__未分类__') return 1
    if (b === '__未分类__') return -1
    return a.localeCompare(b)
  })
  return keys.map(k => ({
    key: k,
    label: k === '__未分类__' ? '未分类' : k,
    papers: map.get(k)!,
  }))
})

// --- Action gating ---
function requireAuthThen(fn: () => void) {
  if (!auth.isAuthenticated) { openLogin(); return }
  fn()
}

// --- Selection ---
function toggleSelect(cpId: number) {
  const next = new Set(selected.value)
  if (next.has(cpId)) next.delete(cpId); else next.add(cpId)
  selected.value = next
}

function selectAll(papers: ConferencePaper[]) {
  const next = new Set(selected.value)
  for (const p of papers) if (!isInSystem(p)) next.add(p.id)
  selected.value = next
}

function clearSelection() { selected.value = new Set() }

// --- Single-row actions ---
async function confirm(cpId: number) {
  requireAuthThen(async () => {
    await store.updateCandidate(id.value, cpId, { status: 'candidate' })
    await refresh()
  })
}

async function revert(cpId: number) {
  requireAuthThen(async () => {
    await store.updateCandidate(id.value, cpId, { status: 'pending' })
    await refresh()
  })
}

async function deleteRow(cpId: number) {
  requireAuthThen(async () => {
    if (!confirmWindow(`确认删除该候选论文？`)) return
    await store.deleteCandidate(id.value, cpId)
    selected.value.delete(cpId)
  })
}

function startEditTopic(c: ConferencePaper) {
  requireAuthThen(() => {
    editingTopicId.value = c.id
    editingTopicValue.value = c.topic || ''
  })
}

async function saveTopic() {
  if (editingTopicId.value == null) return
  const next = editingTopicValue.value.trim() || null
  await store.updateCandidate(id.value, editingTopicId.value, { topic: next })
  editingTopicId.value = null
  await refresh()
}

// --- Bulk actions ---
async function bulkConfirm() {
  if (selected.value.size === 0) return
  requireAuthThen(async () => {
    await store.updateCandidates(id.value, { ids: [...selected.value], status: 'candidate' })
    clearSelection()
    await refresh()
  })
}

async function bulkRevert() {
  if (selected.value.size === 0) return
  requireAuthThen(async () => {
    await store.updateCandidates(id.value, { ids: [...selected.value], status: 'pending' })
    clearSelection()
    await refresh()
  })
}

// --- Import dialog ---
async function onFileChosen(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  importFileName.value = f.name
  importText.value = await f.text()
}

async function submitImport() {
  if (!importText.value.trim()) return
  let parsed: any
  try {
    parsed = JSON.parse(importText.value)
  } catch (e: any) {
    toast.error(`JSON 解析失败：${e?.message || e}`)
    return
  }
  // Accept either { papers: [...] } or a bare array.
  const papers = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.papers) ? parsed.papers : null
  if (!papers || papers.length === 0) {
    toast.error('文件中没有有效的 papers 数组')
    return
  }
  importing.value = true
  try {
    const res = await store.importPapers(id.value, { papers })
    showImport.value = false
    importText.value = ''
    importFileName.value = ''
    toast.success(`已导入 ${res.imported} 篇候选论文`)
    await refresh()
  } catch (e: any) {
    toast.error(`导入失败：${e?.message || e}`)
  } finally {
    importing.value = false
  }
}

// --- One-click ingest ---
function openIngest() {
  requireAuthThen(() => {
    ingestSummary.value = null
    showIngest.value = true
  })
}

async function submitIngest() {
  ingesting.value = true
  try {
    ingestSummary.value = await store.ingestConference(id.value)
    await refresh()
    if (ingestSummary.value.ingested > 0) toast.success(`已入库 ${ingestSummary.value.ingested} 篇`)
    if (ingestSummary.value.errors.length > 0) toast.error(`${ingestSummary.value.errors.length} 篇失败`)
  } catch (e: any) {
    toast.error(`入库失败：${e?.message || e}`)
  } finally {
    ingesting.value = false
  }
}

const candidateCount = computed(() => store.candidates.filter(c => c.status === 'candidate').length)

// --- Status / source badge labels ---
const SOURCE_LABEL: Record<NonNullable<ConferencePaperSource>, string> = {
  arxiv: 'arXiv',
  openreview: 'OpenReview',
  semantic_scholar: 'S2',
}

const STATUS_LABEL: Record<ConferencePaperStatus, string> = {
  pending: '待确认',
  candidate: '候选中',
  ingested: '已入库',
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'
const STATUS_VARIANT: Record<ConferencePaperStatus, BadgeVariant> = {
  pending: 'outline',
  candidate: 'default',
  ingested: 'secondary',
}

function externalLink(c: ConferencePaper): string | null {
  if (c.link) return c.link
  if (c.source === 'arxiv' && c.external_id) return `https://arxiv.org/abs/${c.external_id}`
  return null
}

// Resolved arXiv / S2 ids for the candidate's badges. Prefer the linked paper's
// stored ids (source of truth, survives enrichment), then the candidate's own
// source/external_id, then the cached S2 match from resolve.
function displayArxivId(c: any): string | null {
  return c.paper_arxiv_id || (c.source === 'arxiv' ? c.external_id : null) || c.metadata?.s2_match?.arxiv_id || null
}
function displayCorpusId(c: any): string | null {
  return c.paper_corpus_id || (c.source === 'semantic_scholar' ? c.external_id : null) || c.metadata?.s2_match?.corpus_id || null
}
// A candidate is "already in the system" once its linked paper is in the library
// (listed) or it has been ingested. Metadata-only matches stay selectable.
function isInSystem(c: any): boolean {
  return c.paper_listed === true || c.status === 'ingested'
}

function confirmWindow(msg: string): boolean { return window.confirm(msg) }
</script>

<template>
  <div class="p-6 space-y-4">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon-sm" @click="router.push('/conferences')">
        <ArrowLeft />
      </Button>
      <div class="flex-1 min-w-0">
        <h1 class="flex items-center gap-2 text-xl font-semibold">
          <CalendarDays class="h-5 w-5 text-primary" />
          {{ store.current?.name || '加载中...' }}
          <Badge v-if="store.current?.year" variant="outline">{{ store.current.year }}</Badge>
        </h1>
        <p v-if="store.current?.description" class="text-sm text-muted-foreground mt-0.5 truncate">{{ store.current.description }}</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" @click="refresh">
          <RefreshCw />刷新
        </Button>
        <Button variant="outline" size="sm" :disabled="resolving" @click="requireAuthThen(resolveAll)">
          {{ resolving ? '解析中…' : '解析(匹配 arXiv/S2)' }}
        </Button>
        <Button variant="outline" size="sm" @click="requireAuthThen(() => showImport = true)">
          <Upload />导入
        </Button>
        <Button size="sm" :disabled="candidateCount === 0" @click="openIngest">
          <Play />本次会议一键添加 ({{ candidateCount }})
        </Button>
      </div>
    </div>

    <!-- Bulk action bar -->
    <div v-if="selected.size > 0" class="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
      <span class="text-sm">已选 {{ selected.size }} 项</span>
      <Button variant="outline" size="xs" @click="bulkConfirm"><Check />批量确认</Button>
      <Button variant="outline" size="xs" @click="bulkRevert"><Undo2 />批量退回</Button>
      <Button variant="ghost" size="xs" class="ml-auto" @click="clearSelection">清除选择</Button>
    </div>

    <!-- Loading / empty -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <Loader2 class="h-5 w-5 animate-spin text-primary" />
    </div>

    <div v-else-if="store.candidates.length === 0" class="rounded-md border bg-card p-12 text-center text-muted-foreground">
      <FileText class="mx-auto h-10 w-10 stroke-1" />
      <p class="mt-3 text-sm">候选池为空</p>
      <p class="mt-1 text-xs">点右上角「导入」上传预抓取 JSON 文件</p>
    </div>

    <!-- Grouped by topic -->
    <div v-else class="space-y-4">
      <Card v-for="group in grouped" :key="group.key" class="overflow-hidden gap-0 py-0">
        <div class="flex items-center justify-between border-b px-5 py-3">
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-semibold">{{ group.label }}</h3>
            <Badge variant="secondary">{{ group.papers.length }}</Badge>
          </div>
          <Button variant="link" size="xs" @click="selectAll(group.papers)">全选本组</Button>
        </div>
        <div class="divide-y">
          <div
            v-for="c in group.papers" :key="c.id"
            class="flex items-start gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
          >
            <Checkbox
              :model-value="isInSystem(c) ? true : selected.has(c.id)"
              :disabled="isInSystem(c)"
              :title="isInSystem(c) ? '已在系统中（不可取消）' : ''"
              class="mt-1"
              @update:model-value="() => { if (!isInSystem(c)) toggleSelect(c.id) }"
            />

            <div class="flex-1 min-w-0 space-y-1">
              <div class="flex items-start gap-2">
                <span class="text-sm font-medium line-clamp-2 flex-1">{{ c.title }}</span>
              </div>

              <div class="flex flex-wrap items-center gap-1.5">
                <Badge v-if="c.source" variant="outline">{{ SOURCE_LABEL[c.source] }}</Badge>
                <Badge :variant="STATUS_VARIANT[c.status]">{{ STATUS_LABEL[c.status] }}</Badge>
                <SourceTag v-if="displayArxivId(c)" :arxiv-id="displayArxivId(c)" :link="null" />
                <S2Badge v-if="displayCorpusId(c)" :corpus-id="displayCorpusId(c)" />
                <!-- topic edit inline -->
                <template v-if="editingTopicId === c.id">
                  <Input
                    v-model="editingTopicValue"
                    placeholder="主题"
                    class="h-6 w-40"
                    @keydown.enter="saveTopic"
                    @keydown.escape="editingTopicId = null"
                  />
                  <Button variant="ghost" size="icon-xs" @click="saveTopic"><Check /></Button>
                </template>
                <Badge v-else-if="c.topic" as="button" variant="outline" class="cursor-pointer" @click="startEditTopic(c)">
                  {{ c.topic }}
                </Badge>
                <Button v-else variant="link" size="xs" @click="startEditTopic(c)">+ 主题</Button>

                <a
                  v-if="externalLink(c)"
                  :href="externalLink(c)!" target="_blank" rel="noopener"
                  class="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
                  @click.stop
                >
                  来源 <ExternalLink class="size-3" />
                </a>
                <router-link
                  v-if="c.paper_id && (c.status === 'ingested' || (c as any).paper_listed)"
                  :to="`/papers/${c.paper_id}`"
                  class="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
                >
                  打开论文 <ExternalLink class="size-3" />
                </router-link>
                <span v-else-if="c.paper_id && (c as any).paper_listed === false" class="text-[11px] text-muted-foreground">仅元数据 · 已索引</span>
              </div>
            </div>

            <div class="flex items-center gap-1 shrink-0">
              <Button
                v-if="c.paper_id && (c as any).paper_listed === false"
                variant="secondary" size="xs"
                :disabled="addingId === c.id"
                @click="addToLibrary(c)"
              >
                {{ addingId === c.id ? '加入中…' : '加入列表' }}
              </Button>
              <Button v-if="c.status === 'pending'" variant="ghost" size="icon-sm" title="确认为候选" @click="confirm(c.id)">
                <Check />
              </Button>
              <Button v-else-if="c.status === 'candidate'" variant="ghost" size="icon-sm" title="退回到待确认" @click="revert(c.id)">
                <Undo2 />
              </Button>
              <Button
                v-if="c.status !== 'ingested'"
                variant="ghost" size="icon-sm" class="hover:text-destructive"
                title="删除候选" @click="deleteRow(c.id)"
              >
                <Trash2 />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>

    <!-- Import dialog -->
    <Dialog v-model:open="showImport">
      <DialogContent class="max-w-xl">
        <DialogHeader>
          <DialogTitle>导入候选论文</DialogTitle>
          <DialogDescription>
            支持上传 JSON 文件或直接粘贴。格式：<code>{ "papers": [ { "title": "...", "topic": "...", "source": "arxiv", "external_id": "..." } ] }</code>，或直接是 papers 数组。
          </DialogDescription>
        </DialogHeader>
        <Tabs v-model="importMode">
          <TabsList class="grid grid-cols-2 w-full">
            <TabsTrigger value="paste"><FileJson />粘贴 JSON</TabsTrigger>
            <TabsTrigger value="file"><Upload />上传文件</TabsTrigger>
          </TabsList>
          <TabsContent value="paste">
            <Textarea v-model="importText" rows="10" placeholder='{ "papers": [ ... ] }' class="font-mono text-xs" />
          </TabsContent>
          <TabsContent value="file" class="space-y-2">
            <Input type="file" accept="application/json,.json" @change="onFileChosen" />
            <p v-if="importFileName" class="text-xs text-muted-foreground">已选：{{ importFileName }}（{{ importText.length }} 字符）</p>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="ghost" @click="showImport = false">取消</Button>
          <Button :disabled="!importText.trim() || importing" @click="submitImport">
            {{ importing ? '导入中...' : '导入' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- One-click ingest dialog -->
    <Dialog v-model:open="showIngest">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>本次会议一键添加</DialogTitle>
          <DialogDescription>
            将本会议下「候选中」状态的论文（{{ candidateCount }} 篇）批量添加到正式库。已存在的会按 arxiv/corpus id 幂等关联，不会重复创建。
          </DialogDescription>
        </DialogHeader>
        <div v-if="ingestSummary" class="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
          <div>✓ 入库 {{ ingestSummary.ingested }} 篇</div>
          <div v-if="ingestSummary.skipped > 0">⚠ 跳过 {{ ingestSummary.skipped }} 篇</div>
          <div v-if="ingestSummary.errors.length > 0">
            <details>
              <summary class="cursor-pointer text-destructive">错误 {{ ingestSummary.errors.length }} 条</summary>
              <ul class="mt-2 space-y-1 text-xs">
                <li v-for="e in ingestSummary.errors" :key="e.candidate_id"><code>#{{ e.candidate_id }}</code>: {{ e.message }}</li>
              </ul>
            </details>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" @click="showIngest = false">{{ ingestSummary ? '关闭' : '取消' }}</Button>
          <Button v-if="!ingestSummary" :disabled="ingesting || candidateCount === 0" @click="submitIngest">
            {{ ingesting ? '入库中...' : '开始入库' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
