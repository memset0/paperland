import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/client'

export interface TagWithCount {
  id: number
  name: string
  color: string
  paper_count: number
}

export const useTagsStore = defineStore('tags', () => {
  const tags = ref<TagWithCount[]>([])
  const loaded = ref(false)

  const colorMap = computed(() => {
    const map: Record<number, string> = {}
    for (const t of tags.value) {
      map[t.id] = t.color
    }
    return map
  })

  function getTagColor(tagId: number): string {
    return colorMap.value[tagId] || '#6b7280'
  }

  async function fetchTags() {
    tags.value = await api.get<TagWithCount[]>('/api/tags')
    loaded.value = true
  }

  async function refreshCache() {
    await fetchTags()
  }

  async function ensureLoaded() {
    if (!loaded.value) await fetchTags()
  }

  async function renameTag(id: number, name: string) {
    return await api.patch<{ id: number; name: string; color: string } | { error: any; target_tag: any }>(`/api/tags/${id}`, { name })
  }

  async function mergeTag(sourceId: number, targetId: number) {
    const res = await api.post<{ merged: boolean }>(`/api/tags/${sourceId}/merge`, { target_id: targetId })
    await fetchTags()
    return res
  }

  async function deleteTag(id: number) {
    await api.delete(`/api/tags/${id}`)
    await fetchTags()
  }

  async function updateTagColor(id: number, color: string) {
    await api.patch(`/api/tags/${id}`, { color })
    await fetchTags()
  }

  return { tags, loaded, colorMap, getTagColor, fetchTags, refreshCache, ensureLoaded, renameTag, mergeTag, deleteTag, updateTagColor }
})
