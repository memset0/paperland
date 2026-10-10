import { dispatchApiError, dispatchUnauthorized } from '@/lib/error-bus'
import { consumeTranslationStream } from '@/lib/translation-stream'
import { consumeQAResultStream } from '@/lib/qa-result-stream'
import type { QAResult, QAResultStreamDelta, QAResultStreamStart } from '@paperland/shared'

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
    dispatchApiError('Network error. Check your connection.')
    throw new Error('Network error. Check your connection.')
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
  /** POST a raw binary body (e.g. a PDF file) with the given Content-Type. */
  upload: <T>(url: string, body: Blob, contentType: string) =>
    request<T>(url, { method: 'POST', body, headers: { 'Content-Type': contentType } }),
}

export const qaResultApi = {
  async stream(
    resultId: number,
    options: {
      signal?: AbortSignal
      onStart?: (start: QAResultStreamStart) => void | Promise<void>
      onDelta?: (delta: QAResultStreamDelta) => void | Promise<void>
    } = {},
  ): Promise<QAResult> {
    let response: Response
    try {
      response = await fetch(`/api/qa/results/${resultId}/stream`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'text/event-stream' },
        signal: options.signal,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error
      dispatchApiError('Q&A stream connection failed')
      throw error
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: response.statusText }))
      const message = body.error?.message || body.message || 'QA stream failed'
      if (response.status === 401) dispatchUnauthorized()
      else dispatchApiError(message)
      throw new Error(message)
    }
    if (!response.body) throw new Error('QA result stream returned no response body')
    return consumeQAResultStream(response.body, options)
  },

  cancel: (resultId: number) =>
    api.post<{ result_id: number; cancelled: boolean }>(`/api/qa/results/${resultId}/cancel`),
}

// Highlight API
import type { Highlight, HighlightColor } from '@paperland/shared'

export const highlightApi = {
  fetch: (pathname: string, scope: VisibilityScope = 'mine') =>
    api.get<{ data: Highlight[] }>(`/api/highlights?pathname=${encodeURIComponent(pathname)}&scope=${scope}`),

  create: (data: {
    pathname: string
    content_hash: string
    qa_result_id?: number
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
import type {
  TranslateResponse,
  Translation,
  TranslationStreamStart,
} from '@paperland/shared'

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

  async stream(
    text: string,
    options: {
      force?: boolean
      signal?: AbortSignal
      onStart?: (start: TranslationStreamStart) => void | Promise<void>
      onDelta?: (delta: string) => void | Promise<void>
    } = {},
  ): Promise<TranslateResponse> {
    let response: Response
    try {
      response = await fetch('/api/translate/stream', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ text, force: !!options.force }),
        signal: options.signal,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error
      dispatchApiError('Network error. Check your connection.')
      throw new Error('Network error. Check your connection.')
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: response.statusText }))
      const message = body.error?.message || body.message || 'Request failed'
      if (response.status === 401) dispatchUnauthorized()
      else dispatchApiError(message)
      throw new Error(message)
    }
    if (!response.body) {
      const error = new Error('Translation stream returned no response body')
      dispatchApiError(error.message)
      throw error
    }

    try {
      return await consumeTranslationStream(response.body, {
        onStart: options.onStart,
        onDelta: options.onDelta,
      })
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        dispatchApiError(error instanceof Error ? error.message : 'Translation failed')
      }
      throw error
    }
  },
}

// Auth + user management API
import type { MyApiTokens, MyUsage, SessionUser, UsageLeaderboardEntry, UsageRecalculateResult, User, UserRole } from '@paperland/shared'

export const authApi = {
  me: () => api.get<{ user: SessionUser | null; registration_enabled: boolean }>('/api/auth/me'),

  // Raw fetch: errors (409 taken, 403 disabled) surface inline on the register form.
  async register(payload: { username: string; password: string; nickname?: string | null }): Promise<void> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({} as any))
      throw new Error(body?.error?.message || 'Registration failed')
    }
  },

  // Raw fetch so a failed login surfaces inline (no global toast / login-prompt loop).
  async login(username: string, password: string): Promise<{ user: SessionUser }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const body = await res.json().catch(() => ({} as any))
    if (!res.ok) throw new Error(body?.error?.message || 'Login failed')
    return body
  },

  logout: () => api.post<{ success: boolean }>('/api/auth/logout'),

  updateAccount: (payload: { username?: string; nickname?: string | null; current_password?: string; password?: string }) =>
    api.patch<{ user: SessionUser }>('/api/auth/me', payload),
}

// Per-user sharing switches for optionally-shared data (highlights, notes, Q&A, reference links).
import type { SharingPreferences, VisibilityScope } from '@paperland/shared'

export const sharingApi = {
  get: () => api.get<{ data: SharingPreferences }>('/api/auth/me/sharing'),
  update: (patch: Partial<SharingPreferences>) =>
    api.put<{ data: SharingPreferences }>('/api/auth/me/sharing', patch),
}

