<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import type { QAEntryBackgroundColor, QAInput, QAResult } from '@paperland/shared'
import { toast } from 'vue-sonner'
import { useQAComposer } from '@/composables/useQAComposer'
import { useBlockAnchor } from '@/composables/useBlockAnchor'
import QAInputSummary from './QAInputSummary.vue'
import { usePapersStore } from '@/stores/papers'
import { NO_QA_CONTENT_HINT, paperHasQAContent } from '@/lib/qa-content'
import { useQAStore } from '@/stores/qa'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/api/client'
import {
  Play, RefreshCw, CheckCircle2, Circle, Loader2, AlertCircle,
  ChevronsDownUp, ChevronsUpDown, User, Lock
} from '@lucide/vue'
import QAResultView from './QAResultView.vue'
import QAEntryBackgroundPicker from './QAEntryBackgroundPicker.vue'
import HighlightScopeToggle from './HighlightScopeToggle.vue'
import ScopeToggle from './ScopeToggle.vue'
import QAReadingIndicators from './QAReadingIndicators.vue'
import { qaEntryBackgroundClass } from './qa-entry-style'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

const props = defineProps<{ paperId: number }>()
const store = useQAStore()
const auth = useAuthStore()
const availableModels = ref<Array<{ name: string }>>([])
const composer = useQAComposer()
const papers = usePapersStore()
/** Asking needs the paper's full text; the backend rejects asks without it (409). */
const noContent = computed(() => {
  const paper = papers.currentPaper
  return !!paper && paper.id === props.paperId && !paperHasQAContent(paper)
})
const { revealQAEntry } = useBlockAnchor()

onMounted(async () => {
  if (!auth.isAuthenticated) return // models endpoint requires login; anon only views template QA
  try {
    const res = await api.get<{ models: { available: Array<{ name: string }> } }>('/api/config/models')
    availableModels.value = res.models.available
  } catch {
    availableModels.value = [{ name: 'gpt-4o' }]
  }
})

interface QAEntry {
  key: string
  type: 'free' | 'template'
  title: string
  entryId: number
  status: string
  error: string | null
  results: any[]
  templateName?: string
  userId: number | null
  /** Owner display name (nickname → username). */
  ownerName: string | null
  shared: boolean
  canManage: boolean
  backgroundColor: QAEntryBackgroundColor | null
  highlightCount: number
  noteAnchorCount: number
  inputs: QAInput[]
  parentEntryId: number | null
}

const templateEntries = computed(() => {
  const entries: QAEntry[] = []
  for (const tmpl of store.templates) {
    const data = store.qaData.template[tmpl.name]
    entries.push({
      key: 'tmpl-' + tmpl.name,
      type: 'template',
      title: tmpl.prompt,
      entryId: data?.entry_id || 0,
      status: data?.status || 'idle',
      error: data?.error || null,
      results: data?.results || [],
      templateName: tmpl.name,
      userId: null,
      ownerName: null,
      shared: true,
      canManage: data?.can_manage ?? auth.isAuthenticated,
      backgroundColor: data?.background_color ?? null,
      highlightCount: data?.highlight_count ?? 0,
      noteAnchorCount: data?.note_anchor_count ?? 0,
      inputs: data?.inputs ?? [],
      parentEntryId: data?.parent_entry_id ?? null,
    })
  }
  return entries
})

const freeEntries = computed(() => {
  const entries: QAEntry[] = []
  for (const entry of store.qaData.free) {
    entries.push({
      key: 'free-' + entry.entry_id,
      type: 'free',
      title: entry.prompt || '自由提问',
      entryId: entry.entry_id,
      status: entry.status,
      error: entry.error,
      results: entry.results,
      userId: entry.user_id,
      ownerName: entry.display_name ?? entry.username,
      shared: entry.shared ?? true,
      canManage: entry.can_manage,
      backgroundColor: entry.background_color,
      highlightCount: entry.highlight_count,
      noteAnchorCount: entry.note_anchor_count,
      inputs: entry.inputs ?? [],
      parentEntryId: entry.parent_entry_id ?? null,
    })
  }
  return entries
})

const hasResults = (e: QAEntry) => e.results.length > 0
const isRunning = (e: QAEntry) => e.status === 'running' || e.status === 'pending'
const isFailed = (e: QAEntry) => e.status === 'failed'

