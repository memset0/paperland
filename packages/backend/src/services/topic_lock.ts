const pending = new Map<number, Promise<void>>()

/** Serialize publication and ACL/credential changes for one Topic in the service process. */
export async function withTopicLock<T>(topicId: number, work: () => Promise<T> | T): Promise<T> {
  const previous = pending.get(topicId) ?? Promise.resolve()
  let release!: () => void
  const current = new Promise<void>((resolve) => { release = resolve })
  const tail = previous.then(() => current)
  pending.set(topicId, tail)
  await previous
  try { return await work() }
  finally {
    release()
    if (pending.get(topicId) === tail) pending.delete(topicId)
  }
}
