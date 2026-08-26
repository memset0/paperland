import { ServerSentEventParser, type ServerSentEvent } from './sse'

/** Consume named SSE frames in order across arbitrary network chunk boundaries. */
export async function consumeNamedEventStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: ServerSentEvent) => void | Promise<void>,
): Promise<void> {
  const parser = new ServerSentEventParser()
  const decoder = new TextDecoder()
  const reader = body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      for (const event of parser.push(decoder.decode(value, { stream: true }))) await onEvent(event)
    }
    for (const event of parser.push(decoder.decode())) await onEvent(event)
    for (const event of parser.finish()) await onEvent(event)
  } finally {
    reader.releaseLock()
  }
}
