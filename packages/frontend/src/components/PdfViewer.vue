<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { FileText, ChevronUp, ChevronDown, ZoomIn, ZoomOut, Link2, Loader2, AlertTriangle, MoveHorizontal, MoveVertical, Crop, Languages, X, Copy, RefreshCw, MessageCircleQuestion, Plus, MessagesSquare, List, Image as ImageIcon, Trash2 } from '@lucide/vue'
import type { Highlight, HighlightColor, QAImageInput, QATextSelectionInput, TranslateResponse, TranslationStreamStatus } from '@paperland/shared'
import { toast } from 'vue-sonner'
import { loadPdfjs } from '@/lib/pdfjs'
import {
  createMultiPageSelectionSnapshot,
  createPdfSelectionSnapshot,
  decideOutsidePanelSelection,
  isMultiPageSelection,
  placeSelectionPanel,
  selectPdfTranslationPanelText,
  type PdfSelectionSnapshot,
  type RelativeRect,
} from '@/lib/pdf-selection-translation'
import { buildTextSegments, getRangeOffsets, getSelectionOffsets } from '@/composables/useHighlight'
import { useQAStore } from '@/stores/qa'
import { usePapersStore } from '@/stores/papers'
import { useQAComposer } from '@/composables/useQAComposer'
import { useBlockAnchor } from '@/composables/useBlockAnchor'
import { NO_QA_CONTENT_HINT, paperHasQAContent } from '@/lib/qa-content'
import { defaultFollowupResult } from '@/lib/qa-result-selection'
import MarkdownContent from '@/components/MarkdownContent.vue'
import QAStreamingMarkdown from '@/components/QAStreamingMarkdown.vue'
import { requestedPdfTarget, type PdfNavTarget } from '@/composables/usePdfNavigation'
import { useThemeStore } from '@/stores/theme'
import { useAuthStore } from '@/stores/auth'
import { useHighlightStore } from '@/stores/highlights'
import HighlightScopeToggle from '@/components/HighlightScopeToggle.vue'
import { configApi } from '@/api/client'
import { uploadImage } from '@/utils/uploadImage'
import StreamingTranslationText from '@/components/StreamingTranslationText.vue'
import 'pdfjs-dist/web/pdf_viewer.css'

const props = defineProps<{ pdfPath: string | null; paperId?: number | null }>()

const rawUrl = computed(() => (props.pdfPath ? `/api/files/${encodeURIComponent(props.pdfPath)}` : null))

const theme = useThemeStore()
const auth = useAuthStore()
const hlStore = useHighlightStore()
const qaStore = useQAStore()
const paperStore = usePapersStore()
const composer = useQAComposer()
const { revealQAEntry } = useBlockAnchor()
// Dark-mode PDF page colors (gray background, near-white text). Passed to pdf.js as
// `pageColors`, which recolors inside the canvas raster. Keep the gray in sync with the
// `.pdf-page` dark background in <style> so the loading gutter matches the page.
const DARK_PAGE_COLORS = { background: '#3a3a3a', foreground: '#e8e8e8' }

// ---- Document & page state ----
// pdf.js objects are intentionally non-reactive (Vue should not proxy them).
let pdfjs: Awaited<ReturnType<typeof loadPdfjs>> | null = null
let pdfDoc: any = null
let loadingTask: any = null

const loading = ref(true)
const error = ref(false)
const numPages = ref(0)
const currentPage = ref(1)
/** Per-page placeholder size in PDF points (scale 1); CSS size = wPt * effectiveScale. */
const pages = ref<{ num: number; wPt: number; hPt: number }[]>([])

const viewerRef = ref<HTMLElement | null>(null)

// ---- Scale: effectiveScale = fitScale (fit width) * zoom ----
const fitScale = ref(1)
const zoom = ref(1)
// Fit-to-width (default) vs fit-to-height. Per-session only — resets when the viewer remounts.
const fitMode = ref<'width' | 'height'>('width')
const effectiveScale = computed(() => Math.max(0.2, fitScale.value * zoom.value))
const zoomPct = computed(() => Math.round(zoom.value * 100))

const PAGE_PAD = 24 // breathing room around the page when fitting

function updateFit() {
  const root = viewerRef.value
  const first = pages.value[0]
  if (!root || !first || first.wPt <= 0 || first.hPt <= 0) return
  if (fitMode.value === 'height') {
    const avail = root.clientHeight - PAGE_PAD
    if (avail > 0) fitScale.value = avail / first.hPt
  } else {
    const avail = root.clientWidth - PAGE_PAD
    if (avail > 0) fitScale.value = avail / first.wPt
  }
}

/** Toggle fit-to-width ↔ fit-to-height (resets zoom so the new fit is exact). */
function toggleFitMode() {
  fitMode.value = fitMode.value === 'width' ? 'height' : 'width'
  zoom.value = 1
  updateFit()
}

/**
 * Page box + the CSS variables pdf.js 5's TextLayer sizes itself with. pdf.js's own viewer sets
 * `--total-scale-factor` on each page; without it every text span's `font-size` is invalid, so
 * the selectable text drifts off the canvas glyphs. Binding it to the live effectiveScale keeps
 * the text layer aligned while a zoom is CSS-scaled and waiting for its debounced re-raster.
 */
function pageStyle(p: { wPt: number; hPt: number }) {
  const sc = effectiveScale.value
  return {
    width: `${p.wPt * sc}px`,
    height: `${p.hPt * sc}px`,
    '--total-scale-factor': String(sc),
    '--scale-round-x': '1px',
    '--scale-round-y': '1px',
  }
}

// ---- Rendering (lazy, scale-aware) ----
const rendered = new Map<number, { scale: number; dark: boolean; canvas: HTMLCanvasElement; textLayer: HTMLElement }>()
const renderTasks = new Map<number, { task: any; scale: number; dark: boolean }>()

function pageEl(num: number): HTMLElement | null {
  return viewerRef.value?.querySelector<HTMLElement>(`[data-pdf-page="${num}"]`) ?? null
}

async function renderPage(num: number) {
  const el = pageEl(num)
  if (!el || !pdfjs || !pdfDoc) return
  const sc = effectiveScale.value
  const dark = theme.resolved === 'dark'
  const ex = rendered.get(num)
  // Already rendered at this scale AND theme — nothing to do.
  if (ex && ex.scale === sc && ex.dark === dark) return
  // A render at this exact scale+theme is already in flight.
  const inflight = renderTasks.get(num)
  if (inflight && inflight.scale === sc && inflight.dark === dark) return
  inflight?.task?.cancel?.()

  let renderTask: any = null
  try {
    const page = await pdfDoc.getPage(num)
    const viewport = page.getViewport({ scale: sc })

    // Correct the placeholder from the page's true size (papers are usually uniform).
    const p = pages.value.find((q) => q.num === num)
    if (p) { p.wPt = viewport.width / sc; p.hPt = viewport.height / sc }

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    // Render into a FRESH, off-DOM canvas. pdf.js fills the canvas white at the start of every
    // render and only applies the dark `pageColors` (HCM) filter at the very end; if the canvas
    // were already live in the DOM the browser would paint that white-then-dark transition as a
    // flash. By rendering off-DOM and swapping the finished (already-dark) canvas in afterwards,
    // no intermediate frame is ever shown. The previous canvas stays visible until the swap, so
    // theme toggles and zoom re-rasters never blank or flash either.
    const canvas = document.createElement('canvas')
    canvas.className = 'pdf-canvas'
    canvas.width = Math.floor(viewport.width * dpr)
    canvas.height = Math.floor(viewport.height * dpr)

    renderTask = page.render({
      canvas,
      viewport,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      pageColors: dark ? DARK_PAGE_COLORS : undefined,
    })
    renderTasks.set(num, { task: renderTask, scale: sc, dark })
    await renderTask.promise

    // Swap the finished canvas in, replacing the previous one (or appending on first render).
    if (ex?.canvas && ex.canvas.parentNode) ex.canvas.replaceWith(canvas)
    else el.appendChild(canvas)

    // Text layer (selectable, transparent overlay aligned to the canvas).
    const textLayer = ex?.textLayer ?? document.createElement('div')
    if (!ex?.textLayer) { textLayer.className = 'textLayer'; el.appendChild(textLayer) }
    textLayer.replaceChildren()
    // Span font sizes and layer dimensions come from `--total-scale-factor` on the page element
    // (bound to effectiveScale in the template), so the text layer tracks CSS-scaled zooms too.
    const textContent = await page.getTextContent()
    await new pdfjs.TextLayer({ textContentSource: textContent, container: textLayer, viewport }).render()

    rendered.set(num, { scale: sc, dark, canvas, textLayer })
    renderHighlightLayer(num)
  } catch {
    // RenderingCancelledException (zoom/scroll/theme churn) — ignore; a later pass re-renders.
  } finally {
    // Only clear if this very task is still the registered one (a newer render may have replaced it).
    if (renderTasks.get(num)?.task === renderTask) renderTasks.delete(num)
  }
}

function unrenderPage(num: number) {
  renderTasks.get(num)?.task?.cancel?.()
  renderTasks.delete(num)
  const ex = rendered.get(num)
  if (ex) { ex.canvas.remove(); ex.textLayer.remove(); rendered.delete(num) }
  pageEl(num)?.querySelector(':scope > .pdf-hl-layer')?.remove()
  hlHits.delete(num)
}

/** Force a page to be rendered at the current scale and wait until its text layer exists. */
async function ensurePageRendered(num: number) {
  void renderPage(num)
  const start = performance.now()
  while (rendered.get(num)?.scale !== effectiveScale.value) {
    if (performance.now() - start > 4000) break
    await new Promise((r) => requestAnimationFrame(r))
  }
}

