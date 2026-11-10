export type AgentContent = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }

/** Internal typed result; ordinary tool objects keep their existing JSON/text representation. */
export class AgentRichResult {
  constructor(public metadata: unknown, public extra_content: AgentContent[]) {}
}
