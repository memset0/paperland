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

// Translation API (English→Chinese, cache-first; shared cache across users)
import type { TranslateResponse, Translation } from '@paperland/shared'

export const translationApi = {
  // Translate text; `force` bypasses the cache and overwrites the stored result (re-translate).
  translate: (text: string, force?: boolean) =>
    api.post<TranslateResponse>('/api/translate', { text, force }),

  // Peek whether this text was already translated, WITHOUT calling the AI model (and without a 404
  // on a miss). Returns `cached`/`translated_text`. Used to decide whether to auto-expand on mount.
  peek: (text: string) =>
    api.post<TranslateResponse>('/api/translate', { text, cache_only: true }),

  // Look up a cached translation by source hash without triggering a translation (404 when absent).
  getCachedTranslation: (hash: string, targetLang?: string) =>
    api.get<{ data: Translation }>(
      `/api/translations/${hash}${targetLang ? `?target_lang=${encodeURIComponent(targetLang)}` : ''}`,
    ),
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
import type { Note, NoteWithPaper, NoteWithAuthor, PublicNoteSummary } from '@paperland/shared'

export const notesApi = {
  // Raw fetch: owner-scoped read returns no note for anonymous (and degrades silently
  // to none if the route/server isn't ready) — no global error toast.
  async getForPaper(paperId: number): Promise<{ note: Note | null }> {
    try {
      const res = await fetch(`/api/papers/${paperId}/note`, { credentials: 'same-origin' })
      if (!res.ok) return { note: null }
      return await res.json()
    } catch {
      return { note: null }
    }
  },

  // Upsert the whole single-document body with optimistic concurrency. Raw fetch so a 409
  // ("modified elsewhere") is returned to the caller (with the latest server content) for
  // the store to reconcile, rather than raising a global error toast.
  async save(
    paperId: number,
    body: string,
    updated_at?: string,
  ): Promise<{ ok: true; data: Note } | { ok: false; conflict: true; data: Note }> {
    const res = await fetch(`/api/papers/${paperId}/note`, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, updated_at }),
    })
    const json = await res.json().catch(() => ({}) as any)
    if (res.status === 409) return { ok: false, conflict: true, data: json.data as Note }
    if (!res.ok) {
      const message = json?.error?.message || 'Save failed'
      if (res.status === 401) dispatchUnauthorized()
      else dispatchApiError(message)
      throw new Error(message)
    }
    return { ok: true, data: json.data as Note }
  },

  // Cross-paper aggregate. `scope=all` lists everyone's public notes (+ own); admins may pass
  // `include_private` to also pull others' unpublished notes. Default (no opts) = the caller's own.
  listAll: (opts?: { scope?: 'mine' | 'all'; include_private?: boolean }) => {
    const qs = new URLSearchParams()
    if (opts?.scope) qs.set('scope', opts.scope)
    if (opts?.include_private) qs.set('include_private', 'true')
    const q = qs.toString()
    return api.get<{ data: NoteWithAuthor[] }>(`/api/notes${q ? `?${q}` : ''}`)
  },

  // Toggle the note's "reading complete" flag (the note must already exist).
  setCompleted: (paperId: number, completed: boolean) =>
    api.post<{ data: Note }>(`/api/papers/${paperId}/note/completed`, { completed }),

  // Publish / unpublish the caller's note (the note must already exist and be non-empty).
  setVisibility: (paperId: number, is_public: boolean) =>
    api.put<{ data: Note }>(`/api/papers/${paperId}/note/visibility`, { is_public }),

  // Body-less list of OTHER users' public notes for a paper (right-panel section). Degrades to
  // empty for anonymous / not-yet-ready routes.
  async listPublicForPaper(paperId: number): Promise<{ data: PublicNoteSummary[] }> {
    try {
      const res = await fetch(`/api/papers/${paperId}/public-notes`, { credentials: 'same-origin' })
      if (!res.ok) return { data: [] }
      return await res.json()
    } catch {
      return { data: [] }
    }
  },

  // Fetch one note's full content with author (public / own / admin authorized). Returns null when
  // unavailable (404 / not readable), so callers can surface their own "note unavailable" notice.
  async getById(noteId: number): Promise<NoteWithAuthor | null> {
    try {
      const res = await fetch(`/api/notes/${noteId}`, { credentials: 'same-origin' })
      if (!res.ok) return null
      const json = await res.json().catch(() => null as any)
      return (json?.data ?? null) as NoteWithAuthor | null
    } catch {
      return null
    }
  },
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

// Image host API
import type { ImageWithUrl } from '@paperland/shared'

export const imagesApi = {
  list: () => api.get<{ data: ImageWithUrl[]; public_base_url: string }>('/api/images'),

  // `data` is a base64 string or a data: URL; the backend dedupes on content hash.
  upload: (data: string, filename?: string | null) =>
    api.post<{ data: ImageWithUrl }>('/api/images', { data, filename }),

  remove: (hash: string) =>
    api.delete<{ success: boolean }>(`/api/images/${hash}`),
}

// Config (safe subset) exposed to the frontend via /api/config/*.
export const configApi = {
  pdf: () => api.get<{ screenshot_dpi: number }>('/api/config/pdf'),
}