// Browser extension download (zip with this site's URL + the user's token preset).
export const extensionApi = {
  downloadUrl: (baseUrl: string) => `/api/extension/download?base_url=${encodeURIComponent(baseUrl)}`,
}

// Arxiv quick-open (browser extension): per-user CSRF token + open-or-create by arxiv id.
export const quickOpenApi = {
  getToken: () => api.get<{ token: string }>('/api/auth/open-token'),
  regenerateToken: () => api.post<{ token: string }>('/api/auth/open-token/regenerate'),

  // Raw fetch so failures (bad token / bad id) surface inline on the open page, not as a toast.
  async openArxiv(arxiv_id: string, token: string): Promise<{ paper_id: number; arxiv_id: string; created: boolean }> {
    const res = await fetch('/api/papers/open-arxiv', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arxiv_id, token }),
    })
    const body = await res.json().catch(() => ({} as any))
    if (!res.ok) throw Object.assign(new Error(body?.error?.message || res.statusText || 'Request failed'), { status: res.status })
    return body
  },
}

// The signed-in user's API tokens: personal tokens (full value only at creation) and the Codex agent
// token (never returned; reset in place).
export const myTokensApi = {
  list: () => api.get<{ data: MyApiTokens }>('/api/auth/me/tokens'),
  create: () => api.post<{ data: { id: number; token: string; created_at: string } }>('/api/auth/me/tokens'),
  revoke: (id: number) => api.delete<{ success: boolean }>(`/api/auth/me/tokens/${id}`),
  resetAgent: () => api.post<{ data: MyApiTokens['agent'] }>('/api/auth/me/agent-token/reset'),
}

export const usageApi = {
  me: (days?: number) => api.get<{ data: MyUsage }>(`/api/usage/me${days ? `?days=${days}` : ''}`),
  leaderboard: (days?: number) => api.get<{ data: UsageLeaderboardEntry[] }>(`/api/usage/leaderboard${days ? `?days=${days}` : ''}`),
  recalculate: (range: { from?: string; to?: string }) => api.post<{ data: UsageRecalculateResult }>('/api/usage/recalculate', range),
}

import type { FeatureListResponse } from '@paperland/shared'

// Feature announcements (Home → Features, sidebar Home count) and the signed-in user's seen flags.
export const featuresApi = {
  list: () => api.get<{ data: FeatureListResponse }>('/api/features'),
  markSeen: (keys: string[]) => api.post<{ success: boolean }>('/api/features/seen', { keys }),
}

