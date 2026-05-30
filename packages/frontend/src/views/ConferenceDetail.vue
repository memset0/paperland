<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConferencesStore } from '@/stores/conferences'
import { useAuthStore } from '@/stores/auth'
import { useLoginPrompt } from '@/composables/useLoginPrompt'
import { toast } from 'vue-sonner'
import {
  ArrowLeft, CalendarDays, Upload, Plus, Check, Trash2, Pencil,
  Loader2, RefreshCw, FileText, FileJson, MoreVertical, ChevronDown, ChevronUp,
} from '@lucide/vue'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import S2Badge from '@/components/S2Badge.vue'
import type { ConferencePaper } from '@paperland/shared'

const route = useRoute()
const router = useRouter()
const store = useConferencesStore()
const auth = useAuthStore()
const { openLogin } = useLoginPrompt()

const id = computed(() => parseInt(route.params.id as string, 10))

const loading = ref(true)
const selected = ref<Set<number>>(new Set())
const expanded = ref<Set<number>>(new Set())
const editingTopicId = ref<number | null>(null)
const editingTopicValue = ref('')

const showImport = ref(false)
const importMode = ref<'file' | 'paste'>('paste')
const importText = ref('')
const importFileName = ref('')
const importing = ref(false)

const resolving = ref(false)
const addingId = ref<number | null>(null)
const promotingBulk = ref(false)

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

// --- Derived three-state lifecycle: 待添加 / 仅元数据 / 已在库 ---
type CandState = 'pending' | 'metadata' | 'listed'
function candidateState(c: any): CandState {
  if (c.paper_listed === true || c.status === 'ingested') return 'listed'
  if (c.paper_id != null) return 'metadata'
  return 'pending'
}
function stateLabel(c: any): string {
  return { pending: '待添加', metadata: '仅元数据', listed: '已在库' }[candidateState(c)]
}
function stateVariant(c: any): 'outline' | 'secondary' | 'default' {
  return ({ pending: 'outline', metadata: 'secondary', listed: 'default' } as const)[candidateState(c)]
}
function checkboxTitle(c: any): string {
  const s = candidateState(c)
  return s === 'listed' ? '已在库（不可取消）' : s === 'pending' ? '需先「解析」才能加入' : ''
}

// --- Screening fields (from the linked paper, surfaced by the API) ---
function authorsLine(c: any): string {
  const a = Array.isArray(c.authors) ? c.authors : []
  if (!a.length) return ''
  return a.length <= 3 ? a.join(', ') : `${a.slice(0, 3).join(', ')} et al.`
}

// --- Resolved arXiv / S2 ids (linked paper → candidate source → cached S2 match) ---
function displayArxivId(c: any): string | null {
  return c.paper_arxiv_id || (c.source === 'arxiv' ? c.external_id : null) || c.metadata?.s2_match?.arxiv_id || null
}
function displayCorpusId(c: any): string | null {
  return c.paper_corpus_id || (c.source === 'semantic_scholar' ? c.external_id : null) || c.metadata?.s2_match?.corpus_id || null
}
const chipClass = 'inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors'

// --- Grouping by topic ---
const grouped = computed(() => {
  const map = new Map<string, ConferencePaper[]>()
  for (const c of store.candidates) {
    const key = c.topic || '__未分类__'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(c)
  }
  const keys = [...map.keys()].sort((a, b) => {
    if (a === '__未分类__') return 1
    if (b === '__未分类__') return -1
    return a.localeCompare(b)
  })
  return keys.map(k => ({ key: k, label: k === '__未分类__' ? '未分类' : k, papers: map.get(k)! }))
})

// --- Action gating ---
function requireAuthThen(fn: () => void) {
  if (!auth.isAuthenticated) { openLogin(); return }
  fn()
}

// --- Selection (only 仅元数据 rows are selectable) ---
function toggleSelect(cpId: number) {
  const next = new Set(selected.value)
  if (next.has(cpId)) next.delete(cpId); else next.add(cpId)
  selected.value = next
}
function selectAll(papers: ConferencePaper[]) {
  const next = new Set(selected.value)
  for (const p of papers) if (candidateState(p) === 'metadata') next.add(p.id)
  selected.value = next
}
function clearSelection() { selected.value = new Set() }
function toggleExpand(cpId: number) {
  const next = new Set(expanded.value)
  if (next.has(cpId)) next.delete(cpId); else next.add(cpId)
  expanded.value = next
}

// --- Promote (加入列表) ---
async function addToLibrary(c: any) {
  if (!c.paper_id) return
  addingId.value = c.id
  try { await store.promotePaper(c.paper_id); await refresh() }
  catch (e: any) { toast.error(`加入失败：${e?.message || e}`) }
  finally { addingId.value = null }
}
async function promoteSelected() {
  if (selected.value.size === 0) return
  requireAuthThen(async () => {
    promotingBulk.value = true
    try {
      const res = await store.promoteMany(id.value, [...selected.value])
      clearSelection()
      await refresh()
      toast.success(`已加入 ${res.promoted} 篇${res.skipped ? `，跳过 ${res.skipped}` : ''}`)
      if (res.errors?.length) toast.error(`${res.errors.length} 篇失败`)
    } catch (e: any) {
      toast.error(`加入失败：${e?.message || e}`)
    } finally {
      promotingBulk.value = false
    }
  })
}

