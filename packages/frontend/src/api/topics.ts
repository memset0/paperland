import type { ResearchSeed, TopicDefaultAccess, TopicDetail, TopicMember, TopicSummary, TopicVersion } from '@paperland/shared'
import { api } from './client'

export interface TopicHistory { versions: TopicVersion[]; total: number; next_offset: number | null }
export const topicsApi = {
  list: (scope = 'all') => api.get<{ data: TopicSummary[] }>(`/api/topics?scope=${scope}`),
  create: (body: { title: string; description?: string; seed_result_id?: number; default_access?: TopicDefaultAccess }) => api.post<{ data: TopicDetail }>('/api/topics', body),
  get: (id: number, commit?: string) => api.get<{ data: TopicDetail }>(`/api/topics/${id}${commit ? `?commit=${encodeURIComponent(commit)}` : ''}`),
  rename: (id: number, title: string, base_commit: string) => api.patch<{ data: TopicDetail }>(`/api/topics/${id}`, { title, base_commit }),
  archive: (id: number, archived: boolean) => api.put<{ data: TopicSummary }>(`/api/topics/${id}/archive`, { archived }),
  history: (id: number, offset = 0) => api.get<{ data: TopicHistory }>(`/api/topics/${id}/history?offset=${offset}&limit=50`),
  seed: (id: number) => api.get<{ data: ResearchSeed }>(`/api/topics/seed-preview?result_id=${id}`),
  setSharing: (id: number, default_access: TopicDefaultAccess) => api.put<{ data: { default_access: TopicDefaultAccess } }>(`/api/topics/${id}/sharing`, { default_access }),
  members: (id: number) => api.get<{ data: TopicMember[] }>(`/api/topics/${id}/members`),
  share: (id: number, username: string, role: 'viewer' | 'editor' | null) => api.put<{ data: TopicMember[] }>(`/api/topics/${id}/members`, { username, role }),
  import: (id: number, entryId: string, commit?: string) => api.post<{ data: { paper_id: number; created: boolean; in_library: boolean } }>(`/api/topics/${id}/import`, { entry_id: entryId, ...(commit ? { commit } : {}) }),
}
