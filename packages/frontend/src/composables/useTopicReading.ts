import { nextTick, onBeforeUnmount, type Ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { readTopicSurface, saveTopicSurface, surfaceAdditions, topicSurfaceKey, type TopicSurfaceSeen } from '@/lib/topic-reading'
import { resolveTopicDocument } from '@/lib/topic-navigation'
import type { TopicDetailState } from './useTopicDetail'

interface CitationCardApi { open: (anchor: HTMLElement, pinned?: boolean) => boolean; close: () => void }

/**
 * Reader-side behavior of a Topic page: per-surface "last displayed" baselines with the
 * addition animation, citation link decoration and locating, and in-document link routing.
 */
export function useTopicReading(t: TopicDetailState, page: Ref<HTMLElement | null>, citationCard: Ref<CitationCardApi | null>) {
  const auth = useAuthStore()
  let generation = 0, animations: Animation[] = []

  function decorateCitations() {
    const detail = t.detail.value
    for (const link of page.value?.querySelectorAll<HTMLAnchorElement>('.topic-document a[href^="#ref:"]') ?? []) {
      const number = Number(link.getAttribute('href')?.match(/^#ref:(\d+)$/)?.[1])
      const entry = detail?.snapshot.list.papers.find((p) => detail.reference_numbers[p.id] === number)
      if (!entry) continue
      link.removeAttribute('title'); link.setAttribute('aria-label', `Reference ${number}: ${entry.title}`); link.setAttribute('aria-haspopup', 'dialog')
      if (!link.hasAttribute('aria-expanded')) link.setAttribute('aria-expanded', 'false')
      if (/^\[?\d+\]?$/.test(link.textContent?.trim() || '')) { link.textContent = `[${number}]`; link.classList.add('topic-citation') }
    }
  }

  /** Earlier paths of the same document, so a renamed/moved page keeps its baseline. */
  function previousPaths(file: string): string[] {
    if (file === t.homePage.value && file !== 'report.md') return ['report.md']
    if (file === 'pages/research-questions/index.md') return ['pages/questions.md']
    const name = file.split('/').at(-1)
    if (file.startsWith('pages/') && t.detail.value?.documents.filter((d) => d.path.split('/').at(-1) === name).length === 1) return [`pages/${name}`].filter((p) => p !== file)
    return []
  }

  async function displayReading() {
    const current = ++generation, key = t.scope(), result = t.detail.value, file = t.selectedFile.value, version = t.selectedCommit.value
    if (!result || !auth.user) return
    const uid = auth.user.id
    await nextTick()
    requestAnimationFrame(() => {
      if (current !== generation || !t.currentScope(key) || t.detail.value?.commit !== result.commit || t.selectedFile.value !== file || t.selectedCommit.value !== version) return
      animations.forEach((a) => a.cancel()); animations = []
      decorateCitations()
      const aliases = previousPaths(file)
      const doc = t.currentDocument.value
      const surfaces: Array<{ key: string; selector: string; value: TopicSurfaceSeen; aliases?: string[] }> = []
      if (doc?.exists && !t.readerCovered.value) surfaces.push({ key: topicSurfaceKey(uid, result.id, file, 'document'), aliases: aliases.map((p) => topicSurfaceKey(uid, result.id, p, 'document')), selector: '[data-reading-surface="document"]', value: { schema_version: 2, commit: result.commit, body: doc.body, entries: [] } })
      if (doc && t.referencesOpen.value && !t.readerCovered.value) surfaces.push({ key: topicSurfaceKey(uid, result.id, file, 'references'), aliases: aliases.map((p) => topicSurfaceKey(uid, result.id, p, 'references')), selector: '[data-reading-surface="references"]', value: { schema_version: 2, commit: result.commit, body: '', entries: t.pageReferences.value } })
      if (t.allReferencesOpen.value) surfaces.push({ key: topicSurfaceKey(uid, result.id, 'references.json', 'catalog'), aliases: [topicSurfaceKey(uid, result.id, 'papers.json', 'catalog')], selector: '[data-reading-surface="catalog"]', value: { schema_version: 2, commit: result.commit, body: '', entries: t.allReferences.value } })
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
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const start = document.timeline.currentTime
      for (const element of targets) {
        const animation = element.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 550, easing: 'cubic-bezier(0.2,0.8,0.2,1)' })
        if (start != null) animation.startTime = start
        animations.push(animation)
      }
    })
  }

  async function locateReference(number: number) {
    citationCard.value?.close()
    if (!t.allReferencesOpen.value && t.pageReferences.value.some((p) => t.detail.value?.reference_numbers[p.id] === number)) t.referencesOpen.value = true
    else t.openAllReferences()
    await nextTick()
    requestAnimationFrame(() => {
      const selector = t.allReferencesOpen.value ? '[data-reading-surface="catalog"]' : '[data-reading-surface="references"]'
      const element = [...document.querySelectorAll<HTMLElement>(`${selector} [data-reference-number]`)].find((e) => Number(e.dataset.referenceNumber) === number)
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' }); element?.focus({ preventScroll: true })
    })
  }

  /** Citation links open the reference card; relative links to other Topic documents navigate in-app. */
  function onDocumentLink(event: MouseEvent) {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href]')
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return
    const href = link.getAttribute('href') || ''
    const citation = href.match(/^#ref:(\d+)$/)
    if (citation) {
      const number = Number(citation[1])
      if (!Object.values(t.detail.value?.reference_numbers ?? {}).includes(number)) return
      event.preventDefault(); event.stopPropagation()
      if (!citationCard.value?.open(link, true)) void locateReference(number)
      return
    }
    if (!href || href.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('/')) return
    let path = ''
    try { path = decodeURIComponent(new URL(href, `https://topic.invalid/${t.selectedFile.value}`).pathname.slice(1)) } catch { return }
    const detail = t.detail.value
    if (!detail) return
    const target = resolveTopicDocument(detail.documents, href.split('#')[0], t.homePage.value) ?? resolveTopicDocument(detail.documents, path, t.homePage.value)
    if (!target) return
    event.preventDefault(); event.stopPropagation(); void t.selectFile(target.path)
  }

  onBeforeUnmount(() => { generation++; animations.forEach((a) => a.cancel()) })
  return { displayReading, locateReference, onDocumentLink }
}
