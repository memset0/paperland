## Why

The Q&A feed puts question text and numerous metadata controls on a single cramped line, making questions hard to scan and the layout fragile on phones. Give the feed a clear reading hierarchy and more comfortable spacing while preserving its existing Q&A workflows.

## What Changes

- Separate question text from model, reading, attachment, link, and background controls; allow longer question previews and show an explicit expand affordance.
- Make the question an accessible collapsible trigger with independent sibling action controls.
- Improve paper/time metadata, card spacing, loading and empty states, and pagination; label the feed and highlight scope controls distinctly.
- Keep the shared AppPage layout, chronological pagination, default-collapsed cards, live answers, permissions, and personal background colors.
- Verify the actual interface through agent-browser at desktop and phone widths in light and dark themes, then deploy the production frontend.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `qa-feed-page`: Readable responsive feed cards with separate question and metadata rows, independent controls, explicit expansion, and clearly distinguished scope selectors.

## Impact

Frontend QAPage.vue and QAFeedPanel.vue, plus the three architecture/API documents. Reuses existing Vue, shadcn-vue, Lucide, theme tokens, stores, and APIs; no runtime dependency, backend, or database changes.
