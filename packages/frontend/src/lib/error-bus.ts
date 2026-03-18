export const API_ERROR_EVENT = 'api-error'

const errorBus = new EventTarget()

export function dispatchApiError(message: string) {
  errorBus.dispatchEvent(new CustomEvent(API_ERROR_EVENT, { detail: message }))
}

export { errorBus }
