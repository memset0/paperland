import type { Paper } from '@paperland/shared'

/**
 * Whether a paper has any full text Q&A can use (a parsed PDF or user-provided content). The
 * backend picks the source by `content_priority` and rejects asks without one (HTTP 409).
 */
export function paperHasQAContent(paper: Pick<Paper, 'contents'> | null | undefined): boolean {
  const contents = paper?.contents as Record<string, unknown> | null | undefined
  return !!contents && Object.values(contents).some((value) => typeof value === 'string' && value.trim().length > 0)
}

export const NO_QA_CONTENT_HINT = 'Parse the PDF or provide the full text before asking'
