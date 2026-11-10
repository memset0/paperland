<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronRight, Library, PanelLeft, ArrowLeft, BookOpen, Copy, GitBranch, History, KeyRound, Loader2, Pencil, Plus, RefreshCw, Share2, Telescope, Trash2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import type { TopicCredential, TopicDefaultAccess, TopicDetail, TopicMember } from '@paperland/shared'
import { topicsApi, type TopicHistory } from '@/api/topics'
import { useAuthStore } from '@/stores/auth'
import { usePageTitle } from '@/composables/usePageTitle'
import { readTopicSurface, saveTopicSurface, surfaceAdditions, topicSurfaceKey, TopicReadingGate, type TopicSurfaceSeen } from '@/lib/topic-reading'
import { useMediaQuery } from '@vueuse/core'
import MarkdownContent from '@/components/MarkdownContent.vue'
import AppVersion from '@/components/AppVersion.vue'
import TopicAccessSelect from '@/components/TopicAccessSelect.vue'
import TopicFileNav from '@/components/TopicFileNav.vue'
import TopicReferenceList from '@/components/TopicReferenceList.vue'
import TopicCitationCard from '@/components/TopicCitationCard.vue'
import { documentUrl, resolveTopicDocument } from '@/lib/topic-navigation'
import { topicIcon } from '@/lib/topic-icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const route = useRoute(), router = useRouter(), auth = useAuthStore()
const id = computed(() => Number(route.params.id)), selectedCommit = computed(() => typeof route.query.version === 'string' ? route.query.version : '')
const detail = ref<TopicDetail | null>(null), loading = ref(false), error = ref(''), page = ref<HTMLElement | null>(null)
const historyOpen = ref(false), history = ref<TopicHistory>({ versions: [], total: 0, next_offset: null }), historyBusy = ref(false)
const shareOpen = ref(false), accessDraft = ref<TopicDefaultAccess>('none')
const connectOpen = ref(false), members = ref<TopicMember[]>([]), tokens = ref<TopicCredential[]>([]), newSecret = ref(''), busy = ref('')
const username = ref(''), shareRole = ref<'viewer' | 'editor' | 'none'>('viewer'), imported = ref(new Set<string>())
const editingName = ref(false), nameDraft = ref(''), nameBase = ref(''), nameBusy = ref(false), nameError = ref('')
const gate = new TopicReadingGate()
const wide = useMediaQuery('(min-width: 1024px)'), filesOpen = ref(false), referencesOpen = ref(false), allReferencesOpen = ref(false)
const homePage = computed(() => detail.value?.home_page || (detail.value?.snapshot.topic.format_version === 2 ? 'pages/report.md' : 'report.md'))
const requestedFile = computed(() => typeof route.query.file === 'string' ? route.query.file : Array.isArray(route.params.document_path) ? route.params.document_path.join('/') : typeof route.params.document_path === 'string' ? route.params.document_path : '')
const currentDocument = computed(() => detail.value ? resolveTopicDocument(detail.value.documents, requestedFile.value, homePage.value) : undefined)
const selectedFile = computed(() => currentDocument.value?.path ?? (requestedFile.value || homePage.value))
const readerCovered = computed(() => allReferencesOpen.value || filesOpen.value || historyOpen.value || shareOpen.value || connectOpen.value)
const allReferences = computed(() => [...(detail.value?.snapshot.list.papers ?? [])].sort((a, b) => (detail.value!.reference_numbers[a.id] ?? 0) - (detail.value!.reference_numbers[b.id] ?? 0)))
const pageReferences = computed(() => { const set = new Set(currentDocument.value?.references ?? []); return allReferences.value.filter((p) => set.has(detail.value!.reference_numbers[p.id])) })
const legacyNotesOpen = ref(false), countsOpen = ref(false)
const citationCard = ref<InstanceType<typeof TopicCitationCard> | null>(null), importErrors = ref<Record<string, string>>({})
let renderGeneration = 0
let alive = true, animations: Animation[] = []
const scope = () => `${auth.user?.id ?? 0}:${id.value}`
const currentScope = (key: string) => alive && key === scope()
const own = computed(() => detail.value?.permission === 'owner')
const title = computed(() => detail.value?.snapshot.topic.title || 'Topic')
const gitUrl = computed(() => detail.value ? new URL(detail.value.git_url, location.origin).href : '')
const mcpUrl = computed(() => detail.value ? new URL(detail.value.mcp_url, location.origin).href : '')
const calls = computed(() => Object.values(detail.value?.my_mcp_call_counts ?? {}).reduce((n, count) => n + count, 0))
usePageTitle(computed(() => currentDocument.value && currentDocument.value.path !== homePage.value ? `${currentDocument.value.title} · ${title.value}` : title.value))
function openAllReferences() { referencesOpen.value = false; filesOpen.value = false; allReferencesOpen.value = true; citationCard.value?.close() }
async function selectFile(path: string) {
  filesOpen.value = false
  if (path === 'papers.json' || path === 'references.json') { openAllReferences(); return }
  allReferencesOpen.value = false; referencesOpen.value = false
  if (!detail.value) return
  const doc = resolveTopicDocument(detail.value.documents, path, homePage.value)
  if (!doc) return
  const query = { ...route.query }; delete query.file
  await router.replace({ path: documentUrl(id.value, doc, homePage.value), query })
}
async function normalizeDocumentRoute() {
  if (!detail.value) return
  const query = { ...route.query }; delete query.file
  let doc = currentDocument.value
  if (requestedFile.value === 'papers.json' || requestedFile.value === 'references.json') { openAllReferences(); doc = detail.value.documents.find((d) => d.path === homePage.value) }
  if (!doc) return
  const path = documentUrl(id.value, doc, homePage.value)
  if (path !== route.path || route.query.file !== undefined) await router.replace({ path, query })
}
function decorateCitations() {
  for (const link of page.value?.querySelectorAll<HTMLAnchorElement>('.topic-document a[href^="#ref:"]') ?? []) {
    const number = Number(link.getAttribute('href')?.match(/^#ref:(\d+)$/)?.[1])
    const entry = detail.value?.snapshot.list.papers.find((p) => detail.value?.reference_numbers[p.id] === number)
    if (!entry) continue
    link.removeAttribute('title'); link.setAttribute('aria-label', `Reference ${number}: ${entry.title}`); link.setAttribute('aria-haspopup', 'dialog'); if (!link.hasAttribute('aria-expanded')) link.setAttribute('aria-expanded', 'false')
    if (/^\[?\d+\]?$/.test(link.textContent?.trim() || '')) { link.textContent = `[${number}]`; link.classList.add('topic-citation') }
  }
}
async function displayReading() {
  const generation = ++renderGeneration, key = scope(), result = detail.value, file = selectedFile.value, version = selectedCommit.value
  if (!result || !auth.user) return
  const uid = auth.user.id
  await nextTick()
  requestAnimationFrame(() => {
    if (generation !== renderGeneration || !currentScope(key) || detail.value?.commit !== result.commit || selectedFile.value !== file || selectedCommit.value !== version) return
    animations.forEach((a) => a.cancel()); animations = []
    decorateCitations()
    const surfaces: Array<{ key: string; selector: string; value: TopicSurfaceSeen; aliases?: string[] }> = []
    const previousPaths = file === homePage.value && file !== 'report.md' ? ['report.md'] : file === 'pages/research-questions/index.md' ? ['pages/questions.md'] : file.startsWith('pages/') && detail.value?.documents.filter((d) => d.path.split('/').at(-1) === file.split('/').at(-1)).length === 1 ? [`pages/${file.split('/').at(-1)}`].filter((p) => p !== file) : []
    if (currentDocument.value?.exists && !readerCovered.value) surfaces.push({ key: topicSurfaceKey(uid, result.id, file, 'document'), aliases: previousPaths.map((p) => topicSurfaceKey(uid, result.id, p, 'document')), selector: '[data-reading-surface="document"]', value: { schema_version: 2, commit: result.commit, body: currentDocument.value.body, entries: [] } })
    if (currentDocument.value && referencesOpen.value && !readerCovered.value) surfaces.push({ key: topicSurfaceKey(uid, result.id, file, 'references'), aliases: previousPaths.map((p) => topicSurfaceKey(uid, result.id, p, 'references')), selector: '[data-reading-surface="references"]', value: { schema_version: 2, commit: result.commit, body: '', entries: pageReferences.value } })
    if (allReferencesOpen.value) surfaces.push({ key: topicSurfaceKey(uid, result.id, 'references.json', 'catalog'), aliases: [topicSurfaceKey(uid, result.id, 'papers.json', 'catalog')], selector: '[data-reading-surface="catalog"]', value: { schema_version: 2, commit: result.commit, body: '', entries: allReferences.value } })
    const targets: HTMLElement[] = []
    for (const surface of surfaces) {
      const container = document.querySelector<HTMLElement>(surface.selector)
      if (!container || !container.getClientRects().length) continue
      let previous = null
      try { previous = readTopicSurface(localStorage, surface.key); for (const alias of surface.aliases ?? []) if (!previous) previous = readTopicSurface(localStorage, alias) } catch {}
      const additions = version ? { report: [], papers: [], directories: [] } : surfaceAdditions(previous, surface.value)
      const report = container.querySelector('.topic-document .markdown-content > div:first-child')
      for (const index of additions.report) { const element = report?.children[index]; if (element instanceof HTMLElement) targets.push(element) }
      for (const element of container.querySelectorAll<HTMLElement>('[data-topic-entry]')) if (additions.papers.includes(element.dataset.topicEntry!)) targets.push(element)
      if (!version) { try { saveTopicSurface(localStorage, surface.key, surface.value) } catch {} }
    }
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const start = document.timeline.currentTime
      for (const element of targets) {
        const animation = element.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 550, easing: 'cubic-bezier(0.2,0.8,0.2,1)' })
        if (start != null) animation.startTime = start
        animations.push(animation)
      }
    }
  })
}
async function locateReference(number: number) {
  citationCard.value?.close()
  if (!allReferencesOpen.value && pageReferences.value.some((p) => detail.value?.reference_numbers[p.id] === number)) referencesOpen.value = true
  else openAllReferences()
  await nextTick()
  requestAnimationFrame(() => {
    const selector = allReferencesOpen.value ? '[data-reading-surface="catalog"]' : '[data-reading-surface="references"]'
    const element = [...document.querySelectorAll<HTMLElement>(`${selector} [data-reference-number]`)].find((e) => Number(e.dataset.referenceNumber) === number)
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' }); element?.focus({ preventScroll: true })
  })
}

