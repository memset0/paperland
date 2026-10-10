<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft, ChevronRight, Clock, FileText, History, Library, ListPlus, Loader2, MessageSquareText, Pencil, RotateCcw, Send, Square, Trash2, TriangleAlert, X,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import type { ResearchStep, ResearchStepStatus } from '@paperland/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import MarkdownContent from '@/components/MarkdownContent.vue'
import QAStreamingMarkdown from '@/components/QAStreamingMarkdown.vue'
import PaperRefList from '@/components/PaperRefList.vue'
import ResearchPaperList from '@/components/ResearchPaperList.vue'
import { extractCiteLinks } from '@/lib/cite-links'
import { listTitle, sectionTitles, splitStreamingAnswer } from '@/lib/research-list'
import { usePageTitle } from '@/composables/usePageTitle'
import { useNarrowLayout } from '@/composables/useNarrowLayout'
import MobileBottomBar, { type BottomBarItem } from '@/components/MobileBottomBar.vue'
import { createReusableTemplate, useElementSize } from '@vueuse/core'
import { isActiveStep, useResearchStore, versionSteps } from '@/stores/research'

const route = useRoute()
const router = useRouter()
const store = useResearchStore()

const session = computed(() => store.current)
const steps = computed(() => session.value?.steps ?? [])
const versions = computed(() => versionSteps(steps.value))
const activeStep = computed(() => steps.value.find(isActiveStep) ?? null)
const latestStep = computed(() => steps.value[steps.value.length - 1] ?? null)
const canEdit = computed(() => !!session.value?.can_edit)

usePageTitle(() => session.value?.title ?? 'Research')

// ── Version selection (null = latest) ──
const selectedVersionStepId = ref<number | null>(null)
const selectedVersion = computed(() => {
  const list = versions.value
  if (!list.length) return null
  return list.find((s) => s.id === selectedVersionStepId.value) ?? list[list.length - 1]
})
const selectedVersionNumber = computed(() => selectedVersion.value ? versions.value.indexOf(selectedVersion.value) + 1 : 0)
const viewingLatest = computed(() => selectedVersionNumber.value === versions.value.length)
const previousVersion = computed(() => selectedVersionNumber.value > 1 ? versions.value[selectedVersionNumber.value - 2] : null)
const versionTab = ref<'report' | 'papers'>('report')

// ── Narrow layout: Instruct / Report / Papers sections switched from the mobile bottom bar ──
const narrow = useNarrowLayout()
type ResearchSection = 'instruct' | 'report' | 'papers'
const mobileSection = ref<ResearchSection>('report')
watch(mobileSection, (section) => { if (section !== 'instruct') versionTab.value = section })
// Wide: input on top, newest round first. Narrow: oldest first, the newest next to the fixed input.
const orderedSteps = computed(() => (narrow.value ? steps.value : [...steps.value].reverse()))
const [DefineComposer, Composer] = createReusableTemplate<{ docked?: boolean }>()
const dockedComposer = ref<HTMLElement | null>(null)
const { height: dockedComposerHeight } = useElementSize(dockedComposer, undefined, { box: 'border-box' })
const bottomBarItems = computed<BottomBarItem[]>(() => [
  { key: 'instruct', label: 'Instruct', icon: MessageSquareText, busy: !!activeStep.value, badge: session.value?.queued_messages.length },
  { key: 'report', label: 'Report', icon: FileText },
  { key: 'papers', label: 'Papers', icon: Library },
])
/**
 * Scroll the page (the app's <main>; the narrow sections share it) to the top or the end. Waits a
 * frame so the newly shown section and the docked input's padding are laid out first.
 */
