import type { ResearchCitation } from '@paperland/shared'

export interface PaperRefItem {
  kind?: 'paper'
  id: string
  fallback_text?: string
  comment?: string
  unverified?: boolean
  added?: boolean
}
export interface LinkRefItem {
  kind: 'link'
  url: string
  citation: ResearchCitation
  comment?: string
  added?: boolean
}
export type RefItem = PaperRefItem | LinkRefItem
export interface PaperRefSection {
  title: string
  description?: string
  items: RefItem[]
  removed?: RefItem[]
}
