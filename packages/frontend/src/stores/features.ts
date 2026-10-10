import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { FeatureItem } from '@paperland/shared'
import { featuresApi } from '@/api/client'

// Feature announcements shared by Home → Features and the sidebar's Home badge, so opening a card
// updates both. Nothing is pushed: unseen features only carry a red dot / count until opened.
export const useFeaturesStore = defineStore('features', () => {
  const features = ref<FeatureItem[]>([])
  const loaded = ref(false)
  let inflight: Promise<void> | null = null

  function load(force = false): Promise<void> {
    if (loaded.value && !force) return Promise.resolve()
    inflight ??= featuresApi.list()
      .then((res) => {
        features.value = res.data.features
        loaded.value = true
      })
      .catch(() => {})
      .finally(() => { inflight = null })
    return inflight
  }

  /** Number of features the signed-in user has not opened yet. */
  const newCount = computed(() => features.value.filter((f) => !f.seen).length)

  /** Mark features seen; local flags flip right away, the request is fire-and-forget. */
  async function markSeen(keys: string[]) {
    const unseen = keys.filter((k) => features.value.some((f) => f.key === k && !f.seen))
    if (!unseen.length) return
    for (const f of features.value) if (unseen.includes(f.key)) f.seen = true
    try { await featuresApi.markSeen(unseen) } catch { /* stays seen locally; the next load restores the dot */ }
  }

  return { features, loaded, newCount, load, markSeen }
})
