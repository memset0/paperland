export type TopicRole = 'owner' | 'editor' | 'viewer'
export type TopicDefaultAccess = 'none' | 'editor' | 'viewer'
export type McpCallCounts = Record<string, number>

export interface TopicManifest {
  format_version: 1 | 2
  title: string
  description: string
}
export interface TopicDirectory {
  id: string
  name: string
  parent_id: string | null
  description?: string
}
export interface TopicReferenceCitation {
  title: string
  author?: string[]
  year?: number
  month?: string
  howpublished?: string
  note?: string
}
export interface TopicPaper {
  id: string
  reference_number?: number
  title: string
  paper_id?: number
  s2_id?: string
  url?: string
  citation?: TopicReferenceCitation
  verification?: 'verified' | 'unverified'
  directory_ids: string[]
  comment: string
  authors?: string[]
  year?: number
}
export interface TopicPaperList {
  format_version: 1
  directories: TopicDirectory[]
  papers: TopicPaper[]
}
export interface TopicSnapshot {
  topic: TopicManifest
  report: string
  pages?: Record<string, string>
  agent_instructions?: string
  list: TopicPaperList
}
export interface TopicDocument {
  path: string
  title: string
  body: string
  references: number[]
  exists: boolean
  fonticon?: string
  kind?: 'page' | 'agent_instructions'
  slug?: string
  url?: string
}
export interface TopicTag {
  topic_id: number
  node_id: string
  name: string
}
export interface TopicSummary {
  id: number
  owner_id: number
  owner_display_name: string
  title: string
  description: string
  permission: TopicRole
  default_access: TopicDefaultAccess
  published_commit: string | null
  created_at: string
  updated_at: string
  legacy_research_session_id?: number | null
}
export interface TopicVersion {
  commit: string
  parent_commit: string | null
  message: string
  author_name: string
  author_email: string
  committer_name: string
  committer_email: string
  committed_at: string
  pushed_at: string
  pushed_by_user_id: number | null
  pushed_by_display_name: string
}
export interface TopicDetail extends TopicSummary {
  home_page: string
  commit: string
  snapshot: TopicSnapshot
  paper_bindings: Record<string, number | null>
  paper_in_library: Record<string, boolean>
  paper_importable?: Record<string, boolean>
  git_url: string
  mcp_url: string
  my_mcp_call_counts: McpCallCounts
  directories: Array<TopicDirectory & { depth: number }>
  documents: TopicDocument[]
  reference_numbers: Record<string, number>
  next_reference_number: number
}
export interface TopicMember {
  user_id: number
  username: string
  display_name: string
  role: TopicRole
  effective_role: TopicRole
  active: boolean
}
export interface TopicCredential {
  id: number
  created_at: string
  rotated_at: string | null
  revoked_at: string | null
}
export interface TopicsConfig {
  repos_dir: string
  git_path: string
  max_file_bytes: number
  max_push_bytes: number
  max_commits_per_push: number
  operation_timeout_ms: number
}
export interface PdfPagesConfig {
  pdfinfo_path: string
  pdftotext_path: string
  pdftoppm_path: string
  max_dimension: number
  max_image_bytes: number
  timeout_ms: number
  max_concurrency: number
}
