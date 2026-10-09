<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount, computed } from 'vue'
import SparkMD5 from 'spark-md5'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { toast } from 'vue-sonner'
import { useRouter, useRoute } from 'vue-router'
import { Trash2, Link2, Copy, ExternalLink, BookOpen } from '@lucide/vue'
import { usePaperReferences, findReference, s2Url, type PaperReference } from '@/composables/usePaperReferences'
import { useQAStore } from '@/stores/qa'
import { useHighlightStore } from '@/stores/highlights'
import { useAuthStore } from '@/stores/auth'
import { applyHighlights, clearHighlights, getSelectionOffsets, isForeignHighlight } from '@/composables/useHighlight'
import { useBlockAnchor, type AnchorRange } from '@/composables/useBlockAnchor'
import { usePdfNavigation } from '@/composables/usePdfNavigation'
import type { HighlightColor } from '@paperland/shared'
import { renderMarkdown } from '@/lib/markdown-renderer'

// `disableHighlights` renders the markdown read-only: no selection toolbar, no stored
// highlights, no highlight click-menu. Anchor-link and KaTeX-copy clicks still work.
// Used by the walkthrough view, whose dynamically-assembled content is incompatible with
// the content-hash-keyed highlight model.
// `publicNote` renders another user's note: Q&A/block (`?h=`) anchors are made inert (they
// resolve against THIS viewer's Q&A, not the author's), while PDF (`?pdf=`) anchors stay live.
// `applyImageWidth` (default true) gates the `w=sm|md|lg|<px>` image alt-text width directive:
// when false (mindmap content nodes) the directive token is still stripped from the alt but no
// max-width cap is applied, so image sizing stays governed by the node layout.
// NOTE: `applyImageWidth` must default to TRUE. A Boolean-typed prop that the parent omits is
// cast to `false` by Vue (not `undefined`), so without this default the directive would be
// disabled everywhere it isn't explicitly passed (walkthrough, notes card, public notes, FAQ).
// `qaAnswer` marks a Q&A answer: `#moonlight` links emit `moonlight` (open a pre-filled follow-up)
// and `#cite:<id>` links become citation chips when the id is in the paper's references (else plain text).
const props = withDefaults(
  defineProps<{ content: string; highlightPathname?: string; paperId?: number; qaResultId?: number; disableHighlights?: boolean; publicNote?: boolean; applyImageWidth?: boolean; qaAnswer?: boolean }>(),
  { applyImageWidth: true },
)
const emit = defineEmits<{ moonlight: [question: string] }>()
const qaStore = useQAStore()
const references = props.qaAnswer && props.paperId ? usePaperReferences(props.paperId) : ref<PaperReference[] | null>(null)
const activeCite = ref<{ ref: PaperReference; citeId: string; x: number; y: number } | null>(null)

const highlightStore = useHighlightStore()
const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const { locateBlock } = useBlockAnchor()
const { requestPdfNavigation } = usePdfNavigation()
const containerRef = ref<HTMLElement | null>(null)

// Touch device detection (same approach as QAPanelNav.vue)
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

// Toolbar state
const showToolbar = ref(false)
const toolbarPos = ref({ x: 0, y: 0 })
const pendingSelection = ref<{ start_offset: number; end_offset: number; text: string } | null>(null)

// Click menu state
const showMenu = ref(false)
const menuPos = ref({ x: 0, y: 0 })
const menuHighlightId = ref<number | null>(null)

// HTML → Markdown converter for the "copy as anchor" action (GFM tables/strikethrough).
const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' })
turndown.use(gfm)

/** Compute content hash: MD5 of content with all whitespace removed */
const contentHash = computed(() => {
  if (!props.content) return ''
  const stripped = props.content.replace(/\s/g, '')
  return SparkMD5.hash(stripped)
})

/** Get highlights for this specific content from the store */
const myHighlights = computed(() => {
  if (props.disableHighlights) return []
  if (!contentHash.value) return []
  return highlightStore.getForHash(contentHash.value)
})

/** Parse a `w=sm|md|lg|<px>` width directive out of an image alt. Returns the cap (if any)
 *  and the alt with the directive token removed. See the note-image-width-directive spec. */