// --- Topic edit / delete ---
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
async function deleteRow(cpId: number) {
  requireAuthThen(async () => {
    if (!window.confirm('确认删除该候选论文？')) return
    await store.deleteCandidate(id.value, cpId)
    selected.value.delete(cpId)
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
      </div>
    </div>

    <!-- Bulk action bar -->
    <div v-if="selected.size > 0" class="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
      <span class="text-sm">已选 {{ selected.size }} 项</span>
      <Button size="xs" :disabled="promotingBulk" @click="promoteSelected">
        <Plus />{{ promotingBulk ? '加入中…' : `加入选中到列表 (${selected.size})` }}
      </Button>
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
          <!-- Candidate screening card -->
          <div
            v-for="c in group.papers" :key="c.id"
            class="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors"
          >
            <Checkbox
              class="mt-1"
              :model-value="candidateState(c) === 'listed' ? true : selected.has(c.id)"
              :disabled="candidateState(c) !== 'metadata'"
              :title="checkboxTitle(c)"
              @update:model-value="() => { if (candidateState(c) === 'metadata') toggleSelect(c.id) }"
            />

            <div class="flex-1 min-w-0 space-y-1.5">
              <!-- Title -->
              <div class="text-sm font-medium leading-snug">{{ c.title }}</div>

              <!-- Meta line: authors · citations · fields -->
              <div
                v-if="authorsLine(c) || (c as any).paper_citation_count != null || (c as any).paper_fields_of_study?.length"
                class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground"
              >
                <span v-if="authorsLine(c)" class="truncate max-w-full">{{ authorsLine(c) }}</span>
                <span v-if="(c as any).paper_citation_count != null">· 引用 {{ (c as any).paper_citation_count }}</span>
                <span v-if="(c as any).paper_fields_of_study?.length">· {{ (c as any).paper_fields_of_study.join(' / ') }}</span>
              </div>

              <!-- TL;DR -->
              <p v-if="(c as any).paper_tldr" class="text-xs leading-relaxed">
                <span class="font-medium text-foreground">TL;DR </span>
                <span class="text-muted-foreground">{{ (c as any).paper_tldr }}</span>
              </p>

              <!-- Abstract (clamped, expandable) -->
              <div v-if="(c as any).paper_abstract" class="text-xs text-muted-foreground leading-relaxed">
                <p :class="expanded.has(c.id) ? '' : 'line-clamp-2'">{{ (c as any).paper_abstract }}</p>
                <button
                  class="mt-0.5 inline-flex items-center gap-0.5 text-primary hover:underline"
                  @click="toggleExpand(c.id)"
                >
                  {{ expanded.has(c.id) ? '收起' : '展开' }}
                  <component :is="expanded.has(c.id) ? ChevronUp : ChevronDown" class="size-3" />
                </button>
              </div>

              <!-- Links + topic -->
              <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
                <a v-if="displayArxivId(c)" :href="`https://arxiv.org/abs/${displayArxivId(c)}`" target="_blank" rel="noopener" :class="chipClass" @click.stop>arXiv</a>
                <S2Badge v-if="displayCorpusId(c)" :corpus-id="displayCorpusId(c)" />
                <a v-if="c.link" :href="c.link" target="_blank" rel="noopener" :class="chipClass" @click.stop>{{ /openreview\.net/.test(c.link) ? 'OpenReview' : '原文' }}</a>

                <template v-if="editingTopicId === c.id">
                  <Input
                    v-model="editingTopicValue"
                    placeholder="主题"
                    class="h-6 w-32"
                    @keydown.enter="saveTopic"
                    @keydown.escape="editingTopicId = null"
                  />
                  <Button variant="ghost" size="icon-xs" @click="saveTopic"><Check /></Button>
                </template>
                <Badge v-else-if="c.topic" as="button" variant="outline" class="cursor-pointer" @click="startEditTopic(c)">
                  #{{ c.topic }}
                </Badge>
              </div>
            </div>

            <!-- State + actions -->
            <div class="flex items-center gap-1.5 shrink-0">
              <Badge :variant="stateVariant(c)">{{ stateLabel(c) }}</Badge>
              <Button
                v-if="candidateState(c) === 'metadata'"
                size="xs" :disabled="addingId === c.id"
                @click="addToLibrary(c)"
              >
                {{ addingId === c.id ? '加入中…' : '加入' }}
              </Button>
              <Button
                v-else-if="candidateState(c) === 'listed'"
                as-child variant="secondary" size="xs"
              >
                <router-link :to="`/papers/${c.paper_id}`">打开</router-link>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon-sm"><MoreVertical /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="startEditTopic(c)">
                    <Pencil />编辑主题
                  </DropdownMenuItem>
                  <DropdownMenuItem v-if="candidateState(c) !== 'listed'" class="text-destructive" @click="deleteRow(c.id)">
                    <Trash2 />删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
  </div>
</template>