// ---- IntersectionObserver: render near viewport, unrender when far ----
let io: IntersectionObserver | null = null

function setupObserver() {
  io?.disconnect()
  if (!viewerRef.value) return
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const num = Number((e.target as HTMLElement).dataset.pdfPage)
        if (!num) continue
        if (e.isIntersecting) renderPage(num)
        else unrenderPage(num)
      }
    },
    { root: viewerRef.value, rootMargin: '200% 0px' },
  )
  for (const el of viewerRef.value.querySelectorAll('.pdf-page')) io.observe(el)
}

// ---- Current page tracking (most-visible page) ----
let scrollRaf = 0
function onScroll() {
  if (scrollRaf) return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    updateCurrentPage()
    repositionSelectionUi()
  })
}

function updateCurrentPage() {
  const root = viewerRef.value
  if (!root) return
  const r = root.getBoundingClientRect()
  const center = r.top + r.height / 2
  for (const p of pages.value) {
    const el = pageEl(p.num)
    if (!el) continue
    const pr = el.getBoundingClientRect()
    if (pr.top <= center && pr.bottom >= center) { currentPage.value = p.num; return }
    if (pr.top > center) { currentPage.value = p.num; return }
  }
  if (pages.value.length) currentPage.value = pages.value[pages.value.length - 1].num
}

// ---- Navigation (scroll + transient region highlight) ----
let pending: PdfNavTarget | null = null

