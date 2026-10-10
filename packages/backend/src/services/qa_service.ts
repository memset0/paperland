import { eq } from 'drizzle-orm'
import { getDatabase, schema } from '../db/index.js'
import { callModel, modelSupportsAgentTools, type ModelInvokeOptions } from './model_invoke.js'
import { attachAgentTools, UPLOAD_IMAGE_TOOL } from './agent_attach.js'
import { buildQAInput, resolvePaperContent } from './qa_formatter.js'

/** Paper text for Q&A chosen by `content_priority`, or null when none is usable. */
function resolveContent(paper: any): string | null {
  return resolvePaperContent(paper)?.text ?? null
}

export interface AskQuestionOptions extends ModelInvokeOptions {
  /** Entry being answered; its system prompt, inputs, and follow-up chain shape the model input. */
  entryId?: number
  /** User the run is for: on Codex app-server models their agent token gives the run `upload_image`. */
  agentUserId?: number | null
}

/**
 * Answer one run of a Q&A entry. The model receives the entry's system prompt as system content
 * and <paper>/<references>/<inputs>/<history>/<question> as the user message (see qa_formatter).
 * Without an entry id the question is answered as a plain free question with the default prompt.
 */
export async function askQuestion(
  paperId: number,
  prompt: string,
  modelName: string,
  options: AskQuestionOptions = {},
): Promise<{ answer: string; model_name: string }> {
  const db = getDatabase()
  const { entryId, agentUserId, ...invokeOptions } = options
  const entry = entryId != null
    ? db.select().from(schema.qaEntries).where(eq(schema.qaEntries.id, entryId)).get()
    : undefined
  const { input } = buildQAInput(db, entry ?? {
    id: -1, paper_id: paperId, user_id: null, type: 'free', template_name: null, prompt,
    status: 'pending', error: null, created_at: '', instruction: null, inputs: null, parent_entry_id: null,
  }, prompt)

  if (agentUserId != null && modelSupportsAgentTools(modelName)) {
    attachAgentTools(input, agentUserId, { tools: [UPLOAD_IMAGE_TOOL] })
  }
  const answer = await callModel(input, modelName, invokeOptions)
  return { answer, model_name: modelName }
}

export { resolveContent }
