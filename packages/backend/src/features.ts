// Feature registry for Home → Features (red dot / count on unseen features; no push).
//
// To announce a feature: append an entry here and add its illustration at
// packages/frontend/public/features/<key>.svg. `key` is stored in `feature_views` — never rename it.
// `released_at` is the archive date of the OpenSpec change that shipped the feature (the date prefix
// of its folder in openspec/changes/archive/), or the first commit date when there is no change.

export interface FeatureDefinition {
  key: string
  title: string
  description: string
  /** YYYY-MM-DD */
  released_at: string
}

export const FEATURES: FeatureDefinition[] = [
  {
    key: 'custom-qa',
    title: 'Custom Q&A',
    description: 'Ask any question about a paper, or run the template questions in one click. Answers are kept with the model name and time, and you can regenerate them.',
    released_at: '2026-03-18', // 2026-03-18-qa-module
  },
  {
    key: 'highlight-model-output',
    title: 'Highlight model output',
    description: 'Select text in a Q&A answer and mark it with a color. Highlights are saved and come back when you reopen the page.',
    released_at: '2026-03-19', // 2026-03-19-markdown-highlight
  },
  {
    key: 'copy-latex',
    title: 'Copy LaTeX',
    description: 'Click any rendered formula to copy its LaTeX source, ready to paste into your own notes or paper.',
    released_at: '2026-03-20', // 2026-03-20-upgrade-markdown-parser
  },
  {
    key: 'notes',
    title: 'Notes',
    description: 'Write Markdown notes for each paper next to the PDF, and find all of them on the Notes page.',
    released_at: '2026-05-29', // 2026-05-29-add-paper-notes
  },
  {
    key: 'qa-conversation-view',
    title: 'Q&A conversation view',
    description: 'Read a Q&A thread as a chat: follow up on any answer and see the whole conversation in order.',
    released_at: '2026-10-10', // 2026-10-10-add-qa-conversation-tree-views
  },
  {
    key: 'usage-dashboard',
    title: 'Usage dashboard',
    description: 'See your model usage and estimated cost on Home, with a podium for the top three users. Switch between all time, the last 7 days and the last 30 days.',
    released_at: '2026-10-10', // add-home-dashboard
  },
]

export const FEATURE_KEYS = new Set(FEATURES.map((f) => f.key))