function scrollPage(to: 'top' | 'bottom') {
  void nextTick(() => requestAnimationFrame(() => {
    const main = document.querySelector('main')
    main?.scrollTo({ top: to === 'top' ? 0 : main.scrollHeight })
  }))
}
// Switching sections resets the scroll: Instruct opens at the newest round, Report / Papers at the top.
watch(mobileSection, (section) => scrollPage(section === 'instruct' ? 'bottom' : 'top'))
// New rounds, and the docked input's reserved space settling (measured after it is shown), keep
// Instruct pinned to the newest round.
watch([() => steps.value.length, dockedComposerHeight], () => {
  if (narrow.value && mobileSection.value === 'instruct') scrollPage('bottom')
})
const refsOpen = ref(false)
const reportCites = computed(() =>
  extractCiteLinks(selectedVersion.value?.report ?? '').map((link) => ({ id: link.id, fallback_text: link.text })),
)

function versionNumberOf(step: ResearchStep): number | null {
  const i = versions.value.indexOf(step)
  return i >= 0 ? i + 1 : null
}

// ── Load ──
async function load(id: number) {
  selectedVersionStepId.value = null
  try {
    await Promise.all([store.openSession(id), store.fetchModels().catch(() => {})])
    mobileSection.value = versions.value.length ? 'report' : 'instruct'
  } catch {
    router.replace('/research')
  }
}
watch(() => Number(route.params.id), (id) => { if (Number.isInteger(id)) void load(id) }, { immediate: true })
onBeforeUnmount(() => store.closeSession())

// When a new version arrives, follow it if the user was on the latest one.
watch(() => versions.value.length, () => { if (viewingLatest.value) selectedVersionStepId.value = null })

// ── Next round ──
const nextText = ref('')
const nextModel = ref<string | null>(null)
const submitting = ref(false)
const queuedMessages = computed(() => session.value?.queued_messages ?? [])
watch(() => [store.latestModel, store.defaultModel] as const, ([latest, fallback]) => {
  if (!nextModel.value) nextModel.value = latest ?? fallback
}, { immediate: true })

/** Send now (idle: the queue + this text start a round) or add to the queue (`queueOnly`). */
async function submitRound(queueOnly = false) {
  const text = nextText.value.trim()
  if (!nextModel.value || (!text && (queueOnly || !queuedMessages.value.length))) return
  submitting.value = true
  try {
    await store.submit(text, nextModel.value, queueOnly)
    nextText.value = ''
    if (!queueOnly) selectedVersionStepId.value = null
  } finally {
    submitting.value = false
  }
}
const canSend = computed(() => !!nextModel.value && (!!nextText.value.trim() || queuedMessages.value.length > 0))

/** "3m 12s" for a finished round (started → finished). */
function roundDuration(step: ResearchStep): string | null {
  if (!step.started_at || !step.finished_at) return null
  const seconds = Math.max(0, Math.round((Date.parse(step.finished_at) - Date.parse(step.started_at)) / 1000))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const sec = seconds % 60
  return h ? `${h}h ${m}m` : m ? `${m}m ${sec}s` : `${sec}s`
}

// ── Retry / cancel ──
const retryOpen = ref(false)
const retryText = ref('')
const retryModel = ref<string | null>(null)
function openRetry(step: ResearchStep) {
  retryText.value = step.user_text ?? ''
  retryModel.value = step.model_name
  retryOpen.value = true
}
async function confirmRetry() {
  if (!latestStep.value || !retryText.value.trim()) return
  await store.retry(latestStep.value.id, { user_text: retryText.value.trim(), model_name: retryModel.value ?? undefined })
  retryOpen.value = false
}

// ── Continue from a historical version (destructive) ──
const truncateOpen = ref(false)
const afterTruncate = ref<null | (() => void)>(null)
const stepsToDelete = computed(() => {
  const target = selectedVersion.value
  return target ? steps.value.filter((s) => s.step_index > target.step_index) : []
})
const laterVersionCount = computed(() => versions.value.length - selectedVersionNumber.value)

function askContinueFromVersion(then?: () => void) {
  afterTruncate.value = then ?? null
  truncateOpen.value = true
}
async function confirmTruncate() {
  const target = selectedVersion.value
  if (!target) return
  await store.truncate(target.step_index)
  truncateOpen.value = false
  selectedVersionStepId.value = null
  toast.success(`Continuing from version ${selectedVersionNumber.value}`)
  afterTruncate.value?.()
}

