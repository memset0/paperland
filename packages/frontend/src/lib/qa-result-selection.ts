export interface SelectableQAResult {
  id: number
  completed_at: string
  created_at?: string
  status?: string
}

/** When the answer was requested (created); legacy rows without created_at fall back to completion. */
function requestTime(result: SelectableQAResult): number {
  const value = Date.parse(result.created_at || result.completed_at)
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY
}

/**
 * Comparator for Array.sort: most recently requested first (by created_at, regardless of status or
 * completion time), then greatest id. Multi-model submissions create the first-listed model last,
 * so it sorts first.
 */
export function compareQAResultsNewestFirst(a: SelectableQAResult, b: SelectableQAResult): number {
  const aTime = requestTime(a)
  const bTime = requestTime(b)
  if (aTime !== bTime) return bTime > aTime ? 1 : -1
  return b.id - a.id
}

export function latestQAResultId(results: SelectableQAResult[]): string {
  if (results.length === 0) return ''
  return String([...results].sort(compareQAResultsNewestFirst)[0].id)
}

/**
 * The answer a follow-up continues by default: the most recently requested *completed* answer.
 * Returns null when the entry has no completed answer (follow-ups are then unavailable).
 */
export function defaultFollowupResult<T extends SelectableQAResult>(results: T[]): T | null {
  return [...results].filter((result) => (result.status ?? 'done') === 'done').sort(compareQAResultsNewestFirst)[0] ?? null
}

export function qaResultSignature(results: SelectableQAResult[]): string {
  return [...results]
    .sort((a, b) => a.id - b.id)
    .map((result) => `${result.id}:${result.created_at || result.completed_at}:${result.completed_at}`)
    .join('|')
}

export function chooseActiveQAResult(options: {
  results: SelectableQAResult[]
  previousIds: Set<number>
  activeId: string
  requestedId?: number | null
}): string {
  const { results, previousIds, activeId, requestedId } = options
  const currentIds = new Set(results.map((result) => result.id))
  if (requestedId != null && currentIds.has(requestedId)) return String(requestedId)
  if (results.length === 0) return ''

  const activeNumber = Number(activeId)
  const activeStillExists = activeId !== '' && currentIds.has(activeNumber)
  const hasNewId = results.some((result) => !previousIds.has(result.id))
  if (previousIds.size === 0 || hasNewId || !activeStillExists) return latestQAResultId(results)
  return activeId
}