function scrollToPage(num: number) {
  pageEl(num)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** Map page-text offsets to client rects via the rendered text layer (reuses highlight segments). */
function offsetsToRects(textLayer: HTMLElement, start: number, end: number): DOMRect[] {
  const range = offsetsToRange(textLayer, start, end)
  return range ? Array.from(range.getClientRects()) : []
}

/** A DOM Range over a page-text offset range in a page's text layer (null if unmappable). */
function offsetsToRange(textLayer: HTMLElement, start: number, end: number): Range | null {
  const segs = buildTextSegments(textLayer)
  if (!segs.length) return null
  // A start offset on a node boundary maps to the START of the next node (not the end of the
  // previous one), so the range doesn't begin with a stray line break / empty previous-line rect.
  const at = (offset: number, isStart = false) => {
    for (const s of segs) {
      if (isStart ? offset < s.offset + s.length : offset <= s.offset + s.length) {
        return { node: s.node, local: Math.min(s.length, Math.max(0, offset - s.offset)) }
      }
    }
    const last = segs[segs.length - 1]
    return { node: last.node, local: last.length }
  }
  const a = at(start, true), b = at(end)
  const range = document.createRange()
  try {
    range.setStart(a.node, Math.min(a.local, (a.node.textContent || '').length))
    range.setEnd(b.node, Math.min(b.local, (b.node.textContent || '').length))
  } catch { return null }
  return range
}

/** Draw a transient (non-persisted) highlight over a page-text offset range. Returns false if not found. */
function highlightRegion(num: number, ts: number, te: number): boolean {
  const ex = rendered.get(num)
  const el = pageEl(num)
  if (!ex || !el) return false
  const rects = offsetsToRects(ex.textLayer, ts, te)
  if (!rects.length) return false
  const pr = el.getBoundingClientRect()
  let first: HTMLElement | null = null
  for (const rc of rects) {
    const d = document.createElement('div')
    d.className = 'pdf-region-flash'
    d.style.left = `${rc.left - pr.left}px`
    d.style.top = `${rc.top - pr.top}px`
    d.style.width = `${rc.width}px`
    d.style.height = `${rc.height}px`
    el.appendChild(d)
    first ??= d
    window.setTimeout(() => d.remove(), 2200)
  }
  first?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  return true
}

/** Draw a transient highlight over a normalized `[0,1]` page-space rectangle. Returns false if not renderable. */
function highlightRect(num: number, rect: { x: number; y: number; w: number; h: number }): boolean {
  const el = pageEl(num)
  if (!el || !(rect.w > 0) || !(rect.h > 0)) return false
  const pr = el.getBoundingClientRect()
  const d = document.createElement('div')
  d.className = 'pdf-region-flash'
  d.style.left = `${rect.x * pr.width}px`
  d.style.top = `${rect.y * pr.height}px`
  d.style.width = `${rect.w * pr.width}px`
  d.style.height = `${rect.h * pr.height}px`
  el.appendChild(d)
  window.setTimeout(() => d.remove(), 2200)
  d.scrollIntoView({ behavior: 'smooth', block: 'center' })
  return true
}

async function applyTarget(target: PdfNavTarget | null) {
  if (!target) return
  if (loading.value || !pdfDoc) { pending = target; return }
  const num = Math.min(Math.max(1, Math.round(target.page)), numPages.value || 1)
  await ensurePageRendered(num)
  await nextTick()
  // Rectangle target wins over a text-offset region.
  if (target.rect) {
    if (!highlightRect(num, target.rect)) {
      scrollToPage(num)
      toast.error('Anchor is stale — the region was not found on this page.', { position: 'bottom-center' })
    }
  } else if (target.ts != null && target.te != null) {
    if (!highlightRegion(num, target.ts, target.te)) {
      scrollToPage(num)
      toast.error('Anchor is stale — the selection was not found on this page.', { position: 'bottom-center' })
    }
  } else {
    scrollToPage(num)
  }
  currentPage.value = num
}

// ---- Toolbar actions ----
function goToPage(num: number) {
  const n = Math.min(Math.max(1, Math.round(num)), numPages.value || 1)
  currentPage.value = n
  void ensurePageRendered(n).then(() => scrollToPage(n))
}
function prevPage() { goToPage(currentPage.value - 1) }
function nextPage() { goToPage(currentPage.value + 1) }
function onJumpInput(e: Event) {
  const v = parseInt((e.target as HTMLInputElement).value, 10)
  if (!Number.isNaN(v)) goToPage(v)
}

function zoomIn() { zoom.value = Math.min(3, +(zoom.value * 1.2).toFixed(3)) }
function zoomOut() { zoom.value = Math.max(0.4, +(zoom.value / 1.2).toFixed(3)) }

function copyPageLink() {
  if (!props.paperId) return
  const url = `paperland://paper/${props.paperId}?pdf=${currentPage.value}`
  navigator.clipboard.writeText(`[PDF p.${currentPage.value}](${url})`)
  toast.success('已复制本页链接', { position: 'bottom-center' })
}

// ---- Selection capture → toolbar (copy link + on-demand streaming translation) ----
const selRegion = ref<{ page: number; ts: number; te: number; text: string } | null>(null)
const showSelToolbar = ref(false)
/** The current selection spans pages: only the ask actions apply (translate/copy-link are single-page). */
const selMultiPage = ref(false)
const selToolbarRef = ref<HTMLElement | null>(null)
const selBtnPos = ref({ x: 0, y: 0 })
let selTimer: ReturnType<typeof setTimeout> | null = null
let selectionRange: Range | null = null
let currentSelection: PdfSelectionSnapshot | null = null

const activeTranslation = ref<PdfSelectionSnapshot | null>(null)
const translationKey = ref(0)
const translationForce = ref(false)
const translationStatus = ref<TranslationStreamStatus>('idle')
const translationText = ref('')
const translationError = ref<string | null>(null)
const translationPanelRef = ref<HTMLElement | null>(null)
const translationPanelPos = ref({ left: 8, top: 8, width: 320, placement: 'above' as 'above' | 'below' })
let translationPanelRo: ResizeObserver | null = null
type SelectionInteractionOwner = 'panel' | 'outside' | null
let selectionInteractionOwner: SelectionInteractionOwner = null
let outsideInteractionSourceIdentity: string | null = null
let outsideInteractionTimer: ReturnType<typeof setTimeout> | null = null
const OUTSIDE_INTERACTION_SETTLE_MS = 80

function resetSelectionInteraction() {
  if (outsideInteractionTimer) clearTimeout(outsideInteractionTimer)
  outsideInteractionTimer = null
  selectionInteractionOwner = null
  outsideInteractionSourceIdentity = null
}

function viewerRoot(): HTMLElement | null {
  return viewerRef.value?.closest<HTMLElement>('.pdf-viewer-root') ?? null
}

function closeTranslationPanel() {
  resetSelectionInteraction()
  activeTranslation.value = null
  translationText.value = ''
  translationError.value = null
  translationStatus.value = 'idle'
  translationKey.value++ // unmounting/re-keying aborts any active StreamingTranslationText
}

function clearSelectionUi() {
  showSelToolbar.value = false
  selRegion.value = null
  selectionRange = null
  currentSelection = null
  closeTranslationPanel()
}

function relativeSelectionRect(range: Range): RelativeRect | null {
  const outer = viewerRoot()
  if (!outer) return null
  const rr = range.getBoundingClientRect()
  const vr = outer.getBoundingClientRect()
  if (rr.width <= 0 || rr.height <= 0) return null
  return {
    left: rr.left - vr.left,
    top: rr.top - vr.top,
    right: rr.right - vr.left,
    bottom: rr.bottom - vr.top,
    width: rr.width,
    height: rr.height,
  }
}

function readPdfSelection(): { snapshot: PdfSelectionSnapshot; range: Range } | null {
  const scroll = viewerRef.value
  if (!scroll || captureMode.value) return null
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  const elOf = (node: Node) => (node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement)
  const startPage = elOf(range.startContainer)?.closest('.pdf-page') as HTMLElement | null
  const endPage = elOf(range.endContainer)?.closest('.pdf-page') as HTMLElement | null
  if (!startPage || !endPage || !scroll.contains(startPage) || !scroll.contains(endPage)) return null
  if (startPage !== endPage) return readMultiPageSelection(scroll, range, startPage, endPage)
  const textLayer = startPage.querySelector<HTMLElement>('.textLayer')
  if (!textLayer || !textLayer.contains(range.startContainer) || !textLayer.contains(range.endContainer)) return null
  const offsets = getSelectionOffsets(textLayer)
  const rect = relativeSelectionRect(range)
  if (!offsets || !rect) return null
  const snapshot = createPdfSelectionSnapshot({
    page: Number(startPage.dataset.pdfPage),
    ts: offsets.start_offset,
    te: offsets.end_offset,
    text: offsets.text,
    rect,
  })
  return snapshot ? { snapshot, range: range.cloneRange() } : null
}

/**
 * A selection continuing across pages (a paragraph broken by a page break): one offset segment per
 * page, measured on sub-ranges clipped to each page's text layer. Only the ask actions use it.
 */
function readMultiPageSelection(
  scroll: HTMLElement, range: Range, startPage: HTMLElement, endPage: HTMLElement,
): { snapshot: PdfSelectionSnapshot; range: Range } | null {
  const pageEls = Array.from(scroll.querySelectorAll<HTMLElement>('.pdf-page'))
  const from = pageEls.indexOf(startPage)
  const to = pageEls.indexOf(endPage)
  const startLayer = startPage.querySelector<HTMLElement>('.textLayer')
  const endLayer = endPage.querySelector<HTMLElement>('.textLayer')
  if (from < 0 || to <= from || !startLayer?.contains(range.startContainer) || !endLayer?.contains(range.endContainer)) return null
  const segments = []
  for (let i = from; i <= to; i += 1) {
    const layer = pageEls[i].querySelector<HTMLElement>('.textLayer')
    if (!layer) continue
    const sub = document.createRange()
    if (i === from) sub.setStart(range.startContainer, range.startOffset)
    else sub.setStart(layer, 0)
    if (i === to) sub.setEnd(range.endContainer, range.endOffset)
    else sub.setEnd(layer, layer.childNodes.length)
    const offsets = getRangeOffsets(layer, sub)
    if (offsets) segments.push({ page: Number(pageEls[i].dataset.pdfPage), ts: offsets.start_offset, te: offsets.end_offset, text: offsets.text })
  }
  const rect = relativeSelectionRect(range)
  const snapshot = rect ? createMultiPageSelectionSnapshot(segments, rect) : null
  return snapshot ? { snapshot, range: range.cloneRange() } : null
}

function updateTranslationPanelPlacement() {
  const outer = viewerRoot()
  const snapshot = activeTranslation.value
  if (!outer || !snapshot) return
  const measured = translationPanelRef.value?.getBoundingClientRect()
  translationPanelPos.value = placeSelectionPanel({
    viewerWidth: outer.clientWidth,
    viewerHeight: outer.clientHeight,
    selection: snapshot.rect,
    panelWidth: measured?.width || 340,
    panelHeight: measured?.height || 120,
  })
}

function activateTranslation(snapshot: PdfSelectionSnapshot) {
  if (!auth.isAuthenticated || captureMode.value || currentSelection?.identity !== snapshot.identity) return
  resetSelectionInteraction()
  closeAskPanel()
  activeTranslation.value = { ...snapshot, rect: { ...snapshot.rect } }
  translationForce.value = false
  translationText.value = ''
  translationError.value = null
  translationStatus.value = 'connecting'
  translationKey.value++
  void nextTick(updateTranslationPanelPlacement)
}

/** Toolbar 「翻译」: the only entry point that starts a selection translation. */
function translateSelection() {
  const snapshot = currentSelection
  if (!snapshot || isMultiPageSelection(snapshot) || activeTranslation.value?.identity === snapshot.identity) return
  activateTranslation(snapshot)
}

function syncActiveTranslation(snapshot: PdfSelectionSnapshot) {
  const active = activeTranslation.value
  if (!active) return
  if (!auth.isAuthenticated || captureMode.value || active.identity !== snapshot.identity) {
    closeTranslationPanel()
    return
  }
  activeTranslation.value = { ...active, rect: { ...snapshot.rect } }
  updateTranslationPanelPlacement()
}

function hideSelBtn() { clearSelectionUi() }

function onSelectionChange() {
  if (selTimer) clearTimeout(selTimer)
  selTimer = setTimeout(handleSelectionSettled, 60)
}

function handleSelectionSettled() {
  const captured = readPdfSelection()
  if (!captured) {
    if (activeTranslation.value && selectionInteractionOwner) return
    return hideSelBtn()
  }
  const { snapshot, range } = captured
  if (selectionInteractionOwner === 'panel' && activeTranslation.value?.identity !== snapshot.identity) {
    resetSelectionInteraction()
  }
  currentSelection = snapshot
  selectionRange = range
  selRegion.value = {
    page: snapshot.page,
    ts: snapshot.ts,
    te: snapshot.te,
    text: snapshot.text,
  }
  selBtnPos.value = {
    x: snapshot.rect.left + snapshot.rect.width / 2,
    y: snapshot.rect.bottom + 6,
  }
  selMultiPage.value = isMultiPageSelection(snapshot)
  showSelToolbar.value = !!props.paperId || auth.isAuthenticated
  syncActiveTranslation(snapshot)
}

function onDocumentPointerDown(event: PointerEvent) {
  const active = activeTranslation.value
  if (!active) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (translationPanelRef.value?.contains(target) || selToolbarRef.value?.contains(target)) {
    resetSelectionInteraction()
    selectionInteractionOwner = 'panel'
    return
  }
  resetSelectionInteraction()
  selectionInteractionOwner = 'outside'
  outsideInteractionSourceIdentity = active.identity
}

function onDocumentPointerUp() {
  if (selectionInteractionOwner !== 'outside' || !outsideInteractionSourceIdentity) return
  const sourceIdentity = outsideInteractionSourceIdentity
  if (outsideInteractionTimer) clearTimeout(outsideInteractionTimer)
  outsideInteractionTimer = setTimeout(() => {
    if (selectionInteractionOwner !== 'outside' || outsideInteractionSourceIdentity !== sourceIdentity) return
    const settled = readPdfSelection()
    const decision = decideOutsidePanelSelection(sourceIdentity, settled?.snapshot.identity ?? null)
    resetSelectionInteraction()
    if (decision === 'keep_for_new_selection') {
      handleSelectionSettled()
      return
    }
    hideSelBtn()
  }, OUTSIDE_INTERACTION_SETTLE_MS)
}

function repositionSelectionUi() {
  if (!currentSelection) return
  const captured = readPdfSelection()
  if (!captured || captured.snapshot.identity !== currentSelection.identity) return hideSelBtn()
  currentSelection = captured.snapshot
  selectionRange = captured.range
  selBtnPos.value = {
    x: captured.snapshot.rect.left + captured.snapshot.rect.width / 2,
    y: captured.snapshot.rect.bottom + 6,
  }
  if (activeTranslation.value?.identity === captured.snapshot.identity) {
    activeTranslation.value = { ...activeTranslation.value, rect: { ...captured.snapshot.rect } }
    updateTranslationPanelPlacement()
  }
}

function retrySelectionTranslation() {
  if (!activeTranslation.value || currentSelection?.identity !== activeTranslation.value.identity) return
  translationForce.value = true
  translationText.value = ''
  translationError.value = null
  translationStatus.value = 'connecting'
  translationKey.value++
}

function restorePdfSelection() {
  if (!selectionRange || !currentSelection) return
  try {
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(selectionRange.cloneRange())
  } catch {
    hideSelBtn()
  }
}

async function copySelectionTranslation() {
  if (!translationText.value) return
  await navigator.clipboard.writeText(translationText.value)
  toast.success('已复制翻译', { position: 'bottom-center' })
}

function onTranslationStatus(status: TranslationStreamStatus) {
  translationStatus.value = status
  void nextTick(updateTranslationPanelPlacement)
}

function onTranslationDelta(delta: string) {
  translationText.value += delta
  void nextTick(updateTranslationPanelPlacement)
}

function onTranslationDone(result: TranslateResponse) {
  translationText.value = result.translated_text || ''
  translationError.value = null
  translationStatus.value = 'completed'
  void nextTick(updateTranslationPanelPlacement)
}

function onTranslationError(error: Error) {
  translationError.value = error.message
  translationStatus.value = 'failed'
  void nextTick(updateTranslationPanelPlacement)
}

function copySelectionLink() {
  if (!props.paperId || !selRegion.value) return
  const { page, ts, te, text } = selRegion.value
  const url = `paperland://paper/${props.paperId}?pdf=${page}&ts=${ts}&te=${te}`
  navigator.clipboard.writeText(`${text.trim()} [#](${url})`)
  toast.success('已复制选区链接', { position: 'bottom-center' })
  window.getSelection()?.removeAllRanges()
  hideSelBtn()
}

// ---- Persistent PDF highlights (per user; stored in the shared `highlights` table) ----
// A PDF highlight is a regular highlight row on the paper's pathname (`/papers/<id>`, which
// PaperDetail already loads into the store) whose `content_hash` is `pdf:<fingerprint>:<page>`
// and whose offsets are the page-text `ts/te`. The fingerprint ties offsets to this exact file,
// so highlights made on a replaced PDF are simply not drawn. Scope (mine/all) is the store's.
const HL_COLORS: { key: HighlightColor; label: string }[] = [
  { key: 'yellow', label: '黄色' }, { key: 'green', label: '绿色' },
  { key: 'blue', label: '蓝色' }, { key: 'pink', label: '粉色' },
]
const pdfFingerprint = ref<string | null>(null)
const hlPathname = computed(() => (props.paperId ? `/papers/${props.paperId}` : null))
const hlEnabled = computed(() => auth.isAuthenticated && !!props.paperId && !!pdfFingerprint.value)

/** This file's highlights grouped by page. */
const pdfHighlightsByPage = computed(() => {
  const map = new Map<number, Highlight[]>()
  const fp = pdfFingerprint.value
  if (!fp || !hlPathname.value || !auth.isAuthenticated || hlStore.currentPathname !== hlPathname.value) return map
  const prefix = `pdf:${fp}:`
  for (const h of hlStore.highlights) {
    if (!h.content_hash.startsWith(prefix)) continue
    const page = Number(h.content_hash.slice(prefix.length))
    if (!Number.isInteger(page)) continue
    const list = map.get(page) ?? []
    list.push(h)
    map.set(page, list)
  }
  return map
})

const isOwnHighlight = (h: Highlight) => h.user_id != null && h.user_id === auth.user?.id

/** Per rendered page: each highlight's rects in [0,1] page space (for click / hover hit-testing). */
const hlHits = new Map<number, { h: Highlight; rects: { x: number; y: number; w: number; h: number }[] }[]>()

/** (Re)draw a rendered page's highlight overlay, positioned in % of the page so CSS zoom keeps it aligned. */
function renderHighlightLayer(num: number) {
  const ex = rendered.get(num)
  const el = pageEl(num)
  if (!ex || !el) return
  let layer = el.querySelector<HTMLElement>(':scope > .pdf-hl-layer')
  const list = pdfHighlightsByPage.value.get(num) ?? []
  hlHits.delete(num)
  if (!list.length) { layer?.remove(); return }
  if (!layer) {
    layer = document.createElement('div')
    layer.className = 'pdf-hl-layer'
    el.appendChild(layer)
  }
  layer.replaceChildren()
  const pr = el.getBoundingClientRect()
  if (!pr.width || !pr.height) return
  const hits: { h: Highlight; rects: { x: number; y: number; w: number; h: number }[] }[] = []
  for (const h of [...list].sort((a, b) => a.id - b.id)) {
    const own = isOwnHighlight(h)
    const rects = []
    for (const rc of offsetsToRects(ex.textLayer, h.start_offset, h.end_offset)) {
      if (rc.width < 1 || rc.height < 1) continue
      const r = { x: (rc.left - pr.left) / pr.width, y: (rc.top - pr.top) / pr.height, w: rc.width / pr.width, h: rc.height / pr.height }
      rects.push(r)
      const d = document.createElement('div')
      d.className = `pdf-hl pdf-hl-${h.color}${own ? '' : ' pdf-hl-foreign'}`
      d.style.left = `${r.x * 100}%`
      d.style.top = `${r.y * 100}%`
      d.style.width = `${r.w * 100}%`
      d.style.height = `${r.h * 100}%`
      layer.appendChild(d)
    }
    if (rects.length) hits.push({ h, rects })
  }
  hlHits.set(num, hits)
}

watch(pdfHighlightsByPage, () => { for (const num of rendered.keys()) renderHighlightLayer(num) })

// PaperDetail loads the paper's highlights; load them here too if the store holds another page's.
watch([hlPathname, () => auth.isAuthenticated], ([path, authed]) => {
  if (path && authed && hlStore.currentPathname !== path) void hlStore.loadForPathname(path)
}, { immediate: true })

/** Topmost (latest) highlight under a client point, or null. */
function highlightAtPoint(clientX: number, clientY: number): { page: number; h: Highlight } | null {
  const el = pageElAtPoint(clientX, clientY)
  if (!el) return null
  const page = Number(el.dataset.pdfPage)
  const hits = hlHits.get(page)
  if (!hits?.length) return null
  const pr = el.getBoundingClientRect()
  const x = (clientX - pr.left) / pr.width, y = (clientY - pr.top) / pr.height
  for (let i = hits.length - 1; i >= 0; i--) {
    if (hits[i].rects.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)) return { page, h: hits[i].h }
  }
  return null
}

