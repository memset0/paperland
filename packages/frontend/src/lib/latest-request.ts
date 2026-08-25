export interface LatestRequestToken {
  generation: number
  signal: AbortSignal
}

/** Owns one current AbortController and makes stale async callbacks easy to reject. */
export class LatestRequest {
  private generation = 0
  private controller: AbortController | null = null

  begin(): LatestRequestToken {
    this.controller?.abort()
    this.controller = new AbortController()
    return { generation: ++this.generation, signal: this.controller.signal }
  }

  isCurrent(token: LatestRequestToken): boolean {
    return token.generation === this.generation && !token.signal.aborted
  }

  complete(token: LatestRequestToken): void {
    if (token.generation === this.generation) this.controller = null
  }

  cancel(): void {
    this.generation++
    this.controller?.abort()
    this.controller = null
  }
}
