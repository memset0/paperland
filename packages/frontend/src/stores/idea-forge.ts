import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api/client'
import type { IdeaForgeProject, DumpPapersResponse, ProjectConfig } from '@paperland/shared'

export const useIdeaForgeStore = defineStore('ideaForge', () => {
  const projects = ref<IdeaForgeProject[]>([])
  const loading = ref(false)

  async function fetchProjects() {
    loading.value = true
    try {
      projects.value = await api.get<IdeaForgeProject[]>('/api/idea-forge/projects')
    } finally {
      loading.value = false
    }
  }

  async function createProject(name: string, paperFilter?: { tag_names: string[] }) {
    const project = await api.post<IdeaForgeProject>('/api/idea-forge/projects', {
      name,
      paper_filter: paperFilter,
    })
    projects.value.push(project)
    return project
  }

  async function updateProjectConfig(projectName: string, config: Partial<ProjectConfig>) {
    const res = await api.patch<ProjectConfig>(
      `/api/idea-forge/projects/${encodeURIComponent(projectName)}/config`,
      config
    )
    // Update local state
    const proj = projects.value.find(p => p.name === projectName)
    if (proj) proj.config = res
    return res
  }

  async function dumpPapers(projectName: string, opts?: { tag_ids?: number[]; paper_ids?: number[] }) {
    return await api.post<DumpPapersResponse>(
      `/api/idea-forge/projects/${encodeURIComponent(projectName)}/dump-papers`,
      opts || {}
    )
  }

  return { projects, loading, fetchProjects, createProject, updateProjectConfig, dumpPapers }
})