/** Plain click on a highlight → select its passage so the normal selection toolbar opens for it. */
function onPageClick(e: MouseEvent) {
  if (captureMode.value || e.button !== 0 || e.detail > 1) return
  const sel = window.getSelection()
  if (sel && !sel.isCollapsed) return
  const hit = highlightAtPoint(e.clientX, e.clientY)
  const ex = hit ? rendered.get(hit.page) : null
  if (!hit || !ex) return
  const range = offsetsToRange(ex.textLayer, hit.h.start_offset, hit.h.end_offset)
  if (!range || !sel) return
  sel.removeAllRanges()
  sel.addRange(range)
}

/** Show the owner of another user's highlight on hover (the overlay itself ignores pointer events). */
let hoverRaf = 0
function onPageHover(e: MouseEvent) {
  if (hoverRaf || captureMode.value) return
  const { clientX, clientY } = e
  hoverRaf = requestAnimationFrame(() => {
    hoverRaf = 0
    const root = viewerRef.value
    if (!root) return
    const hit = highlightAtPoint(clientX, clientY)
    const title = hit && !isOwnHighlight(hit.h) ? `${hit.h.display_name ?? hit.h.username ?? '其他用户'} 的高亮` : ''
    if (root.title !== title) root.title = title
  })
}

/** The user's own highlight exactly matching the current single-page selection, if any. */
const selOwnHighlight = computed(() => {
  const r = selRegion.value
  if (!r || selMultiPage.value) return null
  return (pdfHighlightsByPage.value.get(r.page) ?? [])
    .filter((h) => isOwnHighlight(h) && h.start_offset === r.ts && h.end_offset === r.te)
    .sort((a, b) => b.id - a.id)[0] ?? null
})

function finishHighlightAction() {
  window.getSelection()?.removeAllRanges()
  hideSelBtn()
}

async function applyHighlightColor(color: HighlightColor) {
  const r = selRegion.value
  const fp = pdfFingerprint.value
  if (!r || !fp || !hlPathname.value || selMultiPage.value) return
  const own = selOwnHighlight.value
  try {
    if (own) {
      if (own.color !== color) await hlStore.update(own.id, { color })
    } else {
      await hlStore.create({
        pathname: hlPathname.value, content_hash: `pdf:${fp}:${r.page}`,
        start_offset: r.ts, end_offset: r.te, text: r.text, color,
      })
    }
    finishHighlightAction()
  } catch {
    toast.error('高亮保存失败，请重试', { position: 'bottom-center' })
  }
}

async function deleteSelHighlight() {
  const own = selOwnHighlight.value
  if (!own) return
  try {
    await hlStore.remove(own.id)
    finishHighlightAction()
  } catch {
    toast.error('删除高亮失败，请重试', { position: 'bottom-center' })
  }
}

// ---- Contextual Q&A: ask directly, or add the passage/screenshot to the question box ----
/** Ask actions need a logged-in user, a paper, and a paper with usable full text. */
const showAskActions = computed(() => auth.isAuthenticated && !!props.paperId)
const askDisabled = computed(() => {
  const paper = paperStore.currentPaper
  return !(paper && paper.id === props.paperId && paperHasQAContent(paper))
})
const askHint = computed(() => (askDisabled.value ? NO_QA_CONTENT_HINT : ''))

const askPanelRef = ref<HTMLElement | null>(null)
const askPanel = ref<{
  entryId: number | null
  preview: { kind: 'text'; text: string } | { kind: 'image'; url: string }
  rect: RelativeRect
  error: string | null
} | null>(null)
const askPanelPos = ref({ left: 8, top: 8, width: 360, placement: 'above' as 'above' | 'below' })

/** The streamed answer of the direct ask, read from the paper's Q&A list (kept live by the store). */
const askEntry = computed(() => {
  const id = askPanel.value?.entryId
  return id == null ? null : qaStore.qaData.free.find((entry) => entry.entry_id === id) ?? null
})
const askResult = computed(() => askEntry.value?.results[0] ?? null)
/** No answer is chosen in the panel, so a follow-up continues the latest completed one. */
const askFollowupTarget = computed(() => (askEntry.value ? defaultFollowupResult(askEntry.value.results) : null))

function updateAskPanelPlacement() {
  const outer = viewerRoot()
  if (!outer || !askPanel.value) return
  const measured = askPanelRef.value?.getBoundingClientRect()
  askPanelPos.value = placeSelectionPanel({
    viewerWidth: outer.clientWidth,
    viewerHeight: outer.clientHeight,
    selection: askPanel.value.rect,
    panelWidth: measured?.width || 380,
    panelHeight: measured?.height || 160,
  })
}

function closeAskPanel() { askPanel.value = null }

/** Submit a direct ask (preset question, default model) and stream its answer near the source. */
async function startDirectAsk(
  input: Omit<QATextSelectionInput, 'label'> | Omit<QAImageInput, 'label' | 'url'>,
  preview: { kind: 'text'; text: string } | { kind: 'image'; url: string },
  rect: RelativeRect,
) {
  if (!props.paperId || askDisabled.value) return
  closeTranslationPanel()
  askPanel.value = { entryId: null, preview, rect, error: null }
  void nextTick(updateAskPanelPlacement)
  try {
    const res = await qaStore.askDirect(props.paperId, input)
    if (!res) { closeAskPanel(); return } // cancelled at the doc2x confirmation
    if (askPanel.value) askPanel.value.entryId = res.entry_id
  } catch (e) {
    if (askPanel.value) askPanel.value.error = e instanceof Error ? e.message : '提问失败'
  }
  void nextTick(updateAskPanelPlacement)
}