function parseImageWidthDirective(alt: string): { tier?: 'sm' | 'md' | 'lg'; px?: number; cleanedAlt: string } {
  if (!alt) return { cleanedAlt: alt }
  const m = alt.match(/(?:^|\s)w=(sm|md|lg|\d+)(?=\s|$)/i)
  if (!m || m.index == null) return { cleanedAlt: alt }
  const cleanedAlt = (alt.slice(0, m.index) + ' ' + alt.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim()
  const v = m[1].toLowerCase()
  if (v === 'sm' || v === 'md' || v === 'lg') return { tier: v, cleanedAlt }
  const n = parseInt(v, 10)
  if (!Number.isFinite(n) || n <= 0) return { cleanedAlt } // zero/negative → no cap
  return { px: Math.min(4096, Math.max(16, n)), cleanedAlt }
}

/** Apply note-image width directives. The directive token is always stripped from the alt;
 *  the max-width cap is only applied when `applyImageWidth` is not explicitly false. */
function applyImageWidthDirectives(el: HTMLElement) {
  for (const img of Array.from(el.querySelectorAll('img'))) {
    const alt = img.getAttribute('alt') ?? ''
    const { tier, px, cleanedAlt } = parseImageWidthDirective(alt)
    if (cleanedAlt !== alt) img.setAttribute('alt', cleanedAlt)
    if (!props.applyImageWidth) continue // mindmap: strip token but don't size
    if (tier) img.classList.add(`md-img-w-${tier}`)
    else if (px != null) (img as HTMLElement).style.maxWidth = `min(${px}px, 100%)`
  }
}

/** Render markdown and apply highlights */
function renderAndHighlight() {
  const el = containerRef.value
  if (!el) return

  // Render markdown to HTML
  el.innerHTML = renderMarkdown(props.content)

  // Apply `w=sm|md|lg|<px>` image width directives encoded in image alt text.
  applyImageWidthDirectives(el)

  // Public-note mode: neutralize Q&A/block anchors so they can't resolve against this viewer's Q&A.
  if (props.publicNote) deactivateBlockAnchors(el)

  if (props.qaAnswer) decorateQALinks(el)

  // Apply highlights after DOM update
  nextTick(() => {
    if (!el || myHighlights.value.length === 0) return
    applyHighlights(el, myHighlights.value, auth.user?.id ?? null)
  })
}

// Watch content changes
watch(() => props.content, () => {
  closeAllPopups()
  renderAndHighlight()
}, { immediate: false })

// Citation chips depend on the paper's reference list, which loads asynchronously.
watch(references, () => { if (props.qaAnswer) renderAndHighlight() })

// Watch highlight changes (e.g., after create/delete)
watch(myHighlights, () => {
  renderAndHighlight()
}, { deep: true })

// ---- Selection & Toolbar (selectionchange-based) ----

let selectionDebounceTimer: ReturnType<typeof setTimeout> | null = null

function onSelectionChange() {
  // Debounce: shorter for desktop, longer for mobile (touch selection is slower)
  const delay = isTouchDevice ? 300 : 50

  if (selectionDebounceTimer) clearTimeout(selectionDebounceTimer)
  selectionDebounceTimer = setTimeout(() => {
    handleSelectionSettled()
  }, delay)
}

function handleSelectionSettled() {
  const el = containerRef.value
  if (!el) return

  // Highlighting is a logged-in feature; never show the toolbar for anonymous users.
  if (!auth.isAuthenticated) return

  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    // Selection cleared — hide toolbar if showing
    if (showToolbar.value) {
      showToolbar.value = false
      pendingSelection.value = null
    }
    return
  }

  // Check if selection is within our container
  const range = selection.getRangeAt(0)
  if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return

  // Don't show toolbar if selection is inside toolbar/menu elements
  const anchorEl = range.startContainer.nodeType === Node.ELEMENT_NODE
    ? range.startContainer as Element
    : range.startContainer.parentElement
  if (anchorEl?.closest('.hl-toolbar, .hl-menu')) return

  if (!props.content) {
    alert('内容为空，无法创建高亮。请检查组件是否正确接收了内容数据。')
    return
  }

  const offsets = getSelectionOffsets(el)
  if (!offsets) {
    showToolbar.value = false
    return
  }

  pendingSelection.value = offsets

  // Position toolbar below selection with viewport clamping
  const containerRect = el.getBoundingClientRect()
  const rangeRect = range.getBoundingClientRect()

  let x = rangeRect.left + rangeRect.width / 2 - containerRect.left
  const y = rangeRect.bottom - containerRect.top + 6

  // Clamp x so toolbar doesn't overflow container edges
  // Toolbar is ~140px wide (centered via translateX(-50%)), so half-width ~70px
  const toolbarHalfWidth = 70
  const minX = toolbarHalfWidth
  const maxX = containerRect.width - toolbarHalfWidth
  if (maxX > minX) {
    x = Math.max(minX, Math.min(maxX, x))
  }

  toolbarPos.value = { x, y }
  showToolbar.value = true
}

async function createHighlight(color: HighlightColor) {
  if (!pendingSelection.value || !contentHash.value) return

  await highlightStore.create({
    content_hash: contentHash.value,
    ...(props.qaResultId != null ? { qa_result_id: props.qaResultId } : {}),
    start_offset: pendingSelection.value.start_offset,
    end_offset: pendingSelection.value.end_offset,
    text: pendingSelection.value.text,
    color,
    ...(props.highlightPathname ? { pathname: props.highlightPathname } : {}),
  })

  window.getSelection()?.removeAllRanges()
  closeAllPopups()
}

// ---- paperland:// anchor links ----

