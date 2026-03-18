interface DedupEntry {
  promise: Promise<any>
  resolve: (value: any) => void
  reject: (err: any) => void
}

const initializingPapers = new Map<string, DedupEntry>()

export function getDedupKey(type: 'arxiv' | 'corpus', id: string): string {
  return `${type}:${id}`
}

export async function withDedup<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = initializingPapers.get(key)
  if (existing) {
    return existing.promise as Promise<T>
  }

  let resolve!: (value: any) => void
  let reject!: (err: any) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  initializingPapers.set(key, { promise, resolve, reject })

  try {
    const result = await fn()
    resolve(result)
    return result
  } catch (err) {
    reject(err)
    throw err
  } finally {
    initializingPapers.delete(key)
  }
}