function selectionInput(): Omit<QATextSelectionInput, 'label'> | null {
  const snapshot = currentSelection
  if (!snapshot) return null
  return { kind: 'text_selection', text: snapshot.text, pdf: snapshot.segments.map(({ page, ts, te }) => ({ page, ts, te })) }
}

/** Toolbar 「提问」: ask about the selected passage right away. */
function askSelection() {
  const input = selectionInput()
  const snapshot = currentSelection
  if (!input || !snapshot) return
  const rect = { ...snapshot.rect }
  window.getSelection()?.removeAllRanges()
  hideSelBtn()
  void startDirectAsk(input, { kind: 'text', text: input.text }, rect)
}

/** Toolbar 「加入提问框」: attach the passage to the question box (token inserted at the caret). */
function addSelectionToQuestion() {
  const input = selectionInput()
  if (!input || askDisabled.value) return
  composer.addAttachment(input)
  window.getSelection()?.removeAllRanges()
  hideSelBtn()
}

/** Continue the direct-ask answer in the question box (also from its #moonlight suggestions). */
function followUpAsk(prefill?: string) {
  const entry = askEntry.value
  const result = askFollowupTarget.value
  if (!entry || !result) return
  void composer.startFollowup({
    result_id: result.id, entry_id: entry.entry_id, title: entry.prompt || `QA-${entry.entry_id}`, model_name: result.model_name,
  }, prefill)
}

function showAskInList() {
  if (askEntry.value) void revealQAEntry(askEntry.value.entry_id, askResult.value?.id ?? null)
}

watch(() => [askResult.value?.answer.length, askResult.value?.status], () => { void nextTick(updateAskPanelPlacement) })

// ---- Region screenshot: crop a normalized page region to a PNG data URL ----
// Renders ONLY the selected region (not the whole page then crop) so a high-DPI
// capture stays cheap in memory. `scale = dpi / 72` because PDF user-space units are
// 1/72 inch, so scale 1 ≈ 72 DPI. A translation transform shifts the region's top-left
// to the canvas origin so pdf.js paints just that slice.
async function cropRegionToImage(
  region: { page: number; x: number; y: number; w: number; h: number },
  dpi: number,
): Promise<string | null> {
  if (!pdfjs || !pdfDoc) return null
  const page = await pdfDoc.getPage(region.page)
  const scale = Math.max(0.1, dpi / 72)
  const viewport = page.getViewport({ scale })
  const sx = region.x * viewport.width, sy = region.y * viewport.height
  const sw = Math.max(1, region.w * viewport.width), sh = Math.max(1, region.h * viewport.height)
  const out = document.createElement('canvas')
  out.width = Math.round(sw)
  out.height = Math.round(sh)
  await page.render({
    canvas: out,
    viewport,
    // Shift the page so the region's origin lands at (0,0) of the region-sized canvas.
    transform: [1, 0, 0, 1, -sx, -sy],
  }).promise
  return out.toDataURL('image/png')
}
defineExpose({ cropRegionToImage })

// ---- Region capture mode (toolbar "framing screenshot" → image host) ----
// Default DPI comes from config.yml (single source of truth), fetched once on mount;
// 300 is only a fallback if the request fails. Never hardcode the capture quality here.
const screenshotDpi = ref(300)

const captureMode = ref(false)
const capturing = ref(false)
/** Live rubber-band rect in `.pdf-scroll` CONTENT coords (so it scrolls with the pages). */
const dragRect = ref<{ x: number; y: number; w: number; h: number } | null>(null)
// `client` coords drive the region math (robust to scroll); `content` coords (incl. scroll
// offset) drive the rubber-band rendering inside the scroll container.
let dragStart: { clientX: number; clientY: number; contentX: number; contentY: number; pageEl: HTMLElement } | null = null

function toggleCaptureMode() {
  captureMode.value = !captureMode.value
  dragRect.value = null
  dragStart = null
  captureMenu.value = null
  if (captureMode.value) {
    hideSelBtn()
    window.getSelection()?.removeAllRanges()
  }
}

function exitCaptureMode() {
  captureMode.value = false
  dragRect.value = null
  dragStart = null
  captureMenu.value = null
}

/** Page element under a client point, constrained to this viewer. */
function pageElAtPoint(clientX: number, clientY: number): HTMLElement | null {
  const root = viewerRef.value
  if (!root) return null
  for (const el of root.querySelectorAll<HTMLElement>('.pdf-page')) {
    const r = el.getBoundingClientRect()
    if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) return el
  }
  return null
}

function onCaptureDown(e: MouseEvent) {
  if (!captureMode.value || capturing.value) return
  // Clicks on the capture menu (rendered inside the page) must not start a new drag.
  if ((e.target as Element | null)?.closest?.('.pdf-capture-menu')) return
  captureMenu.value = null // starting another drag discards an undecided capture
  const pageEl = pageElAtPoint(e.clientX, e.clientY)
  const root = viewerRef.value
  if (!pageEl || !root) return
  e.preventDefault()
  const vr = root.getBoundingClientRect()
  const contentX = e.clientX - vr.left + root.scrollLeft
  const contentY = e.clientY - vr.top + root.scrollTop
  dragStart = { clientX: e.clientX, clientY: e.clientY, contentX, contentY, pageEl }
  dragRect.value = { x: contentX, y: contentY, w: 0, h: 0 }
  window.addEventListener('mousemove', onCaptureMove)
  window.addEventListener('mouseup', onCaptureUp)
}

function onCaptureMove(e: MouseEvent) {
  if (!dragStart || !viewerRef.value) return
  const root = viewerRef.value
  const vr = root.getBoundingClientRect()
  const cx = e.clientX - vr.left + root.scrollLeft
  const cy = e.clientY - vr.top + root.scrollTop
  dragRect.value = {
    x: Math.min(dragStart.contentX, cx),
    y: Math.min(dragStart.contentY, cy),
    w: Math.abs(cx - dragStart.contentX),
    h: Math.abs(cy - dragStart.contentY),
  }
}

async function onCaptureUp(e: MouseEvent) {
  window.removeEventListener('mousemove', onCaptureMove)
  window.removeEventListener('mouseup', onCaptureUp)
  const start = dragStart
  dragStart = null
  dragRect.value = null
  if (!start || !props.paperId) return
  const pageEl = start.pageEl
  const pr = pageEl.getBoundingClientRect()
  // Region math uses client coords (scroll-independent), clamped to the start page.
  const clampedLeft = Math.max(pr.left, Math.min(pr.right, Math.min(start.clientX, e.clientX)))
  const clampedTop = Math.max(pr.top, Math.min(pr.bottom, Math.min(start.clientY, e.clientY)))
  const clampedRight = Math.max(pr.left, Math.min(pr.right, Math.max(start.clientX, e.clientX)))
  const clampedBottom = Math.max(pr.top, Math.min(pr.bottom, Math.max(start.clientY, e.clientY)))
  const localW = clampedRight - clampedLeft, localH = clampedBottom - clampedTop
  if (localW < 4 || localH < 4) return
  // Normalize to [0,1] page space (page rect already reflects effectiveScale).
  const region = {
    page: Number(pageEl.dataset.pdfPage),
    x: (clampedLeft - pr.left) / pr.width,
    y: (clampedTop - pr.top) / pr.height,
    w: localW / pr.width,
    h: localH / pr.height,
  }
  // Keep the region highlighted on its page with the action menu below it until the user
  // picks an action, dismisses it, or starts another drag.
  captureMenu.value = { region }
}

type CaptureRegion = { page: number; x: number; y: number; w: number; h: number }
/** Pending (undecided or uploading) capture: highlighted on its page with the action menu below. */
const captureMenu = ref<{ region: CaptureRegion } | null>(null)

/** Capture-region box (in % of its page) for the in-page highlight and the menu below it. */
function captureBoxStyle(region: CaptureRegion) {
  return { left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.w * 100}%`, height: `${region.h * 100}%` }
}

/** The region's current rect in `.pdf-viewer-root` coords (for placing the ask panel next to it). */
function regionRootRect(region: CaptureRegion): RelativeRect | null {
  const el = pageEl(region.page), outer = viewerRoot()
  if (!el || !outer) return null
  const pr = el.getBoundingClientRect(), or = outer.getBoundingClientRect()
  const left = pr.left - or.left + region.x * pr.width, top = pr.top - or.top + region.y * pr.height
  const width = region.w * pr.width, height = region.h * pr.height
  return { left, top, right: left + width, bottom: top + height, width, height }
}

/** Render a region to PNG and upload it to the image host. */
async function uploadRegion(region: CaptureRegion) {
  const dataUrl = await cropRegionToImage(region, screenshotDpi.value)
  if (!dataUrl) throw new Error('render failed')
  const blob = await (await fetch(dataUrl)).blob()
  return uploadImage(blob, `paper-${props.paperId}-p${region.page}.png`)
}

const r4 = (n: number) => Math.round(n * 1e4) / 1e4

function regionInput(region: CaptureRegion, hash: string): Omit<QAImageInput, 'label' | 'url'> {
  return { kind: 'image', image_hash: hash, pdf: { page: region.page, rx: r4(region.x), ry: r4(region.y), rw: r4(region.w), rh: r4(region.h) } }
}

async function onCaptureAction(action: 'copy-url' | 'copy' | 'ask' | 'add') {
  // The menu (and highlight) stays up while uploading and after a failure; success clears it.
  const menu = captureMenu.value
  if (!menu || !props.paperId) return
  if (action === 'copy' || action === 'copy-url') { await captureRegion(menu.region, action === 'copy-url'); return }
  if (askDisabled.value || capturing.value) return
  capturing.value = true
  try {
    const { image, url } = await uploadRegion(menu.region)
    const rect = regionRootRect(menu.region)
    exitCaptureMode()
    if (action === 'ask') {
      void startDirectAsk(regionInput(menu.region, image.hash), { kind: 'image', url }, rect ?? { left: 8, top: 8, right: 8, bottom: 8, width: 0, height: 0 })
    } else {
      composer.addAttachment({ ...regionInput(menu.region, image.hash), url })
    }
  } catch {
    toast.error('截图上传失败，请重试', { position: 'bottom-center' })
  } finally {
    capturing.value = false
  }
}

async function captureRegion(region: { page: number; x: number; y: number; w: number; h: number }, urlOnly = false) {
  if (!props.paperId || capturing.value) return
  capturing.value = true
  try {
    const { url } = await uploadRegion(region)
    const anchor = `paperland://paper/${props.paperId}?pdf=${region.page}&rx=${r4(region.x)}&ry=${r4(region.y)}&rw=${r4(region.w)}&rh=${r4(region.h)}`
    await navigator.clipboard.writeText(urlOnly ? url : `[![](${url})](${anchor})`)
    toast.success(urlOnly ? '已复制图片链接' : '已复制截图 Markdown', { position: 'bottom-center' })
    exitCaptureMode()
  } catch {
    toast.error('截图上传失败，请重试', { position: 'bottom-center' })
  } finally {
    capturing.value = false
  }
}

function onCaptureKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (captureMenu.value) {
    captureMenu.value = null
    return
  }
  if (activeTranslation.value) {
    closeTranslationPanel()
    return
  }
  if (captureMode.value) exitCaptureMode()
}

// ---- Lifecycle ----
async function loadDocument() {
  cleanupDoc()
  if (!props.pdfPath) { loading.value = false; return }
  loading.value = true
  error.value = false
  try {
    pdfjs = await loadPdfjs()
    loadingTask = pdfjs.getDocument({ url: `/api/files/${encodeURIComponent(props.pdfPath)}` })
    pdfDoc = await loadingTask.promise
    pdfFingerprint.value = pdfDoc.fingerprints?.[0] ?? null
    numPages.value = pdfDoc.numPages
    const first = await pdfDoc.getPage(1)
    const vp1 = first.getViewport({ scale: 1 })
    pages.value = Array.from({ length: numPages.value }, (_, i) => ({ num: i + 1, wPt: vp1.width, hPt: vp1.height }))
    loading.value = false
    await nextTick()
    updateFit()
    setupObserver()
    updateCurrentPage()
    const initial = pending ?? requestedPdfTarget.value
    pending = null
    if (initial) applyTarget(initial)
  } catch {
    error.value = true
    loading.value = false
  }
}

function cleanupDoc() {
  hideSelBtn()
  closeAskPanel()
  io?.disconnect(); io = null
  for (const { task } of renderTasks.values()) task?.cancel?.()
  renderTasks.clear()
  rendered.clear()
  pages.value = []
  numPages.value = 0
  currentPage.value = 1
  zoom.value = 1
  try { loadingTask?.destroy?.() } catch { /* noop */ }
  try { pdfDoc?.destroy?.() } catch { /* noop */ }
  pdfDoc = null
  loadingTask = null
  pdfFingerprint.value = null
  hlHits.clear()
}

let ro: ResizeObserver | null = null
watch(translationPanelRef, (panel) => {
  translationPanelRo?.disconnect()
  translationPanelRo = null
  if (!panel) return
  translationPanelRo = new ResizeObserver(() => updateTranslationPanelPlacement())
  translationPanelRo.observe(panel)
  updateTranslationPanelPlacement()
})

let resizeRaf = 0
let reRasterTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  loadDocument()
  document.addEventListener('selectionchange', onSelectionChange)
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  document.addEventListener('pointerup', onDocumentPointerUp, true)
  document.addEventListener('pointercancel', onDocumentPointerUp, true)
  window.addEventListener('keydown', onCaptureKey)
  // Capture DPI default lives in config.yml; fall back to 300 if the request fails.
  configApi.pdf().then((c) => { if (c?.screenshot_dpi) screenshotDpi.value = c.screenshot_dpi }).catch(() => {})
  ro = new ResizeObserver(() => {
    if (resizeRaf) return
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0
      updateFit()
    })
  })
  if (viewerRef.value) ro.observe(viewerRef.value)
})

onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', onSelectionChange)
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('pointerup', onDocumentPointerUp, true)
  document.removeEventListener('pointercancel', onDocumentPointerUp, true)
  window.removeEventListener('keydown', onCaptureKey)
  window.removeEventListener('mousemove', onCaptureMove)
  window.removeEventListener('mouseup', onCaptureUp)
  if (selTimer) clearTimeout(selTimer)
  if (reRasterTimer) clearTimeout(reRasterTimer)
  translationPanelRo?.disconnect()
  ro?.disconnect()
  cleanupDoc()
})

// Reload when the PDF path changes (paper → paper navigation reuses this component).
watch(() => props.pdfPath, () => loadDocument())
watch(() => auth.isAuthenticated, (authenticated) => {
  if (!authenticated) closeTranslationPanel()
  else handleSelectionSettled()
})

// Scale changes (zoom / fit-to-width while dragging the split pane) resize the placeholders and
// CSS-scale the existing canvases instantly. Re-rasterizing at the new scale (canvas + text layer)
// is expensive, so debounce it to fire once the scale has settled — never per resize frame.
// A longer wait keeps the drag fully smooth and avoids a premature re-raster on brief pauses;
// the page just stays CSS-scaled (slightly soft) until it lands.
const RE_RASTER_DEBOUNCE_MS = 320
watch(effectiveScale, () => {
  hideSelBtn()
  if (reRasterTimer) clearTimeout(reRasterTimer)
  reRasterTimer = setTimeout(async () => {
    await nextTick()
    for (const num of [...rendered.keys()]) renderPage(num)
  }, RE_RASTER_DEBOUNCE_MS)
})

// Theme change: pageColors are baked into the raster, so cached pages can't recolor in place —
// re-render the live (rendered + in-flight) pages with the new colors. renderPage now renders
// off-DOM and swaps on completion, so the old canvas stays visible until the new one is ready
// (no unrender-induced blank, no white flash). Off-screen pages render fresh when scrolled in.
watch(() => theme.resolved, () => {
  hideSelBtn()
  const live = new Set<number>([...rendered.keys(), ...renderTasks.keys()])
  for (const num of live) renderPage(num)
})

// React to anchor navigation requests (set on mount via initial, plus subsequent clicks).
watch(requestedPdfTarget, (t) => applyTarget(t))
</script>