interface PdfRect { x: number; y: number; w: number; h: number }
interface PdfAnchor { page: number; ts: number | null; te: number | null; rect: PdfRect | null }

/** Parse a normalized `[0,1]` page-space rectangle from `rx`/`ry`/`rw`/`rh`; null if absent/malformed. */
function parsePdfRect(params: URLSearchParams): PdfRect | null {
  const raw = ['rx', 'ry', 'rw', 'rh'].map((k) => params.get(k))
  if (raw.some((v) => v == null)) return null
  const [x, y, w, h] = raw.map((v) => Number(v))
  if ([x, y, w, h].some((n) => !Number.isFinite(n)) || w <= 0 || h <= 0) return null
  return { x, y, w, h }
}

/**
 * Parse a `paperland://paper/<id>` anchor. Supports a Markdown-block target
 * (`?h=<hash>&s=<start>&e=<end>`) or a PDF target (`?pdf=<page>&ts=<start>&te=<end>`
 * or `?pdf=<page>&rx=&ry=&rw=&rh=`). `pdf` takes precedence over `h`; within a PDF
 * target the rectangle takes precedence over `ts`/`te`. All sub-params optional.
 */
function parsePaperlandUrl(href: string): { paperId: number; hash: string | null; range: AnchorRange | null; pdf: PdfAnchor | null; qa: { entryId: number; resultId: number | null } | null } | null {
  const m = href.match(/^paperland:\/\/paper\/(\d+)(?:\?(.*))?$/)
  if (!m) return null
  const params = new URLSearchParams(m[2] || '')
  const s = params.get('s')
  const e = params.get('e')
  const pdf = params.get('pdf')
  const ts = params.get('ts')
  const te = params.get('te')
  const qa = params.get('qa')
  const result = params.get('result')
  const qaEntryId = qa != null ? parseInt(qa, 10) : NaN
  return {
    // `qa` makes this a Q&A target; any h/s/e/pdf parameters are then ignored.
    qa: Number.isFinite(qaEntryId)
      ? { entryId: qaEntryId, resultId: result != null && Number.isFinite(parseInt(result, 10)) ? parseInt(result, 10) : null }
      : null,
    paperId: parseInt(m[1], 10),
    hash: params.get('h'),
    range: s != null && e != null ? { start: parseInt(s, 10), end: parseInt(e, 10) } : null,
    pdf: pdf != null
      ? { page: parseInt(pdf, 10), ts: ts != null ? parseInt(ts, 10) : null, te: te != null ? parseInt(te, 10) : null, rect: parsePdfRect(params) }
      : null,
  }
}

/**
 * Public-note mode: turn Q&A/block (`?h=`) anchors into inert plain text (a `?h=` target
 * resolves against the current viewer's Q&A, so it's meaningless on someone else's note).
 * PDF (`?pdf=`) anchors and bare paper links are left untouched (still clickable).
 */
function deactivateBlockAnchors(el: HTMLElement) {
  for (const a of Array.from(el.querySelectorAll('a[href^="paperland://"]'))) {
    const target = parsePaperlandUrl(a.getAttribute('href') || '')
    if (target && target.pdf == null && target.hash != null) {
      const span = document.createElement('span')
      span.className = 'anchor-inert'
      span.textContent = a.textContent || ''
      a.replaceWith(span)
    }
  }
}

/**
 * Q&A answers: `#cite:<id>` links whose id is in this paper's references become citation chips
 * (same text, so highlight offsets are unchanged); unknown ids become plain text. `#moonlight`
 * follow-up suggestions stay links and are intercepted on click.
 */
function decorateQALinks(el: HTMLElement) {
  for (const a of Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href^="#cite:"]'))) {
    const citeId = decodeURIComponent((a.getAttribute('href') || '').slice('#cite:'.length))
    const span = document.createElement('span')
    span.textContent = a.textContent || ''
    if (findReference(references.value, citeId)) {
      span.className = 'qa-cite-chip'
      span.dataset.citeId = citeId
      span.setAttribute('role', 'button')
      span.tabIndex = 0
    } else {
      span.className = 'qa-cite-unknown'
    }
    a.replaceWith(span)
  }
  for (const a of Array.from(el.querySelectorAll<HTMLAnchorElement>('a[href="#moonlight"]'))) {
    a.classList.add('qa-followup-link')
  }
}

function openCiteCard(chip: HTMLElement) {
  const ref = findReference(references.value, chip.dataset.citeId || '')
  const host = containerRef.value?.parentElement
  if (!ref || !host) return
  const cr = chip.getBoundingClientRect()
  const hr = host.getBoundingClientRect()
  activeCite.value = { ref, citeId: chip.dataset.citeId!, x: cr.left - hr.left, y: cr.bottom - hr.top + 4 }
}