function onDocumentLink(event: MouseEvent) {
  const link = (event.target as Element).closest<HTMLAnchorElement>('a[href]')
  if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return
  const href = link.getAttribute('href') || ''
  const citation = href.match(/^#ref:(\d+)$/)
  if (citation) {
    const number = Number(citation[1])
    if (!Object.values(detail.value?.reference_numbers ?? {}).includes(number)) return
    event.preventDefault(); event.stopPropagation()
    if (!citationCard.value?.open(link, true)) void locateReference(number)
    return
  }
  if (!href || href.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('/')) return
  let path = ''
  try { path = decodeURIComponent(new URL(href, `https://topic.invalid/${selectedFile.value}`).pathname.slice(1)) } catch { return }
  if (!detail.value) return
  const target = resolveTopicDocument(detail.value.documents, href.split('#')[0], homePage.value) ?? resolveTopicDocument(detail.value.documents, path, homePage.value)
  if (!target) return
  event.preventDefault(); event.stopPropagation(); void selectFile(target.path)
}

async function load(background = false) {
  if (!auth.user || !Number.isSafeInteger(id.value) || id.value < 1) return
  const key = scope(), uid = auth.user.id, tid = id.value, version = selectedCommit.value
  const ticket = gate.begin(`${uid}:${tid}`)
  if (!background) { loading.value = true; error.value = '' }
  try {
    const result = (await topicsApi.get(tid, version || undefined)).data
    if (!currentScope(key) || !gate.valid(ticket)) return
    detail.value = result; loading.value = false; error.value = ''
    await normalizeDocumentRoute(); await displayReading()
  } catch (e) {
    if (!currentScope(key) || !gate.valid(ticket)) return
    error.value = (e as Error).message
    if (error.value.includes('not found')) detail.value = null
  } finally { if (currentScope(key) && gate.valid(ticket)) loading.value = false }
}

function editName() {
  if (!detail.value || selectedCommit.value || detail.value.permission === 'viewer') return
  nameDraft.value = detail.value.snapshot.topic.title; nameBase.value = detail.value.commit; nameError.value = ''; editingName.value = true
}
async function saveName() {
  if (!nameDraft.value.trim() || nameBusy.value) return
  const key = scope(); nameBusy.value = true; nameError.value = ''
  try {
    const result = await topicsApi.rename(id.value, nameDraft.value.trim(), nameBase.value)
    if (!currentScope(key)) return
    if (selectedCommit.value) return
    detail.value = result.data; editingName.value = false; toast.success('Topic name updated'); await load(true)
  } catch (e) { if (currentScope(key)) nameError.value = (e as Error).message }
  finally { if (currentScope(key)) nameBusy.value = false }
}
async function refreshNameBase() {
  const key = scope(); await load()
  if (currentScope(key) && detail.value && !error.value) { nameBase.value = detail.value.commit; nameError.value = '' }
}

async function loadHistory(more = false) {
  const key = scope(), tid = id.value, offset = more ? history.value.next_offset : 0
  if (offset == null || historyBusy.value) return
  historyBusy.value = true
  try {
    const result = (await topicsApi.history(tid, offset)).data
    if (currentScope(key)) history.value = { ...result, versions: more ? [...history.value.versions, ...result.versions] : result.versions }
  } catch {} finally { if (currentScope(key)) historyBusy.value = false }
}
async function viewVersion(commit?: string) {
  const query = { ...route.query }
  if (commit) query.version = commit; else delete query.version
  await router.replace({ query }); historyOpen.value = false
}
async function loadConnection() {
  const key = scope(), tid = id.value
  try {
    const result = await topicsApi.tokens(tid)
    if (currentScope(key)) tokens.value = result.data
  } catch {}
}
async function loadSharing() {
  const key = scope()
  accessDraft.value = detail.value?.default_access ?? 'none'
  try { const result = await topicsApi.members(id.value); if (currentScope(key)) members.value = result.data } catch {}
}
async function saveAccess() {
  if (!own.value || busy.value) return
  const key = scope(); busy.value = 'share'
  try {
    const result = await topicsApi.setSharing(id.value, accessDraft.value)
    if (currentScope(key) && detail.value) { detail.value.default_access = result.data.default_access; await loadSharing(); toast.success('Sharing updated') }
  } catch {} finally { if (currentScope(key)) busy.value = '' }
}
async function changeMember(name: string, role: 'viewer' | 'editor' | 'none' | null) {
  if (busy.value) return
  if ((role === null || role === 'none') && !confirm(`Remove individual access to "${title.value}"? They will keep any access granted by the general setting.`)) return
  const key = scope(); busy.value = 'share'
  try { const result = await topicsApi.share(id.value, name, role === 'none' ? null : role); if (currentScope(key)) { members.value = result.data; username.value = '' } }
  catch {} finally { if (currentScope(key)) busy.value = '' }
}
async function issue(rotateId?: number) {
  if (busy.value) return
  if (rotateId != null && !confirm('Rotate this topic token? Its current value will stop working for MCP and Git.')) return
  const key = scope(); busy.value = 'token'; newSecret.value = ''
  try {
    const result = rotateId == null ? await topicsApi.issue(id.value) : await topicsApi.rotate(id.value, rotateId)
    if (!currentScope(key)) return
    newSecret.value = result.data.token
    await loadConnection()
  } catch {} finally { if (currentScope(key)) busy.value = '' }
}
async function revoke(tokenId: number) {
  if (busy.value || !confirm('Revoke this topic token? Clients using it will lose access to MCP and Git.')) return
  const key = scope(); busy.value = 'token'
  try { await topicsApi.revoke(id.value, tokenId); if (currentScope(key)) { newSecret.value = ''; await loadConnection() } }
  catch {} finally { if (currentScope(key)) busy.value = '' }
}
async function importPaper(entryId: string) {
  if (busy.value) return
  const key = scope(), commit = detail.value?.commit, version = selectedCommit.value; busy.value = `import:${entryId}`; delete importErrors.value[entryId]
  try {
    const result = await topicsApi.import(id.value, entryId, selectedCommit.value || undefined)
    if (!currentScope(key) || !detail.value) return
    if (detail.value.commit !== commit || selectedCommit.value !== version) { await load(true); return }
    detail.value.paper_bindings[entryId] = result.data.paper_id
    detail.value.paper_in_library[entryId] = true
    imported.value = new Set([...imported.value, entryId])
    toast.success('Paper added to your list')
  } catch (e) { if (currentScope(key)) importErrors.value[entryId] = (e as Error).message } finally { if (currentScope(key)) busy.value = '' }
}
async function copy(value: string) {
  try { await navigator.clipboard.writeText(value); toast.success('Copied to clipboard') } catch { toast.error('Copy failed. Select and copy the value manually.') }
}
function filterPapers(node = 'root') { void router.push({ path: '/papers', query: { scope: 'all', topic_id: String(id.value), topic_node_id: node } }) }
watch([() => auth.user?.id, () => id.value], () => {
  gate.invalidate(); renderGeneration++; filesOpen.value = false; referencesOpen.value = false; allReferencesOpen.value = false; detail.value = null; newSecret.value = ''; tokens.value = []; members.value = []; busy.value = ''; imported.value = new Set(); importErrors.value = {}; history.value = { versions: [], total: 0, next_offset: null }; connectOpen.value = false; shareOpen.value = false; historyOpen.value = false
  editingName.value = false; nameBusy.value = false; nameError.value = ''
  void load()
}, { immediate: true })
watch(selectedCommit, () => { editingName.value = false; gate.invalidate(); renderGeneration++; void load() })
watch([selectedFile, selectedCommit], () => { referencesOpen.value = false; citationCard.value?.close() })
watch([requestedFile, referencesOpen, allReferencesOpen, filesOpen, historyOpen, shareOpen, connectOpen, wide], () => { void normalizeDocumentRoute().then(displayReading) })
watch(wide, (desktop) => { if (desktop) filesOpen.value = false })
watch(historyOpen, (open) => { if (open) void loadHistory() })
watch(shareOpen, (open) => { if (open) void loadSharing() })
watch(connectOpen, (open) => { newSecret.value = ''; if (open) void loadConnection() })
const poll = setInterval(() => { if (alive && !document.hidden && !selectedCommit.value && !loading.value && !busy.value && !editingName.value) void load(true) }, 15000)
onBeforeUnmount(() => { alive = false; gate.invalidate(); renderGeneration++; clearInterval(poll); animations.forEach((a) => a.cancel()) })
</script>

<template>
  <div ref="page" class="h-full overflow-auto bg-muted/30">
    <div class="mx-auto w-full max-w-[1440px] p-4 sm:p-6">
      <header class="mb-7 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" class="-ml-2 text-muted-foreground" @click="router.push('/research')"><ArrowLeft />Topics</Button>
          <div class="flex flex-wrap gap-2">
            <Button variant="ghost" size="icon" title="Refresh topic" :disabled="loading" @click="load()"><RefreshCw :class="loading ? 'animate-spin' : ''" /></Button>
            <Button variant="outline" size="sm" :disabled="!detail" @click="openAllReferences"><Library />All references</Button>
            <Button variant="outline" size="sm" :disabled="!detail" @click="historyOpen = true"><History />History</Button>
            <Button variant="outline" size="sm" :disabled="!detail" @click="shareOpen = true"><Share2 />Share</Button>
            <Button variant="outline" size="sm" :disabled="!detail" @click="connectOpen = true"><KeyRound />Connect</Button>
          </div>
        </div>
        <template v-if="detail">
          <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Telescope class="size-3.5 text-primary" /><span>Topic</span><span>·</span><span>{{ detail.owner_display_name }}</span><Badge variant="secondary" class="capitalize">{{ detail.permission }}</Badge></div>
          <div v-if="!editingName" class="flex min-w-0 items-start gap-2"><h1 class="min-w-0 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{{ title }}</h1><Button v-if="detail.permission !== 'viewer' && !selectedCommit" variant="ghost" size="icon-sm" title="Edit name" aria-label="Edit topic name" class="mt-0.5 shrink-0" @click="editName"><Pencil /></Button></div>
          <form v-else class="space-y-2" @submit.prevent="saveName"><div class="flex flex-wrap gap-2"><Input v-model="nameDraft" aria-label="Topic name" maxlength="500" class="min-w-0 flex-1 basis-40" autofocus /><Button :disabled="!nameDraft.trim() || nameBusy" type="submit">{{ nameBusy ? 'Saving…' : 'Save name' }}</Button><Button type="button" variant="outline" :disabled="nameBusy" @click="editingName = false">Cancel</Button></div><div v-if="nameError" role="alert" class="text-sm text-destructive">{{ nameError }} <Button type="button" variant="link" size="xs" @click="refreshNameBase">Refresh latest</Button></div></form>
          <p v-if="detail.snapshot.topic.description" class="max-w-3xl text-sm leading-relaxed text-muted-foreground">{{ detail.snapshot.topic.description }}</p>
          <RouterLink v-if="detail.legacy_research_session_id" :to="`/research/${detail.legacy_research_session_id}`" class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><History class="size-3" />Original research</RouterLink>
          <div class="flex flex-wrap items-center gap-3 text-xs text-muted-foreground"><span class="inline-flex items-center gap-1.5"><GitBranch class="size-3.5" />{{ detail.commit.slice(0, 8) }}</span><button class="hover:text-primary" title="Open all references" @click="openAllReferences">{{ detail.snapshot.list.papers.length }} references</button><Button variant="link" size="xs" class="h-auto p-0" @click="filterPapers()">{{ selectedCommit ? 'Browse current papers' : 'Browse linked papers' }}</Button></div>
          <div v-if="selectedCommit" class="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/50 px-4 py-3 text-sm"><span>You are reading a historical version. Paper search uses the latest version.</span><Button size="sm" variant="outline" @click="viewVersion()">Return to latest</Button></div>
        </template>
      </header>
      <div v-if="loading && !detail" class="flex justify-center py-24"><Loader2 class="size-5 animate-spin text-primary" /><span class="sr-only">Loading topic…</span></div>
      <div v-if="error" class="mb-6 rounded-lg border p-4 text-sm"><p>{{ error }}</p><Button variant="outline" size="sm" class="mt-3" @click="load()">Try again</Button></div>
      <template v-if="detail">
        <div class="mb-4 flex gap-2 lg:hidden">
          <Button variant="outline" size="sm" @click="filesOpen = true"><PanelLeft />Pages</Button>

        </div>
        <div class="grid min-w-0 items-start justify-center gap-5 lg:grid-cols-[240px_minmax(0,680px)] xl:grid-cols-[280px_minmax(0,680px)] 2xl:grid-cols-[300px_minmax(0,680px)]">
          <aside v-if="wide" class="sticky top-4 max-h-[calc(100dvh-3rem)] min-w-0 overflow-y-auto" aria-label="Topic files"><TopicFileNav :documents="detail.documents" :selected="selectedFile" :home="homePage" @select="selectFile" /></aside>
          <main data-reading-surface="document" class="min-w-0 rounded-xl border bg-card p-5 shadow-sm sm:p-8" @click.capture="onDocumentLink">
            <template v-if="currentDocument">
              <div class="mb-6 flex min-w-0 items-center gap-2 border-b pb-4 text-xs text-muted-foreground"><component :is="topicIcon(currentDocument.fonticon || (currentDocument.path === homePage ? 'BookOpen' : 'FileText'))" class="size-4 shrink-0 text-primary" /><span :title="currentDocument.path" class="min-w-0 truncate font-medium">{{ currentDocument.title }}</span><span class="ml-auto shrink-0">{{ currentDocument.references.length }} {{ currentDocument.references.length === 1 ? 'reference' : 'references' }}</span></div>
              <section class="topic-document min-w-0">
                <MarkdownContent v-if="currentDocument.body.trim()" :key="currentDocument.path" :content="currentDocument.body" disable-highlights qa-answer />
                <div v-else class="py-12 text-center"><BookOpen class="mx-auto mb-4 size-8 text-muted-foreground" /><h2 class="text-base font-medium">{{ (currentDocument.path.endsWith('questions.md') || currentDocument.path === 'pages/research-questions/index.md') ? 'Research questions' : 'The report is ready to begin' }}</h2><p class="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{{ (currentDocument.path.endsWith('questions.md') || currentDocument.path === 'pages/research-questions/index.md') ? 'Keep the questions you want to investigate together, with links to each research page.' : detail.permission === 'viewer' ? 'The report will appear here when a collaborator adds it.' : 'Connect your agent to research this topic and push its first report.' }}</p><Button v-if="detail.permission !== 'viewer'" variant="outline" class="mt-5" @click="connectOpen = true"><KeyRound />Connect your agent</Button></div>
              </section>
              <Collapsible v-model:open="referencesOpen" class="mt-8 border-t pt-4">
                <CollapsibleTrigger class="flex w-full items-center gap-2 rounded-md py-2 text-left text-sm font-medium text-muted-foreground hover:text-foreground"><ChevronRight :class="['size-4 transition-transform', referencesOpen ? 'rotate-90' : '']" />Page references<span class="ml-auto text-xs tabular-nums">{{ pageReferences.length }}</span></CollapsibleTrigger>
                <CollapsibleContent><div data-reading-surface="references" class="pt-3"><TopicReferenceList :detail="detail" :entries="pageReferences" :busy="busy" :imported="imported" compact @import="importPaper" /><p v-if="!pageReferences.length" class="py-4 text-sm text-muted-foreground">No references assigned to this page yet.</p><Button variant="link" size="sm" class="mt-3" @click="openAllReferences">View all references</Button></div></CollapsibleContent>
              </Collapsible>
            </template>
            <div v-else class="py-12 text-center"><h2 class="font-medium">Page unavailable in this version</h2><Button variant="outline" class="mt-4" @click="selectFile(homePage)">Open report</Button></div>
          </main>

        </div>
      </template>
      <AppVersion class="mt-12" />
    </div>
    <Sheet v-model:open="filesOpen">
      <SheetContent side="left" class="w-full overflow-y-auto sm:max-w-sm"><SheetHeader><SheetTitle>Topic pages</SheetTitle><SheetDescription>Choose a document from the page tree.</SheetDescription></SheetHeader><TopicFileNav v-if="detail" class="p-4" :documents="detail.documents" :selected="selectedFile" :home="homePage" @select="selectFile" /></SheetContent>
    </Sheet>
    <TopicCitationCard v-if="detail" ref="citationCard" :detail="detail" :host="page" :document-key="`${scope()}:${selectedFile}:${selectedCommit}:${detail.commit}`" :disabled="readerCovered" :busy="busy" :imported="imported" :errors="importErrors" @import="importPaper" @locate="locateReference" />
    <Sheet v-model:open="allReferencesOpen">
      <SheetContent class="w-full overflow-y-auto sm:max-w-xl" @click.capture="onDocumentLink">
        <SheetHeader><SheetTitle>All references <span class="ml-2 text-sm font-normal text-muted-foreground">{{ allReferences.length }}</span></SheetTitle><SheetDescription>One shared catalog, numbered by when each work joined this topic.</SheetDescription></SheetHeader>
        <div v-if="detail" data-reading-surface="catalog" class="p-4 sm:p-6">
          <TopicReferenceList :detail="detail" :entries="allReferences" :busy="busy" :imported="imported" compact @import="importPaper" />
          <p v-if="!allReferences.length" class="py-12 text-center text-sm text-muted-foreground">References will appear here as this topic grows.</p>
          <Collapsible v-if="detail.snapshot.list.directories.some((d) => d.description)" v-model:open="legacyNotesOpen" class="mt-6 border-t pt-4"><CollapsibleTrigger class="text-sm font-medium">Previous directory notes</CollapsibleTrigger><CollapsibleContent><section v-for="directory in detail.snapshot.list.directories.filter((d) => d.description)" :key="directory.id" class="mt-4"><h3 class="mb-2 text-sm font-medium">{{ directory.name }}</h3><MarkdownContent :content="directory.description!" disable-highlights qa-answer /></section></CollapsibleContent></Collapsible>
        </div>
      </SheetContent>
    </Sheet>
    <Sheet v-model:open="historyOpen">
      <SheetContent class="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader><SheetTitle>Version history</SheetTitle><SheetDescription>Read earlier reports and paper lists. Git authors and actual pushers are recorded separately.</SheetDescription></SheetHeader>
        <div class="space-y-3 p-4 sm:p-6">
          <Button variant="outline" class="w-full" @click="viewVersion()">Latest version</Button>
          <button v-for="version in history.versions" :key="version.commit" class="w-full rounded-lg border p-4 text-left hover:bg-muted/50" @click="viewVersion(version.commit)">
            <p class="line-clamp-2 text-sm font-medium">{{ version.message || 'Update topic' }}</p>
            <p class="mt-2 text-xs text-muted-foreground">{{ version.commit.slice(0, 8) }} · {{ new Date(version.pushed_at).toLocaleString() }}</p>
            <p class="mt-1 text-xs text-muted-foreground">Pushed by {{ version.pushed_by_display_name }}</p>
            <p class="mt-1 text-xs text-muted-foreground" :title="version.author_email">Git author: {{ version.author_name }}</p>
          </button>
          <Button v-if="history.next_offset !== null" variant="outline" class="w-full" :disabled="historyBusy" @click="loadHistory(true)">{{ historyBusy ? 'Loading…' : 'Load older versions' }}</Button>
          <Loader2 v-if="historyBusy" class="mx-auto size-5 animate-spin" />
        </div>
      </SheetContent>
    </Sheet>
    <Sheet v-model:open="shareOpen">
      <SheetContent class="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader><SheetTitle>Share topic</SheetTitle><SheetDescription>Set access for this topic. Each person gets the higher of their individual and general permissions.</SheetDescription></SheetHeader>
        <div v-if="detail" class="space-y-7 p-4 sm:p-6">
          <section class="space-y-4">
            <TopicAccessSelect v-model="accessDraft" :disabled="!own || !!busy" />
            <Button v-if="own" size="sm" :disabled="!!busy || accessDraft === detail.default_access" @click="saveAccess">{{ busy === 'share' ? 'Saving…' : 'Save access' }}</Button>
            <p v-else class="text-xs text-muted-foreground">Only the owner can change sharing permissions.</p>
          </section>
          <section class="space-y-3">
            <h3 class="text-sm font-semibold">Members</h3>
            <div v-for="member in members" :key="member.user_id" class="flex min-w-0 items-center gap-3 text-sm"><span class="min-w-0 flex-1 truncate">{{ member.display_name }}</span><select v-if="own && member.role !== 'owner'" class="h-8 rounded-md border bg-background px-2 text-xs" :value="member.role" :aria-label="`Permission for ${member.display_name}`" :disabled="!!busy" @change="changeMember(member.username, ($event.target as HTMLSelectElement).value as 'viewer' | 'editor' | 'none')"><option value="viewer">Viewer</option><option value="editor">Editor</option><option value="none">Use general access</option></select><Badge v-else variant="secondary" class="capitalize">{{ member.role }}</Badge><span v-if="member.effective_role !== member.role" class="text-xs text-muted-foreground">Effective: {{ member.effective_role }}</span><Button v-if="own && member.role !== 'owner'" variant="ghost" size="icon-xs" :disabled="!!busy" :title="`Remove ${member.display_name}`" @click="changeMember(member.username, null)"><Trash2 /></Button></div>
            <form v-if="own" class="flex flex-wrap gap-2 pt-2" @submit.prevent="changeMember(username, shareRole)"><Input v-model="username" aria-label="Collaborator username" placeholder="Username" class="min-w-0 flex-1 basis-36" /><select v-model="shareRole" aria-label="New member permission" class="h-9 rounded-md border bg-background px-2 text-sm"><option value="viewer">Viewer</option><option value="editor">Editor</option><option value="none">Use general access</option></select><Button variant="outline" :disabled="!username.trim() || !!busy"><Plus />Save permission</Button></form>
          </section>
        </div>
      </SheetContent>
    </Sheet>
    <Sheet v-model:open="connectOpen">
      <SheetContent class="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader><SheetTitle>Connect</SheetTitle><SheetDescription>Connect your own agent using your own topic token.</SheetDescription></SheetHeader>
        <div v-if="detail" class="space-y-7 p-4 sm:p-6">
          <section class="space-y-3 border-t pt-5">
            <div class="flex items-center justify-between gap-3"><h3 class="text-sm font-semibold">Your topic tokens</h3><Button size="sm" variant="outline" :disabled="!!busy" @click="issue()"><Plus />New token</Button></div>
            <p class="text-xs leading-relaxed text-muted-foreground">Use the same token for MCP and Git. It identifies you and this topic, and follows your current permission.</p>
            <div v-if="newSecret" class="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3"><Label>Copy your new token now</Label><p class="text-xs text-muted-foreground">Its value will not be shown again.</p><Textarea :model-value="newSecret" readonly aria-label="New topic token" class="font-mono text-xs" /><Button size="sm" variant="outline" @click="copy(newSecret)"><Copy />Copy token</Button></div>
            <p v-if="!tokens.length" class="text-xs text-muted-foreground">You have no topic tokens yet.</p>
            <div v-for="token in tokens" :key="token.id" class="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-xs"><span class="flex-1">Token {{ token.id }}<span class="ml-2 text-muted-foreground">{{ token.revoked_at ? 'Revoked' : `Created ${new Date(token.created_at).toLocaleDateString()}` }}</span></span><template v-if="!token.revoked_at"><Button variant="ghost" size="xs" :disabled="!!busy" @click="issue(token.id)">Rotate</Button><Button variant="ghost" size="xs" :disabled="!!busy" @click="revoke(token.id)">Revoke</Button></template></div>
          </section>
          <section class="space-y-3 border-t pt-5">
            <h3 class="text-sm font-semibold">Connect your agent</h3>
            <div class="space-y-1"><Label>MCP URL</Label><div class="flex gap-2"><Input :model-value="mcpUrl" readonly aria-label="MCP URL" class="min-w-0 font-mono text-xs" /><Button variant="outline" size="icon" title="Copy MCP URL" @click="copy(mcpUrl)"><Copy /></Button></div></div>
            <p class="text-xs text-muted-foreground">Use your topic token as the Bearer token in your MCP client.</p>
            <div class="space-y-1"><Label>Git URL</Label><div class="flex gap-2"><Input :model-value="gitUrl" readonly aria-label="Git URL" class="min-w-0 font-mono text-xs" /><Button variant="outline" size="icon" title="Copy Git URL" @click="copy(gitUrl)"><Copy /></Button></div></div>
            <pre class="overflow-x-auto rounded-md bg-muted p-3 text-xs"><code>git clone {{ gitUrl }}</code></pre>
            <p class="text-xs leading-relaxed text-muted-foreground">Enter your topic token as the HTTPS password. Pull before editing, keep stable directory and entry IDs, and push your report and paper list together. Successful pushes appear automatically.</p>
            <p v-if="detail.permission === 'viewer'" class="text-xs text-muted-foreground">Your viewer permission allows clone and pull. Ask the owner for editor access to push updates.</p>
          </section>
          <Collapsible v-model:open="countsOpen" class="border-t pt-5 text-xs"><CollapsibleTrigger class="cursor-pointer font-medium">Your MCP calls in this topic: {{ calls }}</CollapsibleTrigger><CollapsibleContent class="mt-3 space-y-1"><div v-for="(count, tool) in detail.my_mcp_call_counts" :key="tool" class="flex justify-between gap-3 py-1"><span class="font-mono">{{ tool }}</span><span class="tabular-nums">{{ count }}</span></div></CollapsibleContent></Collapsible>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>

<style scoped>
.topic-document :deep(a.topic-citation) { display: inline-flex; align-items: center; padding: 0.06em 0.4em; margin-inline: 0.1em; border-radius: 0.35rem; background: color-mix(in oklch, var(--primary) 10%, transparent); color: var(--primary); box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--primary) 18%, transparent); font-size: 0.76em; font-weight: 600; line-height: 1.6; font-variant-numeric: tabular-nums; text-decoration: none; vertical-align: 0.07em; }
.topic-document :deep(a.topic-citation:hover) { background: color-mix(in oklch, var(--primary) 18%, transparent); }
</style>
