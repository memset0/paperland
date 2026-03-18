import { dispatchApiError } from '@/lib/error-bus'

const BASE_URL = ''

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
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
    dispatchApiError(message)
    throw new Error(message)
  }

  return response.json()
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
}