/** Q&A answer link clicks: suggested follow-ups and citation chips never navigate. */
function onQALinkClick(e: MouseEvent | Event) {
  if (!props.qaAnswer) return
  const target = e.target as Element
  const moonlight = target?.closest('a[href="#moonlight"]')
  if (moonlight) {
    e.preventDefault()
    e.stopPropagation()
    emit('moonlight', (moonlight.textContent || '').replace(/^\s*💬\s*/u, '').trim())
    return
  }
  const chip = target?.closest('.qa-cite-chip') as HTMLElement | null
  if (chip) {
    e.stopPropagation()
    if (activeCite.value?.citeId === chip.dataset.citeId) activeCite.value = null
    else openCiteCard(chip)
  }
}

function onCiteHover(e: MouseEvent) {
  const chip = (e.target as Element)?.closest?.('.qa-cite-chip') as HTMLElement | null
  if (chip && activeCite.value?.citeId !== chip.dataset.citeId) openCiteCard(chip)
}

function openLibraryPaper(paperId: number) {
  activeCite.value = null
  router.push(`/papers/${paperId}`)
}

/** Follow a `?qa=<entry>[&result=]` link: resolve the owning paper by entry id, then reveal it. */
async function openQALink(entryId: number, resultId: number | null) {
  let located
  try {
    located = await qaStore.locateEntry(entryId, resultId)
  } catch {
    toast.error('Q&A unavailable')
    return
  }
  if (located.state === 'hidden') { toast.error('This Q&A is currently not visible'); return }
  if (located.state === 'deleted' || located.paper_id == null) { toast.error('This Q&A has been deleted'); return }
  const query: Record<string, string> = { qa: String(entryId) }
  if (resultId != null) query.result = String(resultId)
  router.push({ path: `/papers/${located.paper_id}`, query })
}

/** Intercept clicks on `paperland://` links: jump in-app instead of navigating the browser. */
function onAnchorLinkClick(e: MouseEvent | Event) {
  const a = (e.target as Element)?.closest('a[href^="paperland://"]') as HTMLAnchorElement | null
  if (!a) return
  e.preventDefault()
  e.stopPropagation()
  const target = parsePaperlandUrl(a.getAttribute('href') || '')
  if (!target) return
  // A Q&A target resolves by entry id alone (the link's paper id may be stale).
  if (target.qa) {
    void openQALink(target.qa.entryId, target.qa.resultId)
    return
  }
  // Backstop for public-note mode: never resolve a Q&A/block target against this viewer's Q&A.
  if (props.publicNote && target.pdf == null && target.hash != null) return
  const onSamePaper = route.name === 'paper-detail' && parseInt(route.params.id as string, 10) === target.paperId

  // PDF target → embedded viewer (takes precedence over a block target).
  if (target.pdf) {
    const { page, ts, te, rect } = target.pdf
    if (onSamePaper) {
      // Rectangle wins over a text selection when both are present.
      if (rect) requestPdfNavigation({ page, rect })
      else if (ts != null && te != null) requestPdfNavigation({ page, ts, te })
      else requestPdfNavigation({ page })
    } else {
      const query: Record<string, string> = { pdf: String(page) }
      if (rect) {
        query.rx = String(rect.x); query.ry = String(rect.y); query.rw = String(rect.w); query.rh = String(rect.h)
      } else if (ts != null && te != null) {
        query.ts = String(ts); query.te = String(te)
      }
      router.push({ path: `/papers/${target.paperId}`, query })
    }
    return
  }

  if (onSamePaper) {
    locateBlock(target.paperId, target.hash, target.range)
  } else {
    const query: Record<string, string> = {}
    if (target.hash) query.h = target.hash
    if (target.range) { query.s = String(target.range.start); query.e = String(target.range.end) }
    router.push({ path: `/papers/${target.paperId}`, query })
  }
}

// Private-use-area chars wrap math sentinels so Turndown never escapes the LaTeX.
const MATH_SENTINEL = ''

/**
 * Convert the live selection back to Markdown.
 * Math (`.katex` / `.katex-display`) is reconstructed exactly from each element's
 * `x-tex` annotation and re-inserted as `$…$` / `$$…$$` AFTER Turndown runs, so the
 * LaTeX is never mangled by Markdown escaping. Tables become GFM pipe tables.
 */
