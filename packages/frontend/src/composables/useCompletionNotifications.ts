import { markRaw } from 'vue'
import type { Router } from 'vue-router'
import { toast } from 'vue-sonner'
import type { CompletionItem } from '@paperland/shared'
import { notificationsApi } from '@/api/client'
import CompletionToast from '@/components/CompletionToast.vue'
import { qaResultUrl, useQAJump } from '@/composables/useQAJump'

const POLL_INTERVAL_MS = 5000
const TOAST_DURATION_MS = 10000
/** At most this many notices per poll; the rest are summarized in one "N more" notice. */
const MAX_NOTICES = 5

function itemKey(item: CompletionItem) {
  return item.kind === 'qa' ? `qa:${item.result_id}` : `research:${item.step_id}`
}

function itemUrl(item: CompletionItem) {
  return item.kind === 'qa' ? qaResultUrl(item.paper_id, item.entry_id, item.result_id) : `/research/${item.session_id}`
}

/**
 * Global completion notices: polls the signed-in user's finished Q&A answers and Deep Research
 * rounds and announces each once at the bottom center. Started by `App.vue` while signed in.
 * Polls only while the browser tab is visible; the cursor is kept, so coming back to the tab
 * catches up on everything that finished meanwhile.
 */
export function useCompletionNotifications(router: Router) {
  const jump = useQAJump()
  let cursor: string | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight = false
  let running = false
  const seen = new Set<string>()

  /** Open in this tab: an answer on the paper already open goes straight to it. */
  function openItem(item: CompletionItem) {
    if (item.kind === 'research') { void router.push(`/research/${item.session_id}`); return }
    const route = router.currentRoute.value
    if (route.name === 'paper-detail' && Number(route.params.id) === item.paper_id) void jump.openResult(item.entry_id, item.result_id)
    else void router.push(itemUrl(item))
  }

  function notify(item: CompletionItem | null, href: string, open: () => void, more?: number) {
    const id = `completion-${item ? itemKey(item) : `more-${Date.now()}`}`
    toast.custom(markRaw(CompletionToast), {
      id, position: 'bottom-center', duration: TOAST_DURATION_MS,
      componentProps: { toastId: id, item, more, href, open },
    })
  }

  async function poll() {
    if (inFlight || !running || document.hidden) return
    inFlight = true
    try {
      const res = await notificationsApi.completions(cursor)
      if (!res || !running) return
      cursor = res.now
      const fresh = res.items.filter((item) => !seen.has(itemKey(item)))
      fresh.forEach((item) => seen.add(itemKey(item)))
      for (const item of fresh.slice(0, MAX_NOTICES)) notify(item, itemUrl(item), () => openItem(item))
      const rest = fresh.slice(MAX_NOTICES)
      if (rest.length) {
        const href = rest.every((item) => item.kind === 'research') ? '/research/history' : '/qa'
        notify(null, href, () => void router.push(href), rest.length)
      }
    } finally {
      inFlight = false
      schedule()
    }
  }

  /** Next poll; none while the tab is hidden (visibilitychange resumes it). */
  function schedule(delay = POLL_INTERVAL_MS) {
    if (timer) clearTimeout(timer)
    timer = running && !document.hidden ? setTimeout(poll, delay) : null
  }

  // Hidden: stop polling. Visible again: check right away, then resume the interval.
  function onVisibility() { schedule(document.hidden ? undefined : 0) }

  function start() {
    if (running) return
    running = true
    cursor = null
    seen.clear()
    document.addEventListener('visibilitychange', onVisibility)
    void poll()
  }

  function stop() {
    running = false
    if (timer) clearTimeout(timer)
    timer = null
    document.removeEventListener('visibilitychange', onVisibility)
  }

  return { start, stop }
}
