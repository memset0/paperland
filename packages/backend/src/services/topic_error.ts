export class TopicError extends Error {
  statusCode: number
  constructor(public status: number, message: string) { super(message); this.statusCode = status }
}