function selectionToMarkdown(): string {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return ''

  const wrapper = document.createElement('div')
  wrapper.appendChild(selection.getRangeAt(0).cloneContents())

  // Drop highlight <mark> wrappers so highlight styling doesn't leak into the Markdown.
  for (const mark of Array.from(wrapper.querySelectorAll('mark[data-highlight-id]'))) {
    const parent = mark.parentNode
    if (!parent) continue
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
  }

  // Swap each KaTeX element for a sentinel text node (display before inline, since
  // `.katex-display` contains a `.katex`). Record the original LaTeX for re-insertion.
  const maths: { display: boolean; tex: string }[] = []
  const swapKatex = (selector: string, display: boolean) => {
    for (const el of Array.from(wrapper.querySelectorAll(selector))) {
      const tex = (el.querySelector('annotation[encoding="application/x-tex"]')?.textContent || '').trim()
      el.replaceWith(document.createTextNode(`${MATH_SENTINEL}${maths.length}${MATH_SENTINEL}`))
      maths.push({ display, tex })
    }
  }
  swapKatex('.katex-display', true)
  swapKatex('.katex', false)

  let markdown = turndown.turndown(wrapper.innerHTML)
  markdown = markdown.replace(
    new RegExp(`${MATH_SENTINEL}(\\d+)${MATH_SENTINEL}`, 'g'),
    (_, i) => {
      const m = maths[Number(i)]
      if (!m) return ''
      // Display math must sit on its own line(s) to parse as a block; inline math is left in place.
      return m.display ? `\n$$\n${m.tex}\n$$\n` : `$${m.tex}$`
    },
  )
  // The sentinel usually already sits in its own paragraph, so the newlines added around
  // display math would otherwise double up the blank line — collapse 3+ newlines to one blank line.
  markdown = markdown.replace(/\n{3,}/g, '\n\n')
  return markdown.trim()
}

/** Build the `paperland://…` anchor URL for the pending selection, or null when unavailable. */
function pendingAnchorUrl(): string | null {
  if (!pendingSelection.value || !contentHash.value || !props.paperId) return null
  const { start_offset, end_offset } = pendingSelection.value
  return `paperland://paper/${props.paperId}?h=${contentHash.value}&s=${start_offset}&e=${end_offset}`
}

/** Copy the full selection as Markdown, followed by a compact `[#](paperland://…)` anchor. */
function copyContentAndAnchorLink() {
  const url = pendingAnchorUrl()
  if (!url || !pendingSelection.value) return
  // Fall back to the rendered plain text if Markdown conversion comes back empty
  // (e.g. the browser collapsed the selection when the toolbar was tapped).
  const content = selectionToMarkdown() || pendingSelection.value.text.trim()
  navigator.clipboard.writeText(`${content} [#](${url})`)
  toast.success('已复制内容和锚点链接', { position: 'bottom-center' })
  window.getSelection()?.removeAllRanges()
  closeAllPopups()
}

/** Copy only the positioning anchor as a compact `[#](paperland://…)` link, with no content. */
function copyAnchorLinkOnly() {
  const url = pendingAnchorUrl()
  if (!url) return
  navigator.clipboard.writeText(`[#](${url})`)
  toast.success('已复制锚点链接', { position: 'bottom-center' })
  window.getSelection()?.removeAllRanges()
  closeAllPopups()
}

// ---- Click Menu ----

function onMarkClick(e: MouseEvent | Event) {
  const mark = (e.target as Element)?.closest('mark[data-highlight-id]') as HTMLElement | null
  if (!mark) return

  // On touch devices, don't open menu if there's an active text selection (let toolbar handle it)
  if (isTouchDevice) {
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed) return
  }

  e.preventDefault()
  e.stopPropagation()

  const id = parseInt(mark.dataset.highlightId!, 10)
  const hl = myHighlights.value.find(h => h.id === id)
  if (!hl) return
  // Another user's highlight is read-only: its owner shows via the mark's title tooltip.
  if (isForeignHighlight(hl, auth.user?.id ?? null)) return

  const containerRect = containerRef.value!.getBoundingClientRect()
  const markRect = mark.getBoundingClientRect()

  menuHighlightId.value = id

  // Position menu with viewport clamping
  let x = markRect.left - containerRect.left + markRect.width / 2
  const y = markRect.bottom - containerRect.top + 4

  const menuHalfWidth = 80
  const minX = menuHalfWidth
  const maxX = containerRect.width - menuHalfWidth
  if (maxX > minX) {
    x = Math.max(minX, Math.min(maxX, x))
  }

  menuPos.value = { x, y }
  showMenu.value = true
  showToolbar.value = false
}

async function menuChangeColor(color: HighlightColor) {
  if (menuHighlightId.value == null) return
  await highlightStore.update(menuHighlightId.value, { color })
  showMenu.value = false
}

async function menuDelete() {
  if (menuHighlightId.value == null) return
  await highlightStore.remove(menuHighlightId.value)
  showMenu.value = false
}

// ---- KaTeX Copy ----

function onKatexClick(e: MouseEvent | Event) {
  const target = e.target as Element
  const katexEl = target.closest('.katex')
  if (!katexEl) return

  const selection = window.getSelection()
  if (selection && !selection.isCollapsed) return

  const annotation = katexEl.querySelector('annotation[encoding="application/x-tex"]')
  if (!annotation?.textContent) return

  navigator.clipboard.writeText(annotation.textContent).then(() => {
    toast.success('LaTeX 已复制到剪贴板', { position: 'bottom-center' })
  })
}

// ---- Helpers ----

function closeAllPopups() {
  showToolbar.value = false
  showMenu.value = false
  pendingSelection.value = null
}