// ── Title edits (current version only) ──
const titlesOpen = ref(false)
const editTitle = ref('')
const editSections = ref<string[]>([])
const savingTitles = ref(false)
function openTitleEditor() {
  const list = versions.value[versions.value.length - 1]?.paper_list
  if (!list) return
  editTitle.value = listTitle(list)
  editSections.value = sectionTitles(list)
  titlesOpen.value = true
}
function startTitleEdit() {
  if (viewingLatest.value) openTitleEditor()
  else askContinueFromVersion(openTitleEditor)
}
async function saveTitles() {
  if (!editTitle.value.trim() || editSections.value.some((t) => !t.trim())) return
  savingTitles.value = true
  try {
    await store.editTitles(editTitle.value.trim(), editSections.value.map((t) => t.trim()))
    titlesOpen.value = false
    selectedVersionStepId.value = null
  } finally {
    savingTitles.value = false
  }
}

async function removeSession() {
  if (!session.value || !confirm('Delete this research session and all of its versions?')) return
  await store.remove(session.value.id)
  router.push('/research')
}

/** What the agent of an active round is doing, from its latest tool call (SSE `tool`). */
function activityLabel(stepId: number): string {
  const last = store.toolActivity.get(stepId)?.last
  if (!last || last.status !== 'started') return 'Agent is thinking…'
  return last.server === 'web' ? 'Searching the web…' : `Calling ${last.tool}…`
}

const STATUS_LABEL: Record<ResearchStepStatus, string> = {
  queued: 'Queued', awaiting_output: 'Thinking', streaming: 'Writing', done: 'Done', failed: 'Failed', cancelled: 'Cancelled',
}
</script>

