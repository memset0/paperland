export interface SelectableQAResult {
  id: number
  completed_at: string
  created_at?: string
  status?: string
}

function completionTime(result: SelectableQAResult): number {
  const timestamp = result.status && result.status !== 'done'
    ? (result.created_at || result.completed_at)
    : result.completed_at
  const value = Date.parse(timestamp)
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY
}

/** Comparator for Array.sort: newest completion first, then greatest id. */
export function compareQAResultsNewestFirst(a: SelectableQAResult, b: SelectableQAResult): number {
  const aTime = completionTime(a)
  const bTime = completionTime(b)
  if (aTime !== bTime) return bTime > aTime ? 1 : -1
  return b.id - a.id
}

export function latestQAResultId(results: SelectableQAResult[]): string {
  if (results.length === 0) return ''
  return String([...results].sort(compareQAResultsNewestFirst)[0].id)
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