<template>
  <div class="pdf-viewer-root">
    <!-- Empty: no PDF yet -->
    <div v-if="!pdfPath" class="pdf-state">
      <FileText class="h-12 w-12 mb-3 stroke-1" />
      <p class="text-sm">暂无 PDF</p>
      <p class="text-xs mt-1">等待 arxiv 服务下载...</p>
    </div>

    <!-- Error: pdf.js failed; offer the raw file -->
    <div v-else-if="error" class="pdf-state">
      <AlertTriangle class="h-12 w-12 mb-3 stroke-1 text-destructive" />
      <p class="text-sm">PDF 加载失败</p>
      <a v-if="rawUrl" :href="rawUrl" target="_blank" rel="noopener" class="text-xs mt-1 text-primary underline">打开原始 PDF</a>
    </div>

    <template v-else>
      <!-- Toolbar -->
      <div class="pdf-toolbar">
        <div class="pdf-tb-group">
          <button class="pdf-tb-btn" title="上一页" @click="prevPage"><ChevronUp class="h-4 w-4" /></button>
          <span class="pdf-tb-page">
            <input
              class="pdf-tb-input"
              type="number" min="1" :max="numPages"
              :value="currentPage"
              @change="onJumpInput"
            />
            <span class="text-muted-foreground">/ {{ numPages || '–' }}</span>
          </span>
          <button class="pdf-tb-btn" title="下一页" @click="nextPage"><ChevronDown class="h-4 w-4" /></button>
        </div>
        <div class="pdf-tb-group">
          <button class="pdf-tb-btn" title="缩小" @click="zoomOut"><ZoomOut class="h-4 w-4" /></button>
          <span class="pdf-tb-zoom">{{ zoomPct }}%</span>
          <button class="pdf-tb-btn" title="放大" @click="zoomIn"><ZoomIn class="h-4 w-4" /></button>
        </div>
        <button
          class="pdf-tb-btn"
          :title="fitMode === 'width' ? '当前：适配宽度（点击切换为适配高度）' : '当前：适配高度（点击切换为适配宽度）'"
          @click="toggleFitMode"
        >
          <MoveHorizontal v-if="fitMode === 'width'" class="h-4 w-4" />
          <MoveVertical v-else class="h-4 w-4" />
        </button>
        <button v-if="paperId" class="pdf-tb-btn" title="复制本页链接" @click="copyPageLink">
          <Link2 class="h-4 w-4" />
        </button>
        <button
          v-if="paperId"
          class="pdf-tb-btn"
          :class="{ 'pdf-tb-btn-active': captureMode }"
          :title="captureMode ? '框选截图模式（Esc 取消）' : '框选截图（截取一块区域并上传图床）'"
          @click="toggleCaptureMode"
        >
          <Crop class="h-4 w-4" />
        </button>
        <HighlightScopeToggle v-if="paperId" class="ml-1" size="sm" />
      </div>

      <!-- Scroll area -->
      <div
        ref="viewerRef"
        class="pdf-scroll"
        :class="{ 'pdf-capturing': captureMode }"
        @scroll="onScroll"
        @mousedown="onCaptureDown"
        @click="onPageClick"
        @mousemove="onPageHover"
      >
        <div
          v-for="p in pages" :key="p.num"
          class="pdf-page" :data-pdf-page="p.num"
          :style="pageStyle(p)"
        >
          <!-- Pending capture: keep the dragged region highlighted on its page (scrolls/zooms with it) -->
          <div
            v-if="captureMenu && captureMenu.region.page === p.num"
            class="pdf-capture-sel" :style="captureBoxStyle(captureMenu.region)"
          >
            <!-- Capture action menu, centered below the highlighted region -->
            <div class="pdf-sel-toolbar pdf-capture-menu">
              <button class="pdf-sel-btn" :disabled="capturing" title="复制图床图片链接" @click="onCaptureAction('copy-url')">
                <ImageIcon class="h-3.5 w-3.5" /> 复制图片链接
              </button>
              <button class="pdf-sel-btn" :disabled="capturing" title="复制带定位的 Markdown 图片链接" @click="onCaptureAction('copy')">
                <Link2 class="h-3.5 w-3.5" /> 复制 Markdown
              </button>
              <button
                v-if="showAskActions" class="pdf-sel-btn" :disabled="capturing || askDisabled"
                :title="askHint || '加入提问框'" @click="onCaptureAction('add')"
              >
                <Plus class="h-3.5 w-3.5" /> 加入提问框
              </button>
              <button
                v-if="showAskActions" class="pdf-sel-btn" :disabled="capturing || askDisabled"
                :title="askHint || '用预设问题直接提问这张截图'" @click="onCaptureAction('ask')"
              >
                <MessageCircleQuestion class="h-3.5 w-3.5" /> 截图提问
              </button>
              <button class="pdf-sel-btn" title="取消" @click="captureMenu = null">
                <X class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
        <!-- Rubber-band selection rectangle (capture mode) -->
        <div
          v-if="dragRect"
          class="pdf-capture-rect"
          :style="{ left: dragRect.x + 'px', top: dragRect.y + 'px', width: dragRect.w + 'px', height: dragRect.h + 'px' }"
        />
      </div>

      <!-- Floating selection toolbar below the selection: translate on demand + copy link -->
      <div
        v-if="showSelToolbar"
        ref="selToolbarRef"
        class="pdf-sel-toolbar"
        :style="{ left: selBtnPos.x + 'px', top: selBtnPos.y + 'px' }"
      >
        <template v-if="hlEnabled && !selMultiPage">
          <button
            v-for="c in HL_COLORS" :key="c.key"
            class="pdf-hl-swatch" :class="[`pdf-hl-swatch-${c.key}`, { 'pdf-hl-swatch-active': selOwnHighlight?.color === c.key }]"
            :title="selOwnHighlight ? `改为${c.label}高亮` : `${c.label}高亮`"
            @mousedown.prevent
            @click="applyHighlightColor(c.key)"
          />
          <button v-if="selOwnHighlight" class="pdf-sel-btn" title="删除高亮" @mousedown.prevent @click="deleteSelHighlight">
            <Trash2 class="h-3.5 w-3.5" />
          </button>
          <span class="pdf-sel-sep" />
        </template>
        <button
          v-if="auth.isAuthenticated && !selMultiPage"
          class="pdf-sel-btn"
          :class="{ 'pdf-sel-btn-active': activeTranslation }"
          title="翻译选区"
          @mousedown.prevent
          @click="translateSelection"
        >
          <Languages class="h-3.5 w-3.5" /> 翻译
        </button>
        <button
          v-if="showAskActions"
          class="pdf-sel-btn"
          :disabled="askDisabled"
          :title="askHint || '用预设问题直接提问这段内容'"
          @mousedown.prevent
          @click="askSelection"
        >
          <MessageCircleQuestion class="h-3.5 w-3.5" /> 提问
        </button>
        <button
          v-if="showAskActions"
          class="pdf-sel-btn"
          :disabled="askDisabled"
          :title="askHint || '加入提问框，可继续添加选段或截图后再提问'"
          @mousedown.prevent
          @click="addSelectionToQuestion"
        >
          <Plus class="h-3.5 w-3.5" /> 加入提问框
        </button>
        <button
          v-if="paperId && !selMultiPage"
          class="pdf-sel-btn"
          title="复制选区链接"
          @mousedown.prevent
          @click="copySelectionLink"
        >
          <Link2 class="h-3.5 w-3.5" /> 复制选区链接
        </button>
      </div>

      <!-- Selection streaming translation panel, opened from the toolbar (authenticated users only). -->
      <aside
        v-if="activeTranslation"
        ref="translationPanelRef"
        class="pdf-selection-translation"
        :class="`pdf-selection-translation-${translationPanelPos.placement}`"
        :style="{
          left: translationPanelPos.left + 'px',
          top: translationPanelPos.top + 'px',
          width: translationPanelPos.width + 'px',
        }"
        @pointerdown.stop
        @pointerup="restorePdfSelection"
      >
        <header class="pdf-selection-translation-header">
          <span class="pdf-selection-translation-title">
            <Languages class="h-3.5 w-3.5" /> Translation
          </span>
          <span class="pdf-selection-translation-state">{{ translationStatus }}</span>
          <button
            class="pdf-selection-translation-icon"
            title="关闭翻译"
            @mousedown.prevent
            @click="closeTranslationPanel()"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </header>

        <div class="pdf-selection-translation-body">
          <StreamingTranslationText
            :key="translationKey"
            :text="activeTranslation.text"
            :force="translationForce"
            @status="onTranslationStatus"
            @delta="onTranslationDelta"
            @done="onTranslationDone"
            @error="onTranslationError"
            v-slot="{ text }"
          >
            <p
              class="pdf-selection-translation-text"
              :class="{ 'pdf-selection-translation-source': !text }"
            >{{ selectPdfTranslationPanelText(activeTranslation.text, text) }}</p>
          </StreamingTranslationText>
          <p v-if="translationError" class="pdf-selection-translation-error">{{ translationError }}</p>
        </div>

        <footer class="pdf-selection-translation-actions">
          <button
            class="pdf-selection-translation-action"
            :disabled="!translationText"
            @mousedown.prevent
            @click="copySelectionTranslation"
          >
            <Copy class="h-3.5 w-3.5" /> 复制翻译
          </button>
          <button
            class="pdf-selection-translation-action"
            :disabled="translationStatus === 'connecting' || translationStatus === 'streaming'"
            @mousedown.prevent
            @click="retrySelectionTranslation"
          >
            <RefreshCw class="h-3.5 w-3.5" /> 重试
          </button>
        </footer>
      </aside>

      <!-- Direct ask: the passage/screenshot with its streamed answer, placed near the source -->
      <aside
        v-if="askPanel"
        ref="askPanelRef"
        class="pdf-selection-translation pdf-ask-panel"
        :style="{ left: askPanelPos.left + 'px', top: askPanelPos.top + 'px', width: askPanelPos.width + 'px' }"
        @pointerdown.stop
      >
        <header class="pdf-selection-translation-header">
          <span class="pdf-selection-translation-title">
            <MessageCircleQuestion class="h-3.5 w-3.5" /> Ask<template v-if="askEntry"> · QA-{{ askEntry.entry_id }}</template>
          </span>
          <span class="pdf-selection-translation-state">{{ askResult?.status ?? (askPanel.error ? 'failed' : 'submitting') }}</span>
          <button class="pdf-selection-translation-icon" title="关闭" @mousedown.prevent @click="closeAskPanel()">
            <X class="h-3.5 w-3.5" />
          </button>
        </header>
        <div class="pdf-selection-translation-body pdf-ask-body">
          <img v-if="askPanel.preview.kind === 'image'" :src="askPanel.preview.url" alt="" class="pdf-ask-thumb" />
          <blockquote v-else class="pdf-ask-quote">{{ askPanel.preview.text }}</blockquote>
          <p v-if="askPanel.error" class="pdf-selection-translation-error">{{ askPanel.error }}</p>
          <MarkdownContent
            v-else-if="askResult?.status === 'done'"
            :content="askResult.answer"
            :paper-id="paperId ?? undefined"
            :qa-result-id="askResult.id"
            qa-answer
            disable-highlights
            class="text-sm"
            @moonlight="followUpAsk"
          />
          <QAStreamingMarkdown v-else-if="askResult?.answer" :content="askResult.answer" />
          <p v-else-if="askResult && ['failed', 'cancelled'].includes(askResult.status)" class="pdf-selection-translation-error">
            {{ askResult.error || 'Generation failed' }}
          </p>
          <p v-else class="pdf-ask-waiting"><Loader2 class="h-3.5 w-3.5 animate-spin" /> Thinking…</p>
        </div>
        <footer class="pdf-selection-translation-actions">
          <button class="pdf-selection-translation-action" :disabled="!askEntry" @mousedown.prevent @click="showAskInList">
            <List class="h-3.5 w-3.5" /> 在列表中查看
          </button>
          <button
            class="pdf-selection-translation-action" :disabled="!askFollowupTarget"
            @mousedown.prevent @click="followUpAsk()"
          >
            <MessagesSquare class="h-3.5 w-3.5" /> 追问
          </button>
        </footer>
      </aside>

      <!-- Loading overlay -->
      <div v-if="loading" class="pdf-loading">
        <Loader2 class="h-5 w-5 animate-spin text-primary" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.pdf-viewer-root { position: relative; height: 100%; background: var(--muted); display: flex; flex-direction: column; }