const openMap = ref<Record<string, boolean>>({})

function collapseKey(entryKey: string) { return `qa-collapse-${props.paperId}-${entryKey}` }

function setOpen(key: string, open: boolean) {
  openMap.value[key] = open
  localStorage.setItem(collapseKey(key), open ? '1' : '0')
}

function setAllOpen(entries: QAEntry[], open: boolean) {
  for (const e of entries) {
    if (hasResults(e)) setOpen(e.key, open)
  }
}

const hasUngenerated = computed(() =>
  store.templates.some(t => {
    const e = store.qaData.template[t.name]
    return !e || !e.results.some((result) => result.status === 'done')
  })
)

const regenDialog = ref<{ show: boolean; entry: QAEntry | null; selectedModels: string[] }>({ show: false, entry: null, selectedModels: [] })

function openRegenDialog(entry: QAEntry) {
  if (!entry.canManage) return
  regenDialog.value = {
    show: true,
    entry,
    selectedModels: availableModels.value.length ? [availableModels.value[0].name] : [],
  }
}

function toggleRegenModel(name: string) {
  const models = regenDialog.value.selectedModels
  if (models.includes(name)) {
    regenDialog.value.selectedModels = models.filter(m => m !== name)
  } else {
    models.push(name)
  }
}

const confirmDialog = ref<{ show: boolean; message: string; onConfirm: () => void }>({
  show: false, message: '', onConfirm: () => {},
})

function submitRegen() {
  const { entry, selectedModels } = regenDialog.value
  if (!entry || !selectedModels.length) return

  if (isRunning(entry)) {
    const runningModels = selectedModels.join(', ')
    confirmDialog.value = {
      show: true,
      message: `关于「${entry.title.slice(0, 30)}${entry.title.length > 30 ? '...' : ''}」正在生成中，是否需要重新提交 ${runningModels}？`,
      onConfirm: () => {
        doRegen(entry, selectedModels)
        confirmDialog.value.show = false
      },
    }
    regenDialog.value.show = false
    return
  }

  doRegen(entry, selectedModels)
  regenDialog.value.show = false
}

function doRegen(entry: QAEntry, models: string[]) {
  if (!entry.canManage) return
  if (entry.type === 'template' && entry.templateName) {
    for (const model of models) {
      store.regenerateTemplate(props.paperId, entry.templateName, model)
    }
  } else {
    store.regenerateEntry(entry.entryId, props.paperId, models)
  }
}

function onResultRegenerate(entry: QAEntry, modelName: string) {
  if (!entry.canManage) return
  regenDialog.value = {
    show: true,
    entry,
    selectedModels: [modelName],
  }
}

function onDeleteResult(resultId: number) {
  store.deleteResult(resultId, props.paperId)
}

function generateTemplate(templateName: string) {
  store.regenerateTemplate(props.paperId, templateName)
}

// Entry hidden from other non-admin users (owner's Q&A switch off): admins see it on others'
// entries; owners see it on their own.
function isPrivate(entry: QAEntry): boolean {
  return entry.type === 'free' && !entry.shared
}

/** `QA-<id>`: copy a link to the entry (`?qa=<id>`, resolved by entry id; paper id kept for readability). */
async function copyEntryLink(entry: QAEntry) {
  const url = `paperland://paper/${props.paperId}?qa=${entry.entryId}`
  await navigator.clipboard.writeText(`[QA-${entry.entryId}](${url})`)
  toast.success(`已复制 QA-${entry.entryId} 链接`, { position: 'bottom-center' })
}

/** Continue a specific completed answer in the question box (also from `#moonlight` suggestions). */
function startFollowup(entry: QAEntry, result: QAResult, prefill?: string) {
  if (result.status !== 'done') return
  void composer.startFollowup({
    result_id: result.id, entry_id: entry.entryId, title: entry.title, model_name: result.model_name,
  }, prefill)
}

/** Jump to the entry a follow-up continues; unshared or deleted parents only show a notice. */
async function openParent(entry: QAEntry) {
  if (entry.parentEntryId == null) return
  const history = entry.inputs.find((input) => input.kind === 'history')
  const located = await store.locateEntry(entry.parentEntryId, history?.kind === 'history' ? history.result_id : null)
  if (located.state === 'hidden') { toast.info('当前不可见'); return }
  if (located.state === 'deleted') { toast.info('已删除'); return }
  if (located.paper_id === props.paperId) revealQAEntry(entry.parentEntryId, located.result_id ?? null)
}

