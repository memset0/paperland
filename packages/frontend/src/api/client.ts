import { dispatchApiError, dispatchUnauthorized } from '@/lib/error-bus'

const BASE_URL = ''

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${url}`, {
      ...options,
      credentials: 'same-origin',
      headers: {
        ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
        ...options?.headers,
      },
    })
  } catch {
    dispatchApiError('网络错误，请检查连接')
    throw new Error('网络错误，请检查连接')
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    const message = error.error?.message || error.message || 'Request failed'
    // A 401 means the session is missing/expired — prompt login instead of a raw error toast.
    if (response.status === 401) {
      dispatchUnauthorized()
    } else {
      dispatchApiError(message)
    }
    throw new Error(message)
  }

  return response.json()
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  put: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
}

// Highlight API
import type { Highlight, HighlightColor } from '@paperland/shared'

export const highlightApi = {
  fetch: (pathname: string) =>
    api.get<{ data: Highlight[] }>(`/api/highlights?pathname=${encodeURIComponent(pathname)}`),

  create: (data: {
    pathname: string
    content_hash: string
    start_offset: number
    end_offset: number
    text: string
    color: HighlightColor
  }) => api.post<{ data: Highlight }>('/api/highlights', data),

  update: (id: number, data: { color?: HighlightColor }) =>
    api.put<{ data: Highlight }>(`/api/highlights/${id}`, data),

  remove: (id: number) =>
    api.delete<{ success: boolean }>(`/api/highlights/${id}`),
}

// Auth + user management API
import type { SessionUser, User, UserRole } from '@paperland/shared'

export const authApi = {
  me: () => api.get<{ user: SessionUser | null }>('/api/auth/me'),

  // Raw fetch so a failed login surfaces inline (no global toast / login-prompt loop).
  async login(username: string, password: string): Promise<{ user: SessionUser }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const body = await res.json().catch(() => ({} as any))
    if (!res.ok) throw new Error(body?.error?.message || '登录失败')
    return body
  },

  logout: () => api.post<{ success: boolean }>('/api/auth/logout'),

  updateAccount: (payload: { username?: string; current_password?: string; password?: string }) =>
    api.patch<{ user: SessionUser }>('/api/auth/me', payload),
}

export const usersApi = {
  list: () => api.get<{ data: User[] }>('/api/users'),
  create: (payload: { username: string; password: string; role: UserRole }) =>
    api.post<{ data: User }>('/api/users', payload),
  update: (id: number, payload: { role?: UserRole; password?: string }) =>
    api.patch<{ data: User }>(`/api/users/${id}`, payload),
}

// Notes API
import type { Note, NoteWithPaper } from '@paperland/shared'

export const notesApi = {
  // Raw fetch: owner-scoped read returns empty for anonymous (and degrades silently
  // to empty if the route/server isn't ready) — no global error toast.
  async getForPaper(paperId: number): Promise<{ notes: Note[] }> {
    try {
      const res = await fetch(`/api/papers/${paperId}/notes`, { credentials: 'same-origin' })
      if (!res.ok) return { notes: [] }
      return await res.json()
    } catch {
      return { notes: [] }
    }
  },

  saveRoot: (paperId: number, body: string, updated_at?: string) =>
    api.put<{ data: Note }>(`/api/papers/${paperId}/root`, { body, updated_at }),

  create: (paperId: number, data: { title?: string | null; body?: string; parent_id?: number | null }) =>
    api.post<{ data: Note }>(`/api/papers/${paperId}/notes`, data),

  update: (id: number, data: { title?: string | null; body?: string; updated_at?: string }) =>
    api.patch<{ data: Note }>(`/api/notes/${id}`, data),

  move: (id: number, data: { parent_id: number | null; sort_order: number }) =>
    api.post<{ data: Note }>(`/api/notes/${id}/move`, data),

  remove: (id: number) =>
    api.delete<{ success: boolean; deleted: number }>(`/api/notes/${id}`),

  listAll: () => api.get<{ data: NoteWithPaper[] }>('/api/notes'),
}

// Reference links API
import type { PaperReferenceLink } from '@paperland/shared'

export const referenceLinksApi = {
  // Owner-scoped read; anonymous (or a not-yet-ready route) degrades silently to empty.
  async getForPaper(paperId: number): Promise<{ data: PaperReferenceLink[] }> {
    try {
      const res = await fetch(`/api/papers/${paperId}/reference-links`, { credentials: 'same-origin' })
      if (!res.ok) return { data: [] }
      return await res.json()
    } catch {
      return { data: [] }
    }
  },

  create: (paperId: number, data: { title: string; url: string; description?: string | null }) =>
    api.post<{ data: PaperReferenceLink }>(`/api/papers/${paperId}/reference-links`, data),

  update: (id: number, data: { title?: string; url?: string; description?: string | null }) =>
    api.patch<{ data: PaperReferenceLink }>(`/api/reference-links/${id}`, data),

  remove: (id: number) =>
    api.delete<{ success: boolean }>(`/api/reference-links/${id}`),
}