/** Dismiss popups on outside click/tap — idempotent, safe for both mousedown & touchstart */
function onDocumentDismiss(e: MouseEvent | TouchEvent) {
  const target = e.target as Element
  if (target?.closest('.hl-toolbar, .hl-menu')) return
  if (target?.closest('mark[data-highlight-id]')) return
  closeAllPopups()
}

const COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink']
const COLOR_LABELS: Record<HighlightColor, string> = { yellow: 'Yellow', green: 'Green', blue: 'Blue', pink: 'Pink' }

// ---- Lifecycle ----

function onCiteDismiss(e: MouseEvent) {
  const target = e.target as Element
  if (!target?.closest('.qa-cite-card, .qa-cite-chip')) activeCite.value = null
}

onMounted(() => {
  renderAndHighlight()
  if (props.qaAnswer) document.addEventListener('mousedown', onCiteDismiss)
  if (props.disableHighlights) return // read-only: no toolbar/menu listeners
  // Selection detection via selectionchange (works on both desktop and mobile)
  document.addEventListener('selectionchange', onSelectionChange)
  // Popup dismissal — both mouse and touch
  document.addEventListener('mousedown', onDocumentDismiss)
  document.addEventListener('touchstart', onDocumentDismiss, { passive: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onCiteDismiss)
  document.removeEventListener('selectionchange', onSelectionChange)
  document.removeEventListener('mousedown', onDocumentDismiss)
  document.removeEventListener('touchstart', onDocumentDismiss)
  if (selectionDebounceTimer) clearTimeout(selectionDebounceTimer)
})
</script>

<template>
  <div class="markdown-content max-w-none relative" style="position: relative;" :data-content-hash="contentHash">
    <div
      ref="containerRef"
      @click="onQALinkClick($event); onAnchorLinkClick($event); onMarkClick($event); onKatexClick($event)"
      @mouseover="qaAnswer && onCiteHover($event)"
    />

    <!-- Citation card for a `#cite:` chip (reference data comes from the paper's S2 references) -->
    <div
      v-if="activeCite"
      class="qa-cite-card"
      :style="{ left: activeCite.x + 'px', top: activeCite.y + 'px' }"
      @mouseleave="activeCite = null"
    >
      <div class="qa-cite-card-title">{{ activeCite.ref.title || 'Untitled' }}</div>
      <div class="qa-cite-card-meta">
        <span v-if="activeCite.ref.authors.length">{{ activeCite.ref.authors.slice(0, 3).join(', ') }}<template v-if="activeCite.ref.authors.length > 3"> et al.</template></span>
        <span v-if="activeCite.ref.year"> · {{ activeCite.ref.year }}</span>
        <span v-if="activeCite.ref.venue"> · {{ activeCite.ref.venue }}</span>
      </div>
      <div class="qa-cite-card-actions">
        <button v-if="activeCite.ref.library_paper_id" type="button" @click="openLibraryPaper(activeCite.ref.library_paper_id)">
          <BookOpen class="hl-icon" /> 打开论文
        </button>
        <a :href="s2Url(activeCite.citeId)" target="_blank" rel="noopener noreferrer">
          <ExternalLink class="hl-icon" /> Semantic Scholar
        </a>
      </div>
    </div>

    <!-- Selection Toolbar -->
    <div
      v-if="showToolbar"
      class="hl-toolbar"
      :style="{ left: toolbarPos.x + 'px', top: toolbarPos.y + 'px' }"
    >
      <div class="hl-toolbar-colors">
        <button
          v-for="c in COLORS" :key="c"
          class="hl-color-btn"
          :class="'hl-btn-' + c"
          :title="COLOR_LABELS[c]"
          @click.stop="createHighlight(c)"
        />
      </div>
      <button v-if="paperId" class="hl-note-toggle" @click.stop="copyContentAndAnchorLink" title="复制内容和锚点链接">
        <Copy class="hl-icon" />
      </button>
      <button v-if="paperId" class="hl-note-toggle" @click.stop="copyAnchorLinkOnly" title="复制锚点链接">
        <Link2 class="hl-icon" />
      </button>
    </div>

    <!-- Click Menu -->
    <div
      v-if="showMenu"
      class="hl-menu"
      :style="{ left: menuPos.x + 'px', top: menuPos.y + 'px' }"
      @click.stop
    >
      <div class="hl-menu-colors">
        <button
          v-for="c in COLORS" :key="c"
          class="hl-color-btn"
          :class="'hl-btn-' + c"
          :title="COLOR_LABELS[c]"
          @click.stop="menuChangeColor(c)"
        />
      </div>
      <div class="hl-menu-actions">
        <button @click.stop="menuDelete" class="hl-menu-btn hl-menu-btn-danger">
          <Trash2 class="hl-icon" /> Delete
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* --- Markdown styles --- */
/* Break long unbreakable tokens (URLs, identifiers) so prose never forces the
   article wider than its container — the main cause of mobile horizontal scroll.
   overflow-wrap is inherited, so this covers p / li / headings too. Code blocks
   (<pre>) keep white-space:pre + their own overflow-x:auto and are unaffected. */
.markdown-content { overflow-wrap: anywhere; }
/* Q&A answers: citation chips (`#cite:` ids found in the paper's references), unknown ids as
   plain text, and suggested follow-up links. Chip text equals the link text so highlight offsets hold. */
.markdown-content :deep(.qa-cite-chip) {
  display: inline; cursor: pointer; border-radius: 0.25rem; padding: 0 0.3em;
  background: color-mix(in oklch, var(--primary) 10%, transparent); color: var(--primary);
  border-bottom: 1px dashed color-mix(in oklch, var(--primary) 50%, transparent);
}
.markdown-content :deep(.qa-cite-chip)::before { content: '§ '; opacity: 0.6; }
.markdown-content :deep(.qa-followup-link) { text-decoration: none; word-break: normal; }
.markdown-content :deep(.qa-followup-link:hover) { text-decoration: underline; }
.qa-cite-card {
  position: absolute; z-index: 40; width: min(320px, 90%); padding: 0.6rem 0.75rem;
  border-radius: 0.5rem; border: 1px solid var(--border); background: var(--popover);
  color: var(--popover-foreground); box-shadow: 0 8px 24px rgb(0 0 0 / 0.12); font-size: 0.8rem;
}
.qa-cite-card-title { font-weight: 600; line-height: 1.35; }
.qa-cite-card-meta { margin-top: 0.2rem; color: var(--muted-foreground); }
.qa-cite-card-actions { margin-top: 0.45rem; display: flex; gap: 0.75rem; }
.qa-cite-card-actions button, .qa-cite-card-actions a {
  display: inline-flex; align-items: center; gap: 0.25rem; color: var(--primary); text-decoration: none;
}
/* Inert Q&A/block anchor in public-note mode: looks like its text, not actionable. */
.markdown-content :deep(.anchor-inert) { color: var(--muted-foreground); text-decoration: underline dotted; text-underline-offset: 2px; cursor: default; }
.markdown-content :deep(h1) { font-size: 1.25em; font-weight: 700; margin: 1em 0 0.5em; }
.markdown-content :deep(h2) { font-size: 1.125em; font-weight: 600; margin: 0.8em 0 0.4em; }
.markdown-content :deep(h3) { font-size: 1em; font-weight: 600; margin: 0.6em 0 0.3em; }
.markdown-content :deep(p) { margin: 0.4em 0; line-height: 1.7; }
.markdown-content :deep(ul) { margin: 0.4em 0; padding-left: 1.5em; list-style-type: disc; }
.markdown-content :deep(ol) { margin: 0.4em 0; padding-left: 1.5em; list-style-type: decimal; }
.markdown-content :deep(li) { margin: 0.2em 0; line-height: 1.6; }
.markdown-content :deep(code) {
  background: #f3f4f6; border-radius: 0.25rem; padding: 0.15em 0.35em;
  font-size: 0.85em; color: #374151;
  overflow-wrap: anywhere; word-break: break-word;
}
.markdown-content :deep(pre) {
  background: #1f2937; color: #e5e7eb; border-radius: 0.5rem;
  padding: 0.75em 1em; overflow-x: auto; margin: 0.5em 0;
}
.markdown-content :deep(pre code) {
  background: none; padding: 0; color: inherit; font-size: 0.85em;
}
.markdown-content :deep(blockquote) {
  border-left: 3px solid #d1d5db; padding-left: 0.75em; margin: 0.5em 0;
  color: #6b7280;
}
.markdown-content :deep(table) { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
.markdown-content :deep(th), .markdown-content :deep(td) {
  border: 1px solid #e5e7eb; padding: 0.4em 0.6em; text-align: left; font-size: 0.85em;
}
.markdown-content :deep(th) { background: #f9fafb; font-weight: 600; }
.markdown-content :deep(strong) { font-weight: 600; }
.markdown-content :deep(a) { color: var(--primary); text-decoration: underline; word-break: break-all; }
.markdown-content :deep(img) { max-width: 100%; height: auto; border-radius: 0.375rem; margin: 0.5em 0; }
/* `w=sm|md|lg` alt-text width directive → max-width cap. Tier px come from config.yml via the
   --note-img-w-* custom properties; the designed defaults are the CSS fallbacks. min(…, 100%)
   keeps the image within its container so a tier larger than the column never overflows. */
.markdown-content :deep(img.md-img-w-sm) { max-width: min(var(--note-img-w-sm, 240px), 100%); }
.markdown-content :deep(img.md-img-w-md) { max-width: min(var(--note-img-w-md, 480px), 100%); }
.markdown-content :deep(img.md-img-w-lg) { max-width: min(var(--note-img-w-lg, 720px), 100%); }
.markdown-content :deep(hr) { border: none; border-top: 1px solid #e5e7eb; margin: 0.75em 0; }
/* KaTeX display math: center, hug content for the hover hint, scroll when too wide.
   flex + `safe center` centers a formula that fits but falls back to a scrollable
   left edge when it overflows; the inline-block child (flex-shrink:0) keeps its
   content width so the .katex:hover background covers only the formula, and wide
   formulas overflow into the horizontal scroll instead of being squished. */
.markdown-content :deep(.katex-display) {
  display: flex;
  justify-content: center;        /* fallback for browsers without `safe` */
  justify-content: safe center;
  margin: 0.5em 0; overflow-x: auto; overflow-y: hidden;
}
.markdown-content :deep(.katex-display > .katex) {
  display: inline-block; flex-shrink: 0; text-align: center;
}
/* KaTeX click-to-copy cursor & hover */
.markdown-content :deep(.katex) { cursor: pointer; border-radius: 6px; transition: background-color 0.15s; padding: 1px 3px; }
.markdown-content :deep(.katex:hover) { background-color: color-mix(in oklch, var(--primary) 12%, transparent); }

/* --- Highlight colors --- */
.markdown-content :deep(.hl-yellow) { background-color: rgba(250, 204, 21, 0.35); border-radius: 2px; cursor: pointer; }
.markdown-content :deep(.hl-green) { background-color: rgba(74, 222, 128, 0.35); border-radius: 2px; cursor: pointer; }
.markdown-content :deep(.hl-blue) { background-color: rgba(96, 165, 250, 0.35); border-radius: 2px; cursor: pointer; }
.markdown-content :deep(.hl-pink) { background-color: rgba(244, 114, 182, 0.35); border-radius: 2px; cursor: pointer; }
/* Other users' highlights (All scope): no fill so the viewer's own fill stays readable; read-only. */
.markdown-content :deep(.hl-foreign) { background-color: transparent; color: inherit; text-decoration-line: underline; text-decoration-style: dashed; text-decoration-thickness: 2px; text-underline-offset: 3px; cursor: help; }
.markdown-content :deep(.hl-foreign-yellow) { text-decoration-color: rgba(234, 179, 8, 0.8); }
.markdown-content :deep(.hl-foreign-green) { text-decoration-color: rgba(34, 197, 94, 0.8); }
.markdown-content :deep(.hl-foreign-blue) { text-decoration-color: rgba(59, 130, 246, 0.8); }
.markdown-content :deep(.hl-foreign-pink) { text-decoration-color: rgba(236, 72, 153, 0.8); }

/* --- Shared icon size for buttons in toolbar / menu --- */
.hl-icon {
  width: 14px; height: 14px; display: inline-block; vertical-align: -2px;
}

/* --- Toolbar --- */
.hl-toolbar {
  position: absolute; z-index: 50; transform: translateX(-50%);
  display: flex; align-items: center; gap: 4px;
  background: var(--popover); color: var(--popover-foreground);
  border: 1px solid var(--border); border-radius: calc(var(--radius) + 2px);
  padding: 4px 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  flex-wrap: wrap; user-select: none; -webkit-user-select: none;
}
.hl-toolbar-colors { display: flex; gap: 4px; }
.hl-color-btn {
  width: 20px; height: 20px; border-radius: 50%; border: 2px solid transparent;
  cursor: pointer; transition: transform 0.1s;
}
.hl-color-btn:hover { transform: scale(1.2); border-color: var(--muted-foreground); }
.hl-btn-yellow { background: rgba(250, 204, 21, 0.7); }
.hl-btn-green { background: rgba(74, 222, 128, 0.7); }
.hl-btn-blue { background: rgba(96, 165, 250, 0.7); }
.hl-btn-pink { background: rgba(244, 114, 182, 0.7); }
.hl-note-toggle {
  background: none; border: none; cursor: pointer;
  color: var(--popover-foreground);
  padding: 4px; border-radius: var(--radius-sm);
  display: inline-flex; align-items: center; justify-content: center;
}
.hl-note-toggle:hover { background: var(--accent); color: var(--accent-foreground); }

/* --- Click Menu --- */
.hl-menu {
  position: absolute; z-index: 50; transform: translateX(-50%);
  background: var(--popover); color: var(--popover-foreground);
  border: 1px solid var(--border); border-radius: calc(var(--radius) + 2px);
  padding: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  min-width: 160px; user-select: none; -webkit-user-select: none;
}
.hl-menu-colors { display: flex; gap: 4px; margin-bottom: 6px; justify-content: center; }
.hl-menu-actions { display: flex; gap: 4px; }
.hl-menu-btn {
  flex: 1; padding: 4px 8px; font-size: 12px;
  display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  background: var(--background); color: var(--foreground);
  border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer;
}
.hl-menu-btn:hover { background: var(--accent); color: var(--accent-foreground); }
.hl-menu-btn-danger { color: var(--destructive); }
.hl-menu-btn-danger:hover { background: color-mix(in oklch, var(--destructive) 12%, transparent); color: var(--destructive); }
</style>