function setPaperScope(scope: 'mine' | 'all') {
  store.setPaperScope(scope)
}
</script>

<template>
  <!-- Preset Q&A Card -->
  <Card v-if="templateEntries.length" class="overflow-hidden gap-0 py-0">
    <div class="flex items-center justify-between border-b px-5 py-3">
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-semibold">Preset Q&A</h3>
        <span v-if="store.polling" class="inline-flex items-center gap-1 text-[10px] text-primary">
          <Loader2 class="h-3 w-3 animate-spin" /> 生成中...
        </span>
      </div>
      <div class="flex items-center gap-1.5">
        <!-- Page-wide highlight overlay scope (applies to every answer on this paper) -->
        <HighlightScopeToggle class="mr-1" size="sm" />
        <Button variant="ghost" size="icon-sm" title="全部展开" @click="setAllOpen(templateEntries, true)">
          <ChevronsUpDown />
        </Button>
        <Button variant="ghost" size="icon-sm" title="全部折叠" @click="setAllOpen(templateEntries, false)">
          <ChevronsDownUp />
        </Button>
        <Button
          v-if="hasUngenerated" size="sm" :disabled="store.submitting || noContent"
          :title="noContent ? NO_QA_CONTENT_HINT : undefined"
          @click="store.triggerAllTemplates(props.paperId)"
        >
          <Play /> 一键生成
        </Button>
      </div>
    </div>

    <div class="divide-y">
      <template v-for="entry in templateEntries" :key="entry.key">

        <Collapsible
          v-if="hasResults(entry)"
          :open="openMap[entry.key] || false"
          :class="qaEntryBackgroundClass(entry.backgroundColor)"
          @update:open="(v: boolean) => setOpen(entry.key, v)"
        >
          <CollapsibleTrigger
            :data-qa-entry="entry.key"
            class="flex w-full items-center gap-3 px-5 py-3 cursor-pointer hover:bg-muted/40 transition-colors text-left"
          >
            <CheckCircle2 v-if="entry.status === 'done'" class="h-4 w-4 text-muted-foreground shrink-0" />
            <Loader2 v-else-if="isRunning(entry)" class="h-4 w-4 text-primary shrink-0 animate-spin" />
            <CheckCircle2 v-else class="h-4 w-4 text-muted-foreground shrink-0" />
            <div class="flex-1 min-w-0">
              <span class="text-sm font-semibold line-clamp-1">{{ entry.title }}</span>
            </div>
            <QAInputSummary :inputs="entry.inputs" />
            <QAReadingIndicators :highlight-count="entry.highlightCount" :note-anchor-count="entry.noteAnchorCount" />
            <QAEntryBackgroundPicker
              v-if="auth.isAuthenticated && entry.entryId > 0"
              :entry-id="entry.entryId" :color="entry.backgroundColor"
            />
            <button
              v-if="entry.entryId > 0" type="button"
              class="shrink-0 text-[10px] text-muted-foreground hover:text-foreground"
              title="复制 QA 链接"
              @click.stop="copyEntryLink(entry)"
            >QA-{{ entry.entryId }}</button>
          </CollapsibleTrigger>
          <CollapsibleContent class="px-5 pb-4 pt-1">
            <QAResultView
              :results="entry.results"
              :entry-key="entry.key"
              :paper-id="props.paperId"
              :can-manage="entry.canManage"
              @regenerate="(model: string) => onResultRegenerate(entry, model)"
              @delete-result="onDeleteResult"
              @cancel-result="store.cancelResult"
              @followup="(result: QAResult, prefill?: string) => startFollowup(entry, result, prefill)"
            />
          </CollapsibleContent>
        </Collapsible>

        <div v-else class="flex items-center gap-3 px-5 py-3" :class="qaEntryBackgroundClass(entry.backgroundColor)">
          <AlertCircle v-if="isFailed(entry)" class="h-4 w-4 text-destructive shrink-0" />
          <Loader2 v-else-if="isRunning(entry)" class="h-4 w-4 text-primary shrink-0 animate-spin" />
          <Circle v-else class="h-4 w-4 text-muted-foreground shrink-0" />
          <div class="flex-1 min-w-0">
            <span class="text-sm font-semibold line-clamp-1">{{ entry.title }}</span>
            <p v-if="isFailed(entry) && entry.error" class="text-xs text-destructive mt-0.5 truncate">{{ entry.error }}</p>
          </div>
          <QAReadingIndicators :highlight-count="entry.highlightCount" :note-anchor-count="entry.noteAnchorCount" />
          <QAEntryBackgroundPicker
            v-if="auth.isAuthenticated && entry.entryId > 0"
            :entry-id="entry.entryId" :color="entry.backgroundColor"
          />
          <span v-if="isRunning(entry)" class="text-[10px] text-primary shrink-0">生成中...</span>
          <Button
            v-else-if="isFailed(entry)"
            variant="link" size="xs"
            class="text-destructive shrink-0"
            @click.stop="generateTemplate(entry.templateName!)"
          >
            重试
          </Button>
          <Button
            v-else
            variant="link" size="xs"
            class="shrink-0"
            :disabled="noContent"
            :title="noContent ? NO_QA_CONTENT_HINT : undefined"
            @click.stop="generateTemplate(entry.templateName!)"
          >
            生成
          </Button>
        </div>

      </template>
    </div>
  </Card>

  <!-- User Q&A Card -->
  <Card v-if="auth.isAuthenticated" class="overflow-hidden gap-0 py-0">
    <div class="flex items-center justify-between border-b px-5 py-3">
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-semibold">User Q&A</h3>
        <span v-if="store.polling" class="inline-flex items-center gap-1 text-[10px] text-primary">
          <Loader2 class="h-3 w-3 animate-spin" /> 生成中...
        </span>
      </div>
      <div class="flex items-center gap-1.5">
        <!-- Same page-wide highlight scope as the Preset Q&A header (one store value, so both stay in sync);
             others' shared User Q&A can be highlighted too. -->
        <HighlightScopeToggle class="mr-1" size="sm" />
        <ScopeToggle
          class="mr-1" size="sm"
          title="User Q&A: show only mine, or also others' shared questions"
          :model-value="store.paperScope"
          :disabled="store.loading"
          @update:model-value="setPaperScope"
        />
        <Button variant="ghost" size="icon-sm" title="全部展开" @click="setAllOpen(freeEntries, true)">
          <ChevronsUpDown />
        </Button>
        <Button variant="ghost" size="icon-sm" title="全部折叠" @click="setAllOpen(freeEntries, false)">
          <ChevronsDownUp />
        </Button>
      </div>
    </div>

    <div class="divide-y">
      <template v-for="entry in freeEntries" :key="entry.key">

        <Collapsible
          v-if="hasResults(entry)"
          :open="openMap[entry.key] || false"
          :class="qaEntryBackgroundClass(entry.backgroundColor)"
          @update:open="(v: boolean) => setOpen(entry.key, v)"
        >
          <CollapsibleTrigger
            :data-qa-entry="entry.key"
            class="flex w-full items-center gap-3 px-5 py-3 cursor-pointer hover:bg-muted/40 transition-colors text-left"
          >
            <CheckCircle2 v-if="entry.status === 'done'" class="h-4 w-4 text-muted-foreground shrink-0" />
            <Loader2 v-else-if="isRunning(entry)" class="h-4 w-4 text-primary shrink-0 animate-spin" />
            <CheckCircle2 v-else class="h-4 w-4 text-muted-foreground shrink-0" />
            <div class="flex-1 min-w-0">
              <span class="text-sm font-semibold line-clamp-1">{{ entry.title }}</span>
              <span
                v-if="store.paperScope === 'all' && entry.ownerName"
                class="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground"
              ><User class="h-2.5 w-2.5" />{{ entry.ownerName }}<template v-if="isPrivate(entry)"> · <Lock class="h-2.5 w-2.5" />Private</template></span>
            </div>
            <QAInputSummary :inputs="entry.inputs" />
            <QAReadingIndicators :highlight-count="entry.highlightCount" :note-anchor-count="entry.noteAnchorCount" />
            <QAEntryBackgroundPicker
              :entry-id="entry.entryId" :color="entry.backgroundColor"
            />
            <button
              v-if="entry.entryId > 0" type="button"
              class="shrink-0 text-[10px] text-muted-foreground hover:text-foreground"
              title="复制 QA 链接"
              @click.stop="copyEntryLink(entry)"
            >QA-{{ entry.entryId }}</button>
          </CollapsibleTrigger>
          <CollapsibleContent class="px-5 pb-4 pt-1">
            <button
              v-if="entry.parentEntryId != null" type="button"
              class="mb-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              @click="openParent(entry)"
            >接续 QA-{{ entry.parentEntryId }} 的回答</button>
            <QAResultView
              :results="entry.results"
              :entry-key="entry.key"
              :paper-id="props.paperId"
              :can-manage="entry.canManage"
              @regenerate="(model: string) => onResultRegenerate(entry, model)"
              @delete-result="onDeleteResult"
              @cancel-result="store.cancelResult"
              @followup="(result: QAResult, prefill?: string) => startFollowup(entry, result, prefill)"
            />
          </CollapsibleContent>
        </Collapsible>

        <div v-else class="flex items-center gap-3 px-5 py-3" :class="qaEntryBackgroundClass(entry.backgroundColor)">
          <AlertCircle v-if="isFailed(entry)" class="h-4 w-4 text-destructive shrink-0" />
          <Loader2 v-else-if="isRunning(entry)" class="h-4 w-4 text-primary shrink-0 animate-spin" />
          <Circle v-else class="h-4 w-4 text-muted-foreground shrink-0" />
          <div class="flex-1 min-w-0">
            <span class="text-sm font-semibold line-clamp-1">{{ entry.title }}</span>
            <span
              v-if="store.paperScope === 'all' && entry.ownerName"
              class="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground"
            ><User class="h-2.5 w-2.5" />{{ entry.ownerName }}<template v-if="isPrivate(entry)"> · <Lock class="h-2.5 w-2.5" />Private</template></span>
            <p v-if="isFailed(entry) && entry.error" class="text-xs text-destructive mt-0.5 truncate">{{ entry.error }}</p>
          </div>
          <QAReadingIndicators :highlight-count="entry.highlightCount" :note-anchor-count="entry.noteAnchorCount" />
          <QAEntryBackgroundPicker :entry-id="entry.entryId" :color="entry.backgroundColor" />
          <span v-if="isRunning(entry)" class="text-[10px] text-primary shrink-0">生成中...</span>
          <Button
            v-else-if="isFailed(entry) && entry.canManage"
            variant="link" size="xs"
            class="text-destructive shrink-0"
            @click.stop="store.regenerateEntry(entry.entryId, props.paperId, store.selectedModels)"
          >
            重试
          </Button>
          <Button
            v-else-if="entry.canManage"
            variant="link" size="xs"
            class="shrink-0"
            @click.stop="openRegenDialog(entry)"
          >
            生成
          </Button>
        </div>

      </template>
      <div v-if="freeEntries.length === 0" class="px-5 py-6 text-center text-xs text-muted-foreground">
        {{ store.paperScope === 'mine' ? 'No Q&A of yours yet.' : 'No User Q&A yet.' }}
      </div>
    </div>
  </Card>

  <!-- Empty state -->
  <Card v-if="!templateEntries.length && !auth.isAuthenticated">
    <div class="px-5 py-8 text-center text-sm text-muted-foreground">暂无 Q&A 记录</div>
  </Card>

  <!-- Model selection dialog for regenerate -->
  <Dialog v-model:open="regenDialog.show">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>重新生成</DialogTitle>
        <DialogDescription class="truncate">{{ regenDialog.entry?.title }}</DialogDescription>
      </DialogHeader>
      <div class="flex flex-wrap gap-1.5">
        <Button
          v-for="m in availableModels" :key="m.name"
          :variant="regenDialog.selectedModels.includes(m.name) ? 'secondary' : 'outline'"
          size="xs"
          @click="toggleRegenModel(m.name)"
        >
          {{ m.name }}
        </Button>
      </div>
      <DialogFooter>
        <Button variant="ghost" @click="regenDialog.show = false">取消</Button>
        <Button @click="submitRegen" :disabled="!regenDialog.selectedModels.length">
          <RefreshCw />提交
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Confirm dialog -->
  <Dialog v-model:open="confirmDialog.show">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>确认</DialogTitle>
        <DialogDescription>{{ confirmDialog.message }}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="ghost" @click="confirmDialog.show = false">取消</Button>
        <Button @click="confirmDialog.onConfirm()">重新提交</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