<template>
  <div
    class="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 md:p-6"
    :style="narrow ? { paddingBottom: `calc(var(--bottom-bar-h, 56px) + ${mobileSection === 'instruct' ? dockedComposerHeight : 0}px + 16px)` } : undefined"
  >
    <!-- Next-round input (while a round runs, messages are queued and sent together when it ends):
         a card at the top of the left column on wide screens, docked above the bottom bar on narrow ones -->
    <DefineComposer v-slot="{ docked }">
      <div :class="docked ? 'space-y-2' : 'space-y-2 rounded-md border bg-card p-3'">
        <div v-if="queuedMessages.length" class="space-y-1.5" :class="docked ? 'max-h-32 overflow-y-auto' : ''">
          <p class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock class="size-3.5" />{{ activeStep ? 'Queued — sent together as one message when the current round finishes' : 'Queued — sent together with your next message when you press Send' }}
          </p>
          <div v-for="m in queuedMessages" :key="m.id" class="flex items-start gap-2 rounded border border-dashed bg-muted/40 px-2 py-1.5">
            <p class="min-w-0 flex-1 whitespace-pre-wrap text-sm">{{ m.text }}</p>
            <Button variant="ghost" size="icon-sm" title="Remove from queue" @click="store.removeQueued(m.id)"><X /></Button>
          </div>
        </div>
        <Textarea
          v-model="nextText" :rows="docked ? 2 : 3"
          :placeholder="activeStep ? 'Queue a message for when the current round finishes…' : 'Tell the agent how to refine the research…'"
          @keydown.meta.enter="submitRound()" @keydown.ctrl.enter="submitRound()"
        />
        <div class="flex items-center gap-2">
          <Select v-model="nextModel">
            <SelectTrigger class="h-8 min-w-0 flex-1"><SelectValue placeholder="Codex model" /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="m in store.codexModels" :key="m" :value="m">{{ m }}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            v-if="!activeStep" variant="outline" size="sm" :disabled="!nextText.trim() || !nextModel || submitting"
            title="Add to the queue without sending, to write a long instruction in parts" @click="submitRound(true)"
          >
            <ListPlus /><span :class="docked ? 'sr-only' : ''">Add to queue</span>
          </Button>
          <Button size="sm" :disabled="(activeStep ? !nextText.trim() || !nextModel : !canSend) || submitting" @click="submitRound()">
            <Loader2 v-if="submitting" class="animate-spin" /><ListPlus v-else-if="activeStep" /><Send v-else />{{ activeStep ? 'Queue' : 'Send' }}
          </Button>
        </div>
        <p v-if="!viewingLatest" class="text-xs text-muted-foreground">
          New rounds build on the current version ({{ versions.length }}). To build on version {{ selectedVersionNumber }}, use "Continue from this version" first.
        </p>
      </div>
    </DefineComposer>

    <!-- Header -->
    <div class="flex items-start gap-2">
      <Button variant="ghost" size="icon-sm" class="mt-0.5 shrink-0" title="Back to Research" @click="router.push('/research')">
        <ArrowLeft />
      </Button>
      <div class="min-w-0 flex-1">
        <h1 class="text-lg font-semibold leading-snug">{{ session?.title ?? 'Research' }}</h1>
        <p v-if="session" class="text-xs text-muted-foreground">
          {{ session.step_count }} steps · {{ session.version_count }} versions<template v-if="!canEdit"> · by {{ session.owner_name }} (read-only)</template>
        </p>
      </div>
      <Button v-if="session?.can_delete" variant="ghost" size="icon-sm" class="hover:text-destructive" title="Delete session" @click="removeSession">
        <Trash2 />
      </Button>
    </div>

    <div v-if="store.detailLoading && !session" class="flex justify-center py-16">
      <Loader2 class="h-5 w-5 animate-spin text-primary" />
    </div>

    <div v-else-if="session" class="grid grid-cols-1 gap-6 min-[900px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <!-- Version view (right column; Report / Papers sections on narrow screens) -->
      <section v-show="!narrow || mobileSection !== 'instruct'" class="order-1 min-w-0 min-[900px]:order-2">
        <div v-if="!selectedVersion" class="rounded-md border bg-card p-10 text-center text-sm text-muted-foreground">
          <template v-if="activeStep">The first version is being written…</template>
          <template v-else>No version yet.</template>
        </div>
        <template v-else>
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <Select
              :model-value="String(selectedVersion.id)"
              @update:model-value="(v) => (selectedVersionStepId = Number(v))"
            >
              <SelectTrigger class="h-8 w-auto min-w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="(v, i) in versions" :key="v.id" :value="String(v.id)">
                  Version {{ i + 1 }}{{ i === versions.length - 1 ? ' (current)' : '' }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Badge v-if="!viewingLatest" variant="outline">Viewing an earlier version</Badge>
            <div class="ml-auto flex gap-1">
              <Button v-if="canEdit && !viewingLatest" variant="outline" size="sm" :disabled="!!activeStep" @click="askContinueFromVersion()">
                <History />Continue from this version
              </Button>
              <Button v-if="canEdit" variant="outline" size="sm" :disabled="!!activeStep" @click="startTitleEdit">
                <Pencil />Edit titles
              </Button>
            </div>
          </div>
          <h2 class="mb-2 text-base font-semibold">{{ listTitle(selectedVersion.paper_list!) }}</h2>
          <Tabs v-model="versionTab">
            <TabsList v-if="!narrow">
              <TabsTrigger value="report">Report</TabsTrigger>
              <TabsTrigger value="papers">Papers</TabsTrigger>
            </TabsList>
            <TabsContent value="report" class="pt-2">
              <MarkdownContent :content="selectedVersion.report!" qa-answer disable-highlights class="text-sm" />
              <Collapsible v-if="reportCites.length" v-model:open="refsOpen" class="mt-3">
                <CollapsibleTrigger class="flex cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                  <ChevronRight class="size-3.5 transition-transform" :class="refsOpen ? 'rotate-90' : ''" />
                  References · {{ reportCites.length }}
                </CollapsibleTrigger>
                <CollapsibleContent class="pt-2">
                  <PaperRefList v-if="refsOpen" :items="reportCites" />
                </CollapsibleContent>
              </Collapsible>
            </TabsContent>
            <TabsContent value="papers" class="pt-2">
              <ResearchPaperList :list="selectedVersion.paper_list!" :previous="previousVersion?.paper_list ?? null" />
            </TabsContent>
          </Tabs>
        </template>
      </section>

      <!-- Timeline + next round (left column; Instruct section on narrow screens) -->
      <section v-show="!narrow || mobileSection === 'instruct'" class="order-2 flex min-w-0 flex-col gap-3 min-[900px]:order-1">
        <Composer v-if="canEdit && !narrow" />
        <div v-if="session.seed" class="rounded-md border bg-muted/40 p-3 text-xs" :class="narrow ? '' : 'order-last'">
          <div class="font-medium">Started from a Q&A answer</div>
          <RouterLink :to="`/papers/${session.seed.paper_id}`" class="mt-1 block text-muted-foreground hover:underline">{{ session.seed.paper_title }}</RouterLink>
          <div class="mt-1 line-clamp-3">Q: {{ session.seed.question }}</div>
        </div>

        <ol class="space-y-2">
          <li v-for="step in orderedSteps" :key="step.id">
            <!-- Owner title edit -->
            <div v-if="step.kind === 'title_edit'" class="flex items-start gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              <Pencil class="mt-0.5 size-3.5 shrink-0" />
              <span class="min-w-0 flex-1">Edited titles: {{ step.user_text }}</span>
              <button
                v-if="versionNumberOf(step)" type="button" class="shrink-0 hover:text-foreground"
                @click="selectedVersionStepId = step.id"
              >v{{ versionNumberOf(step) }}</button>
            </div>

            <!-- Agent round -->
            <div v-else class="rounded-md border bg-card px-3 py-2.5">
              <div class="flex items-center gap-2">
                <span class="text-xs font-medium text-muted-foreground">#{{ step.step_index }}</span>
                <Badge :variant="step.status === 'failed' ? 'destructive' : 'secondary'">
                  <Loader2 v-if="isActiveStep(step)" class="animate-spin" />{{ STATUS_LABEL[step.status] }}
                </Badge>
                <Badge v-if="step.model_name" variant="outline" class="max-w-40 truncate">{{ step.model_name }}</Badge>
                <Badge v-if="step.repaired" variant="outline" title="The paper list was fixed by an automatic repair request">Repaired</Badge>
                <span v-if="!isActiveStep(step) && roundDuration(step)" class="text-xs text-muted-foreground" title="Time from start to finish">{{ roundDuration(step) }}</span>
                <button
                  v-if="versionNumberOf(step)" type="button"
                  class="ml-auto text-xs text-primary hover:underline"
                  @click="selectedVersionStepId = step.id"
                >Version {{ versionNumberOf(step) }}</button>
              </div>
              <p class="mt-1.5 whitespace-pre-wrap text-sm">{{ step.user_text }}</p>
              <p v-if="step.changes_note" class="mt-1.5 text-xs text-muted-foreground">{{ step.changes_note }}</p>

              <!-- Live output while running: report streams, the list block is hidden -->
              <div v-if="isActiveStep(step)" class="mt-2 border-t pt-2">
                <div v-if="!step.answer" class="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 class="size-3.5 animate-spin" />{{ step.status === 'queued' ? 'Waiting for an available slot…' : activityLabel(step.id) }}
                  <span v-if="store.toolActivity.get(step.id)?.calls" class="text-muted-foreground/70">· {{ store.toolActivity.get(step.id)!.calls }} tool calls</span>
                </div>
                <template v-else>
                  <QAStreamingMarkdown :content="splitStreamingAnswer(step.answer).report" class="text-sm" />
                  <div v-if="store.repairingStepIds.has(step.id)" class="mt-2 flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    <Loader2 class="size-3.5 animate-spin" />Fixing paper list…
                  </div>
                  <div v-else-if="splitStreamingAnswer(step.answer).generatingList" class="mt-2 flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    <Loader2 class="size-3.5 animate-spin" />Generating paper list…
                  </div>
                </template>
              </div>

              <div v-if="step.error" class="mt-2 rounded-md bg-destructive/5 px-3 py-2 text-xs text-destructive">{{ step.error }}</div>
              <div v-else-if="step.status === 'done' && step.parse_error" class="mt-2 space-y-1">
                <div class="flex items-start gap-1.5 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  <TriangleAlert class="mt-0.5 size-3.5 shrink-0" />
                  <span>No new version from this round: {{ step.parse_error }}</span>
                </div>
                <Collapsible>
                  <CollapsibleTrigger class="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Show raw answer</CollapsibleTrigger>
                  <CollapsibleContent class="pt-1">
                    <pre class="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs">{{ step.answer }}</pre>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              <div v-if="canEdit && (isActiveStep(step) || step.id === latestStep?.id)" class="mt-2 flex justify-end gap-1">
                <Button v-if="isActiveStep(step)" variant="ghost" size="sm" @click="store.cancel(step.id)"><Square />Cancel</Button>
                <Button v-else variant="ghost" size="sm" @click="openRetry(step)"><RotateCcw />Retry</Button>
              </div>
            </div>
          </li>
        </ol>

      </section>
    </div>

    <!-- Narrow screens: the input docked above the bottom bar (Instruct section), and the bar itself -->
    <template v-if="narrow && session">
      <div
        v-if="canEdit" v-show="mobileSection === 'instruct'" ref="dockedComposer"
        class="fixed left-0 right-0 z-30 border-t bg-background/95 px-3 py-2 backdrop-blur md:left-[52px]"
        :style="{ bottom: 'var(--bottom-bar-h, 56px)' }"
        data-docked-composer
      >
        <Composer :docked="true" />
      </div>
      <MobileBottomBar v-model="mobileSection" :items="bottomBarItems" />
    </template>

    <!-- Retry -->
    <Dialog v-model:open="retryOpen">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>Retry this round</DialogTitle>
          <DialogDescription>The round's output is replaced by a new run.</DialogDescription>
        </DialogHeader>
        <Textarea v-model="retryText" rows="4" />
        <Select v-model="retryModel">
          <SelectTrigger class="w-full"><SelectValue placeholder="Codex model" /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="m in store.codexModels" :key="m" :value="m">{{ m }}</SelectItem>
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="ghost" @click="retryOpen = false">Cancel</Button>
          <Button :disabled="!retryText.trim()" @click="confirmRetry">Retry</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Continue from an earlier version: destructive confirmation -->
    <Dialog v-model:open="truncateOpen">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Continue from version {{ selectedVersionNumber }}?</DialogTitle>
          <DialogDescription>
            This permanently deletes
            <template v-if="laterVersionCount > 0">
              version{{ laterVersionCount > 1 ? 's' : '' }} {{ selectedVersionNumber + 1 }}<template v-if="laterVersionCount > 1">–{{ versions.length }}</template>
              and
            </template>
            {{ stepsToDelete.length }} later step{{ stepsToDelete.length === 1 ? '' : 's' }}. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" @click="truncateOpen = false">Cancel</Button>
          <Button variant="destructive" @click="confirmTruncate">Delete later versions and continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Title editor -->
    <Dialog v-model:open="titlesOpen">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit titles</DialogTitle>
          <DialogDescription>Saving creates a new version; papers, comments, and the report are kept unchanged.</DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <div class="space-y-1.5">
            <Label>List title</Label>
            <Input v-model="editTitle" />
          </div>
          <div v-for="(_, i) in editSections" :key="i" class="space-y-1.5">
            <Label>Section {{ i + 1 }}</Label>
            <Input v-model="editSections[i]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" @click="titlesOpen = false">Cancel</Button>
          <Button :disabled="savingTitles || !editTitle.trim() || editSections.some((t) => !t.trim())" @click="saveTitles">Save as new version</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
