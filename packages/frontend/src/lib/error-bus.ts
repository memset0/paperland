import { toast } from 'vue-sonner'

export function dispatchApiError(message: string) {
  toast.error(message)
}

// Auth event bus: a 401 from any request signals that login is required.
const authTarget = new EventTarget()

export function dispatchUnauthorized() {
  authTarget.dispatchEvent(new Event('unauthorized'))
}

/** Subscribe to "login required" events. Returns an unsubscribe function. */
export function onUnauthorized(cb: () => void): () => void {
  authTarget.addEventListener('unauthorized', cb)
  return () => authTarget.removeEventListener('unauthorized', cb)
}