export const usersApi = {
  list: () => api.get<{ data: User[] }>('/api/users'),
  create: (payload: { username: string; password: string; role: UserRole }) =>
    api.post<{ data: User }>('/api/users', payload),
  update: (id: number, payload: { role?: UserRole; nickname?: string | null; password?: string }) =>
    api.patch<{ data: User }>(`/api/users/${id}`, payload),
  /** Activate a pending (self-registered) account. */
  approve: (id: number) => api.post<{ data: User }>(`/api/users/${id}/approve`),
  /** Reject a pending registration (deletes it; active accounts can't be deleted). */
  reject: (id: number) => api.delete<{ success: boolean }>(`/api/users/${id}`),
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

  // Cross-paper aggregate. `scope=all` lists published + shared notes (+ own); admins get every
  // note (`shared: false` marks the private ones). Default (no opts) = the caller's own.
  listAll: (opts?: { scope?: VisibilityScope }) => {
    const qs = new URLSearchParams()
    if (opts?.scope) qs.set('scope', opts.scope)
    const q = qs.toString()
    return api.get<{ data: NoteWithAuthor[] }>(`/api/notes${q ? `?${q}` : ''}`)
  },

  // Toggle the note's "reading complete" flag (the note must already exist).
  setCompleted: (paperId: number, completed: boolean) =>
    api.post<{ data: Note }>(`/api/papers/${paperId}/note/completed`, { completed }),

  // Publish / unpublish the caller's note (the note must already exist and be non-empty).
  setVisibility: (paperId: number, is_public: boolean) =>
    api.put<{ data: Note }>(`/api/papers/${paperId}/note/visibility`, { is_public }),

  // Body-less list of OTHER users' notes the caller may read for a paper (published + shared;
  // admin: all) — the right-panel section. Degrades to
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
import type { PaperReferenceLink, ReferenceLinkPreview } from '@paperland/shared'

export const referenceLinksApi = {
  // mine (default) / all scoped read; anonymous (or a not-yet-ready route) degrades silently to empty.
  async getForPaper(paperId: number, scope: VisibilityScope = 'mine'): Promise<{ data: PaperReferenceLink[] }> {
    try {
      const res = await fetch(`/api/papers/${paperId}/reference-links?scope=${scope}`, { credentials: 'same-origin' })
      if (!res.ok) return { data: [] }
      return await res.json()
    } catch {
      return { data: [] }
    }
  },

  // Crawl a url server-side to derive `${document.title} (${hostname})`. Authenticated only.
  preview: (url: string) =>
    api.get<{ data: ReferenceLinkPreview }>(`/api/reference-links/preview?url=${encodeURIComponent(url)}`),

  // Only `url` is required; `title` is optional and `description` is the auto-derived preview string.
  create: (paperId: number, data: { url: string; title?: string | null; description?: string | null }) =>
    api.post<{ data: PaperReferenceLink }>(`/api/papers/${paperId}/reference-links`, data),

  update: (id: number, data: { title?: string | null; url?: string; description?: string | null }) =>
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
  // No delete: images referenced by notes and Q&A inputs must keep resolving.
}

// Config (safe subset) exposed to the frontend via /api/config/*.
export const configApi = {
  pdf: () => api.get<{ screenshot_dpi: number }>('/api/config/pdf'),
  notes: () => api.get<{ image_width_tiers: { sm: number; md: number; lg: number } }>('/api/config/notes'),
}

// Deep Research API (/research)
import type { ResearchSeed, ResearchSessionDetail, ResearchSessionSummary, ResearchStep, ResearchToolEvent } from '@paperland/shared'
import { consumeNamedEventStream } from '@/lib/named-event-stream'

export const researchApi = {
  list: (scope: VisibilityScope = 'mine') =>
    api.get<{ data: ResearchSessionSummary[] }>(`/api/research?scope=${scope}`),
  get: (id: number) => api.get<{ data: ResearchSessionDetail }>(`/api/research/${id}`),
  seedPreview: (resultId: number) => api.get<{ data: ResearchSeed }>(`/api/research/seed-preview?result_id=${resultId}`),
  create: (body: { topic: string; model_name: string; seed_result_id?: number }) =>
    api.post<{ data: ResearchSessionDetail }>('/api/research', body),
  remove: (id: number) => api.delete<{ success: boolean }>(`/api/research/${id}`),
  /**
   * Idle: starts a round with every queued message plus `user_text` (may be empty when the queue is
   * not). While a round runs, or with `queue_only`, the message is only queued (`queued: true`).
   */
  submit: (id: number, body: { user_text: string; model_name: string; queue_only?: boolean }) =>
    api.post<{ data: ResearchSessionDetail; queued: boolean }>(`/api/research/${id}/steps`, body),
  removeQueued: (id: number, messageId: number) =>
    api.delete<{ data: ResearchSessionDetail }>(`/api/research/${id}/queue/${messageId}`),
  retry: (id: number, stepId: number, body: { user_text?: string; model_name?: string } = {}) =>
    api.post<{ data: ResearchSessionDetail }>(`/api/research/${id}/steps/${stepId}/retry`, body),
  cancel: (id: number, stepId: number) => api.post<{ success: boolean }>(`/api/research/${id}/steps/${stepId}/cancel`),
  editTitles: (id: number, body: { title: string; section_titles: string[] }) =>
    api.put<{ data: ResearchSessionDetail }>(`/api/research/${id}/titles`, body),
  truncate: (id: number, afterStepIndex: number) =>
    api.post<{ data: ResearchSessionDetail; removed_steps: number }>(`/api/research/${id}/truncate`, { after_step_index: afterStepIndex }),

  /** Observe one step over SSE until it ends; resolves with the terminal step. */
  async stream(
    stepId: number,
    options: {
      signal?: AbortSignal
      onStart?: (step: ResearchStep) => void
      onDelta?: (delta: { step_id: number; delta: string; answer_length: number; first_chunk_at: string | null }) => void
      /** The output was invalid; the automatic repair request is running. */
      onRepairing?: (step: ResearchStep) => void
      /** The agent started or finished a tool call (MCP tool, or `web` for web search). */
      onTool?: (event: ResearchToolEvent) => void
    } = {},
  ): Promise<ResearchStep> {
    const response = await fetch(`/api/research/steps/${stepId}/stream`, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { Accept: 'text/event-stream' },
      signal: options.signal,
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: response.statusText }))
      const message = body.error?.message || body.message || 'Research stream failed'
      if (response.status === 401) dispatchUnauthorized()
      throw new Error(message)
    }
    if (!response.body) throw new Error('Research stream returned no response body')
    let terminal: ResearchStep | null = null
    await consumeNamedEventStream(response.body, (event) => {
      const payload = JSON.parse(event.data)
      if (event.event === 'start') options.onStart?.(payload.step)
      else if (event.event === 'delta') options.onDelta?.(payload)
      else if (event.event === 'repairing') options.onRepairing?.(payload.step)
      else if (event.event === 'tool') options.onTool?.(payload)
      else if (event.event === 'done' || event.event === 'error') terminal = payload.step
    })
    if (!terminal) throw new Error('Research stream ended before a terminal event')
    return terminal
  },
}
