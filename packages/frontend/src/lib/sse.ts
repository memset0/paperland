export interface ServerSentEvent {
  event: string
  data: string
}

/** Incremental SSE frame parser that is safe across arbitrary network chunk boundaries. */
export class ServerSentEventParser {
  private buffer = ''

  push(chunk: string): ServerSentEvent[] {
    this.buffer += chunk
    const events: ServerSentEvent[] = []
    while (true) {
      const match = /\r\n\r\n|\n\n|\r\r/.exec(this.buffer)
      if (!match || match.index == null) break
      const frame = this.buffer.slice(0, match.index)
      this.buffer = this.buffer.slice(match.index + match[0].length)
      const parsed = this.parseFrame(frame)
      if (parsed) events.push(parsed)
    }
    return events
  }

  finish(): ServerSentEvent[] {
    const frame = this.buffer
    this.buffer = ''
    const parsed = this.parseFrame(frame)
    return parsed ? [parsed] : []
  }

  private parseFrame(frame: string): ServerSentEvent | null {
    let event = 'message'
    const data: string[] = []
    for (const line of frame.split(/\r\n|\n|\r/)) {
      if (!line || line.startsWith(':')) continue
      if (line.startsWith('event:')) {
        const value = line.slice(6)
        event = (value.startsWith(' ') ? value.slice(1) : value) || 'message'
      } else if (line.startsWith('data:')) {
        const value = line.slice(5)
        data.push(value.startsWith(' ') ? value.slice(1) : value)
      }
    }
    return data.length > 0 ? { event, data: data.join('\n') } : null
  }
}
