import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import { toast } from 'vue-sonner'
import type { TopicDetail } from '@paperland/shared'
import { topicsApi } from '@/api/topics'
import { useAuthStore } from '@/stores/auth'
import { TopicReadingGate } from '@/lib/topic-reading'
import { documentUrl, resolveTopicDocument } from '@/lib/topic-navigation'

const CATALOG_FILES = ['papers.json', 'references.json']

/**
 * State and actions of one Topic page: route-derived document/version, loading with a
 * user/Topic scope guard, polling, drawer state, archive and explicit paper import.
 * `render` runs after each displayed change (reading-surface baselines and animations).
 */
export function useTopicDetail(options: { render: () => void; closeCitation: () => void }) {
  const route = useRoute(), router = useRouter(), auth = useAuthStore()
  const id = computed(() => Number(route.params.id))
  const selectedCommit = computed(() => typeof route.query.version === 'string' ? route.query.version : '')
  const detail = ref<TopicDetail | null>(null), loading = ref(false), error = ref('')
  const filesOpen = ref(false), referencesOpen = ref(false), allReferencesOpen = ref(false)
  const historyOpen = ref(false), shareOpen = ref(false), renameOpen = ref(false)
  const busy = ref(''), archiveBusy = ref(false)
  const imported = ref(new Set<string>()), importErrors = ref<Record<string, string>>({})
  const wide = useMediaQuery('(min-width: 1024px)')
  const gate = new TopicReadingGate()
  let alive = true

  const homePage = computed(() => detail.value?.home_page || (detail.value?.snapshot.topic.format_version === 2 ? 'pages/report.md' : 'report.md'))
  const requestedFile = computed(() => {
    if (typeof route.query.file === 'string') return route.query.file
    const p = route.params.document_path
    return Array.isArray(p) ? p.join('/') : typeof p === 'string' ? p : ''
  })
  const currentDocument = computed(() => detail.value ? resolveTopicDocument(detail.value.documents, requestedFile.value, homePage.value) : undefined)
  const selectedFile = computed(() => currentDocument.value?.path ?? (requestedFile.value || homePage.value))
  const readerCovered = computed(() => allReferencesOpen.value || filesOpen.value || historyOpen.value || shareOpen.value)
  const allReferences = computed(() => [...(detail.value?.snapshot.list.papers ?? [])].sort((a, b) => (detail.value!.reference_numbers[a.id] ?? 0) - (detail.value!.reference_numbers[b.id] ?? 0)))
  const pageReferences = computed(() => {
    const set = new Set(currentDocument.value?.references ?? [])
    return allReferences.value.filter((p) => set.has(detail.value!.reference_numbers[p.id]))
  })
  const title = computed(() => detail.value?.snapshot.topic.title || 'Topic')
  const own = computed(() => detail.value?.permission === 'owner')
  /** Archived Topics are read-only for everyone until the owner unarchives them. */
  const archived = computed(() => !!detail.value?.archived_at)
  const canEdit = computed(() => !!detail.value && detail.value.permission !== 'viewer' && !archived.value)

  const scope = () => `${auth.user?.id ?? 0}:${id.value}`
  const currentScope = (key: string) => alive && key === scope()

  function openAllReferences() { referencesOpen.value = false; filesOpen.value = false; allReferencesOpen.value = true; options.closeCitation() }

  async function selectFile(path: string) {
    filesOpen.value = false
    if (CATALOG_FILES.includes(path)) { openAllReferences(); return }
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
    if (CATALOG_FILES.includes(requestedFile.value)) { openAllReferences(); doc = detail.value.documents.find((d) => d.path === homePage.value) }
    if (!doc) return
    const path = documentUrl(id.value, doc, homePage.value)
    if (path !== route.path || route.query.file !== undefined) await router.replace({ path, query })
  }

  async function load(background = false) {
    if (!auth.user || !Number.isSafeInteger(id.value) || id.value < 1) return
    const key = scope(), tid = id.value, version = selectedCommit.value
    const ticket = gate.begin(`${auth.user.id}:${tid}`)
    if (!background) { loading.value = true; error.value = '' }
    try {
      const result = (await topicsApi.get(tid, version || undefined)).data
      if (!currentScope(key) || !gate.valid(ticket)) return
      detail.value = result; loading.value = false; error.value = ''
      await normalizeDocumentRoute(); options.render()
    } catch (e) {
      if (!currentScope(key) || !gate.valid(ticket)) return
      error.value = (e as Error).message
      if (error.value.includes('not found')) detail.value = null
    } finally { if (currentScope(key) && gate.valid(ticket)) loading.value = false }
  }

  async function viewVersion(commit?: string) {
    const query = { ...route.query }
    if (commit) query.version = commit; else delete query.version
    await router.replace({ query }); historyOpen.value = false
  }

  async function setArchived(value: boolean) {
    if (!detail.value) return
    const question = value
      ? 'Archive this topic? It stays listed and readable, but nobody can change it or push to it until you unarchive it.'
      : 'Unarchive this topic? Editors will be able to change it and push to it again.'
    if (!confirm(question)) return
    archiveBusy.value = true
    try {
      await topicsApi.archive(id.value, value)
      toast.success(value ? 'Topic archived' : 'Topic unarchived')
      await load(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not change the archive state')
    } finally { archiveBusy.value = false }
  }

  async function importPaper(entryId: string) {
    if (busy.value) return
    const key = scope(), commit = detail.value?.commit, version = selectedCommit.value
    busy.value = `import:${entryId}`; delete importErrors.value[entryId]
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

  function browsePapers() { void router.push({ path: '/papers', query: { scope: 'all', topic_id: String(id.value), topic_node_id: 'root' } }) }

  watch([() => auth.user?.id, () => id.value], () => {
    gate.invalidate(); filesOpen.value = false; referencesOpen.value = false; allReferencesOpen.value = false
    historyOpen.value = false; shareOpen.value = false; renameOpen.value = false
    detail.value = null; busy.value = ''; imported.value = new Set(); importErrors.value = {}
    void load()
  }, { immediate: true })
  watch(selectedCommit, () => { renameOpen.value = false; gate.invalidate(); void load() })
  watch([selectedFile, selectedCommit], () => { referencesOpen.value = false; options.closeCitation() })
  watch([requestedFile, referencesOpen, allReferencesOpen, filesOpen, historyOpen, shareOpen, wide], () => { void normalizeDocumentRoute().then(options.render) })
  watch(wide, (desktop) => { if (desktop) filesOpen.value = false })
  const poll = setInterval(() => { if (alive && !document.hidden && !selectedCommit.value && !loading.value && !busy.value && !renameOpen.value) void load(true) }, 15000)
  onBeforeUnmount(() => { alive = false; gate.invalidate(); clearInterval(poll) })

  return {
    id, selectedCommit, detail, loading, error, wide,
    filesOpen, referencesOpen, allReferencesOpen, historyOpen, shareOpen, renameOpen,
    busy, archiveBusy, imported, importErrors,
    homePage, currentDocument, selectedFile, readerCovered, allReferences, pageReferences, title, own, archived, canEdit,
    scope, currentScope, load, selectFile, openAllReferences, viewVersion, setArchived, importPaper, browsePapers,
  }
}

export type TopicDetailState = ReturnType<typeof useTopicDetail>
