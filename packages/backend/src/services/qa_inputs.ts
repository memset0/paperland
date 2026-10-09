import { z } from 'zod'
import type { QAHistoryInput, QAImageInput, QAInput, QATextSelectionInput } from '@paperland/shared'

const textSegmentSchema = z.object({
  page: z.number().int().positive(),
  ts: z.number().int().min(0),
  te: z.number().int().min(0),
})

const regionSchema = z.object({
  page: z.number().int().positive(),
  rx: z.number().min(0).max(1),
  ry: z.number().min(0).max(1),
  rw: z.number().min(0).max(1),
  rh: z.number().min(0).max(1),
})

/** Inputs as a client submits them; labels and image URLs are assigned by the backend. */
export const qaInputRequestSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('text_selection'),
    label: z.string().optional(),
    text: z.string().trim().min(1),
    pdf: z.array(textSegmentSchema).min(1),
  }),
  z.object({
    kind: z.literal('image'),
    label: z.string().optional(),
    image_hash: z.string().regex(/^[0-9a-f]{6,64}$/, 'image_hash must reference an image-host image'),
    url: z.string().optional(),
    pdf: regionSchema.nullable().optional(),
  }),
  z.object({
    kind: z.literal('history'),
    result_id: z.number().int().positive(),
  }),
])

export type QAInputRequestParsed = z.infer<typeof qaInputRequestSchema>

/** Parse stored `qa_entries.inputs` JSON; malformed or absent data reads as no inputs. */
export function parseStoredInputs(raw: string | null | undefined): QAInput[] {
  if (!raw) return []
  try {
    const value = JSON.parse(raw)
    return Array.isArray(value) ? value as QAInput[] : []
  } catch {
    return []
  }
}

export function historyInput(inputs: QAInput[]): QAHistoryInput | null {
  return (inputs.find((input) => input.kind === 'history') as QAHistoryInput | undefined) ?? null
}

export function contentInputs(inputs: QAInput[]): Array<QATextSelectionInput | QAImageInput> {
  return inputs.filter((input): input is QATextSelectionInput | QAImageInput => input.kind !== 'history')
}

const LABEL_PREFIX = { text_selection: 'Quote', image: 'Image' } as const

/** Highest label number already used per kind (`Quote3` → 3) across the given inputs. */
export function maxLabelNumbers(inputs: QAInput[]): { text_selection: number; image: number } {
  const max = { text_selection: 0, image: 0 }
  for (const input of contentInputs(inputs)) {
    const match = new RegExp(`^${LABEL_PREFIX[input.kind]}(\\d+)$`).exec(input.label)
    if (match) max[input.kind] = Math.max(max[input.kind], Number(match[1]))
  }
  return max
}

/**
 * Assign chain-unique labels to new content inputs, continuing each kind's numbering after the
 * ancestors' highest label. A client-suggested label is kept only when it is well-formed and
 * still unused, so draft tokens like `@Image2` stay valid; otherwise the next free number is used.
 */
export function assignLabels<T extends { kind: 'text_selection' | 'image'; label?: string }>(
  ancestorInputs: QAInput[],
  inputs: T[],
): Array<T & { label: string }> {
  const used = new Set(contentInputs(ancestorInputs).map((input) => input.label))
  const next = maxLabelNumbers(ancestorInputs)
  return inputs.map((input) => {
    const prefix = LABEL_PREFIX[input.kind]
    const suggested = input.label?.replace(/^@/, '')
    if (suggested && new RegExp(`^${prefix}[1-9]\\d*$`).test(suggested) && !used.has(suggested)) {
      used.add(suggested)
      next[input.kind] = Math.max(next[input.kind], Number(suggested.slice(prefix.length)))
      return { ...input, label: suggested }
    }
    let label: string
    do {
      next[input.kind] += 1
      label = `${prefix}${next[input.kind]}`
    } while (used.has(label))
    used.add(label)
    return { ...input, label }
  })
}

/** Human-readable page or page range of an input, e.g. `page 3` / `pages 3–4`. */
export function inputPages(input: QATextSelectionInput | QAImageInput): string | null {
  if (input.kind === 'image') return input.pdf ? `page ${input.pdf.page}` : null
  const pages = [...new Set(input.pdf.map((segment) => segment.page))].sort((a, b) => a - b)
  if (pages.length === 0) return null
  return pages.length === 1 ? `page ${pages[0]}` : `pages ${pages[0]}–${pages[pages.length - 1]}`
}