.pdf-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--muted-foreground); }

/* Toolbar */
.pdf-toolbar {
  display: flex; align-items: center; gap: 12px; justify-content: center;
  height: 36px; padding: 0 8px; border-bottom: 1px solid var(--border);
  background: var(--background); flex-shrink: 0; user-select: none;
}
.pdf-tb-group { display: flex; align-items: center; gap: 2px; }
.pdf-tb-btn {
  display: inline-flex; align-items: center; justify-content: center;
  height: 26px; width: 26px; border-radius: var(--radius-sm);
  color: var(--foreground); background: none; border: none; cursor: pointer;
}
.pdf-tb-btn:hover { background: var(--accent); color: var(--accent-foreground); }
.pdf-tb-btn-active, .pdf-tb-btn-active:hover { background: var(--primary); color: var(--primary-foreground); }
.pdf-tb-page { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; }
.pdf-tb-input {
  width: 40px; text-align: center; font-size: 12px; padding: 2px 4px;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--background); color: var(--foreground);
  -moz-appearance: textfield;
}
.pdf-tb-input::-webkit-outer-spin-button, .pdf-tb-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.pdf-tb-zoom { font-size: 12px; min-width: 38px; text-align: center; color: var(--muted-foreground); }

/* Scroll area + pages */
.pdf-scroll { flex: 1; overflow: auto; padding: 12px 0; position: relative; }

/* Capture (框选截图) mode: crosshair cursor + suppress native text selection so a drag
   draws a region instead of selecting text. The text layer ignores pointer events so the
   mousedown lands on the scroll container and our rubber-band handler runs. */
.pdf-scroll.pdf-capturing { cursor: crosshair; user-select: none; }
.pdf-scroll.pdf-capturing :deep(.textLayer) { pointer-events: none; }
.pdf-capture-rect {
  position: absolute; z-index: 40; pointer-events: none;
  border: 1.5px dashed var(--primary);
  background: color-mix(in oklch, var(--primary) 14%, transparent);
}
.pdf-page {
  position: relative; margin: 0 auto 12px auto; background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18); scroll-margin-top: 12px;
}
/* Dark mode: gray page so the gutter/loading state matches the dark-rendered canvas
   (must match DARK_PAGE_COLORS.background in the script). */
:global(.dark) .pdf-page { background: #3a3a3a; }
.pdf-page :deep(.pdf-canvas) { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; }
.pdf-page :deep(.textLayer) { z-index: 2; }
.pdf-page :deep(.textLayer ::selection) { background: rgba(37, 99, 235, 0.28); }

/* Persistent PDF highlights: above the canvas, below the (selectable) text layer. Colors mirror
   MarkdownContent's .hl-* (own = fill) and .hl-foreign-* (others = dashed underline). */
.pdf-page :deep(.pdf-hl-layer) { position: absolute; inset: 0; z-index: 1; pointer-events: none; }
.pdf-page :deep(.pdf-hl) { position: absolute; border-radius: 1px; mix-blend-mode: multiply; }
:global(.dark) .pdf-page :deep(.pdf-hl) { mix-blend-mode: screen; }
.pdf-page :deep(.pdf-hl-yellow) { background: rgba(250, 204, 21, 0.35); }
.pdf-page :deep(.pdf-hl-green) { background: rgba(74, 222, 128, 0.35); }
.pdf-page :deep(.pdf-hl-blue) { background: rgba(96, 165, 250, 0.35); }
.pdf-page :deep(.pdf-hl-pink) { background: rgba(244, 114, 182, 0.35); }
.pdf-page :deep(.pdf-hl-foreign) { background: transparent; border-bottom: 2px dashed; mix-blend-mode: normal; }
.pdf-page :deep(.pdf-hl-foreign.pdf-hl-yellow) { border-color: rgba(234, 179, 8, 0.8); }
.pdf-page :deep(.pdf-hl-foreign.pdf-hl-green) { border-color: rgba(34, 197, 94, 0.8); }
.pdf-page :deep(.pdf-hl-foreign.pdf-hl-blue) { border-color: rgba(59, 130, 246, 0.8); }
.pdf-page :deep(.pdf-hl-foreign.pdf-hl-pink) { border-color: rgba(236, 72, 153, 0.8); }

/* Transient region highlight (non-persisted, mirrors the Markdown anchor flash). */
.pdf-page :deep(.pdf-region-flash) {
  position: absolute; z-index: 3; pointer-events: none;
  background: color-mix(in oklch, var(--primary) 32%, transparent);
  border-radius: 2px; animation: pdf-region-fade 2.2s ease-out forwards;
}
@keyframes pdf-region-fade {
  0% { background: color-mix(in oklch, var(--primary) 42%, transparent); }
  100% { background: color-mix(in oklch, var(--primary) 0%, transparent); }
}

/* Floating selection toolbar (mirrors the Markdown highlight toolbar) */
.pdf-sel-toolbar {
  position: absolute; z-index: 50; transform: translateX(-50%);
  display: flex; align-items: center; gap: 2px;
  background: var(--popover); color: var(--popover-foreground);
  border: 1px solid var(--border); border-radius: calc(var(--radius) + 2px);
  padding: 3px 4px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  user-select: none; -webkit-user-select: none;
}
.pdf-sel-btn {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; padding: 3px 7px; cursor: pointer; white-space: nowrap;
  background: none; border: none; color: inherit; border-radius: var(--radius-sm);
}
.pdf-sel-btn:hover, .pdf-sel-btn-active { background: var(--accent); color: var(--accent-foreground); }

/* Stable PDF selection translation; positioned in .pdf-viewer-root coordinates. */
.pdf-sel-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.pdf-hl-swatch {
  width: 16px; height: 16px; margin: 0 2px; border-radius: 9999px; cursor: pointer;
  border: 1px solid rgba(0, 0, 0, 0.15); padding: 0;
}
.pdf-hl-swatch:hover { transform: scale(1.12); }
.pdf-hl-swatch-active { box-shadow: 0 0 0 2px var(--popover), 0 0 0 3.5px var(--foreground); }
.pdf-hl-swatch-yellow { background: rgb(250, 204, 21); }
.pdf-hl-swatch-green { background: rgb(74, 222, 128); }
.pdf-hl-swatch-blue { background: rgb(96, 165, 250); }
.pdf-hl-swatch-pink { background: rgb(244, 114, 182); }
.pdf-sel-sep { width: 1px; align-self: stretch; margin: 2px 3px; background: var(--border); }
.pdf-capture-sel {
  position: absolute; z-index: 30; pointer-events: none;
  outline: 2px solid var(--primary); outline-offset: 0; border-radius: 2px;
  background: color-mix(in oklch, var(--primary) 16%, transparent);
}
/* Centered under the highlighted region; it lives inside the page so it scrolls with it. */
.pdf-capture-menu { top: calc(100% + 6px); left: 50%; pointer-events: auto; cursor: default; }
.pdf-ask-panel { max-height: min(420px, calc(100% - 16px)); }
.pdf-ask-body { display: flex; flex-direction: column; gap: 8px; }
.pdf-ask-quote {
  margin: 0; padding-left: 8px; border-left: 3px solid var(--border); color: var(--muted-foreground);
  font-size: 12px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.pdf-ask-thumb { max-height: 96px; max-width: 100%; align-self: flex-start; border-radius: var(--radius-sm); border: 1px solid var(--border); }
.pdf-ask-waiting { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted-foreground); }
.pdf-selection-translation {
  position: absolute; z-index: 60;
  display: flex; flex-direction: column; overflow: hidden;
  max-height: min(260px, calc(100% - 16px));
  color: var(--popover-foreground); background: var(--popover);
  border: 1px solid var(--border); border-radius: calc(var(--radius) + 3px);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.2);
}
.pdf-selection-translation-header {
  display: flex; align-items: center; gap: 7px; flex: none;
  min-height: 32px; padding: 6px 7px 6px 10px;
  border-bottom: 1px solid var(--border); background: var(--muted);
}
.pdf-selection-translation-title {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
}
.pdf-selection-translation-state { margin-left: auto; font-size: 10px; color: var(--muted-foreground); }
.pdf-selection-translation-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: var(--radius-sm); cursor: pointer;
}
.pdf-selection-translation-icon:hover { background: var(--accent); }
.pdf-selection-translation-body { min-height: 48px; padding: 10px; overflow: auto; overscroll-behavior: contain; }
.pdf-selection-translation-text { white-space: pre-wrap; font-size: 13px; line-height: 1.55; }
.pdf-selection-translation-source { color: var(--muted-foreground); }
.pdf-selection-translation-error { white-space: pre-wrap; font-size: 12px; color: var(--destructive); }
.pdf-selection-translation-actions {
  display: flex; justify-content: flex-end; gap: 4px; flex: none;
  padding: 5px 7px; border-top: 1px solid var(--border);
}
.pdf-selection-translation-action {
  display: inline-flex; align-items: center; gap: 4px;
  height: 26px; padding: 0 7px; border-radius: var(--radius-sm);
  font-size: 11px; cursor: pointer;
}
.pdf-selection-translation-action:hover:not(:disabled) { background: var(--accent); }
.pdf-selection-translation-action:disabled { opacity: 0.45; cursor: default; }

@media (pointer: coarse) {
  .pdf-selection-translation-icon { width: 44px; height: 44px; }
  .pdf-selection-translation-action { min-height: 44px; padding-inline: 12px; }
}

.pdf-loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
</style>
