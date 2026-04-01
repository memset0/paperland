## Context

The paper detail page (`PaperDetail.vue`) displays three types of content:
1. **Kimi summary** — external content from papers.cool, rendered as its own card
2. **Template QA** — configured questions from `config.yml`, managed by `qaStore.templates`
3. **Free QA** — user-submitted ad-hoc questions, stored in `qaStore.qaData.free`

Currently, `QAList.vue` merges template and free QA into a single `unifiedEntries` array (free first, then template) rendered in one card. The sidebar nav (`QAPanelNav.vue`) mirrors this mixed order. All questions default to open (or inherit localStorage state), and content is always single-line truncated.

## Goals / Non-Goals

**Goals:**
- Split QAList into two independent cards: Template QA card and Free QA card
- Card order: Kimi summary → Template QA → Free QA
- Sidebar nav: template QA entries first (only those with results), then free QA entries
- All questions default to collapsed on page load (ignore localStorage)
- Collapsed: single-line truncated title. Expanded: full content with natural word-wrap (no `\n` rendering, just CSS wrapping)

**Non-Goals:**
- No backend API changes
- No changes to QA data fetching, submission, or polling logic
- No changes to Kimi summary card behavior
- No changes to QAInput component

## Decisions

### 1. Split QAList into two card sections within the same component

Rather than creating two separate components, QAList.vue will render two `<div class="rounded-xl border ...">` card containers — one for template entries, one for free entries. This keeps all QA rendering logic, dialogs, and event handlers in one place.

**Alternative**: Two separate components (QATemplateList, QAFreeList). Rejected because they'd share most logic (collapse, regen, status icons) and need the same dialogs, leading to heavy duplication.

### 2. Default collapsed state — always start closed, no localStorage read on mount

Change `isOpen()` to always return `false` for the initial render. The `@toggle` handler still writes to localStorage (for sidebar nav `navigateTo` to work), but on page load, all `<details>` elements start without `open` attribute.

### 3. Title display: `line-clamp-1` in summary, remove clamp in expanded content

In `<summary>`, keep `line-clamp-1` on the title text. In the expanded `<div>` body, the full answer is already rendered via `QAResultView` → `MarkdownContent` which has no truncation. For the question title repeated or shown in expanded mode — ensure no `line-clamp` or `truncate` class is applied so text wraps naturally.

### 4. Sidebar nav filtering and reordering

In `PaperDetail.vue`, the `qaNavEntries` computed property will:
- First: template entries that have results (`qaStore.qaData.template[name]?.results.length > 0`)
- Then: all free entries (same as before)

This matches the visual card order and hides unanswered template questions from nav.

### 5. Each card has its own header with expand/collapse all buttons

Each card gets independent "全部展开" / "全部折叠" buttons scoped to its own `data-*` container. The "一键生成" button stays on the Template QA card header only.

## Risks / Trade-offs

- **localStorage stale state**: Old localStorage keys from the unified view still exist but won't cause issues — we just ignore them on load by defaulting to closed. → No migration needed.
- **Scroll spy index mismatch**: QAPanelNav uses `[data-qa-entry]` selector. With two cards, entries are still in DOM order (template card first, free card second), matching the new nav order. → No scroll spy changes needed as long as DOM order matches nav order.
