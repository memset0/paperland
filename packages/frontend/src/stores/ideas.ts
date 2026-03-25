import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api/client'
import type { Idea, IdeaDetail, IdeaCategory } from '@paperland/shared'

export const useIdeasStore = defineStore('ideas', () => {
  const ideas = ref<Idea[]>([])
  const currentDetail = ref<IdeaDetail | null>(null)
  const loading = ref(false)
  const conflict = ref(false)

  async function fetchIdeas(projectName: string, params?: {
    category?: string
    tag?: string
    sort?: string
    order?: string
  }) {
    loading.value = true
    try {
      const query = new URLSearchParams()
      if (params?.category) query.set('category', params.category)
      if (params?.tag) query.set('tag', params.tag)
      if (params?.sort) query.set('sort', params.sort)
      if (params?.order) query.set('order', params.order)
      const qs = query.toString()
      ideas.value = await api.get<Idea[]>(
        `/api/idea-forge/projects/${encodeURIComponent(projectName)}/ideas${qs ? '?' + qs : ''}`
      )
    } finally {
      loading.value = false
    }
  }

  async function fetchDetail(projectName: string, category: string, ideaName: string) {
    conflict.value = false
    currentDetail.value = await api.get<IdeaDetail>(
      `/api/idea-forge/projects/${encodeURIComponent(projectName)}/ideas/${encodeURIComponent(category)}/${encodeURIComponent(ideaName)}`
    )
    return currentDetail.value
  }

  async function updateIdea(
    projectName: string,
    category: string,
    ideaName: string,
    contentHash: string,
    frontmatter: Record<string, unknown>,
    body: string
  ): Promise<{ content_hash: string } | null> {
    conflict.value = false
    try {
      const res = await fetch(
        `/api/idea-forge/projects/${encodeURIComponent(projectName)}/ideas/${encodeURIComponent(category)}/${encodeURIComponent(ideaName)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content_hash: contentHash, frontmatter, body }),
        }
      )
      if (res.status === 409) {
        conflict.value = true
        return null
      }
      if (!res.ok) throw new Error('Failed to save')
      const data = await res.json()
      if (currentDetail.value) {
        currentDetail.value.content_hash = data.content_hash
        currentDetail.value.frontmatter = { ...currentDetail.value.frontmatter, ...data.frontmatter }
      }
      return data
    } catch (err) {
      throw err
    }
  }

  async function moveIdea(
    projectName: string,
    category: string,
    ideaName: string,
    targetCategory: IdeaCategory,
    contentHash: string
  ): Promise<IdeaDetail | null> {
    conflict.value = false
    try {
      const res = await fetch(
        `/api/idea-forge/projects/${encodeURIComponent(projectName)}/ideas/${encodeURIComponent(category)}/${encodeURIComponent(ideaName)}/move`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_category: targetCategory, content_hash: contentHash }),
        }
      )
      if (res.status === 409) {
        conflict.value = true
        return null
      }
      if (!res.ok) throw new Error('Failed to move')
      const data: IdeaDetail = await res.json()
      currentDetail.value = data
      return data
    } catch (err) {
      throw err
    }
  }

  return { ideas, currentDetail, loading, conflict, fetchIdeas, fetchDetail, updateIdea, moveIdea }
})
