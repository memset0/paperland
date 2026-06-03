## Why

Opening a paper detail page defaults the left-panel viewer to the **"Note"** tab instead of the PDF / translation, which is not the expected behavior. The root cause is a timing bug: `PaperViewerPanel` mounts as soon as the layout is wide enough — before the paper's `pdf_path` / `arxiv_id` have loaded — and the "Note" mode is **always available**. During that loading window "Note" is the *only* available mode, so the old "select the first available mode" rule latched onto it; once PDF / translation appeared, the guard (which only re-picked when the current mode *disappeared*) kept "Note" selected because it was still valid. Net effect: the viewer defaulted into the note.

## What Changes

- The automatic default now prefers a **primary viewer** (PDF or translation) and only falls back to "Note" when it is the *sole* available mode. The default is re-evaluated when primary modes load late, so the panel no longer stays stuck on "Note".
- A user's **explicit selection** — clicking a tab, or arriving via a `?view=note` / `?note=<id>` / `paperland://…?pdf=…` deep link — is now recorded and is **not overridden** when the set of available modes later changes (it only re-picks if the selected mode disappears).

## Capabilities

### Modified Capabilities
- `paper-viewer-modes`: the viewer's auto-select rule no longer treats the always-available "Note" mode as a default; it prefers a primary viewer, re-evaluates as modes load, and preserves explicit selections.

## Impact

- **Frontend only.** `packages/frontend/src/components/PaperViewerPanel.vue` (default-mode selection logic + a `userChose` flag; template binds `@update:model-value` to capture manual tab clicks). No store/API change.
- **Docs**: `docs/frontend-architecture.md` (multi-mode viewer section — corrected the default-selection description and a stale note about the "Note" tab's availability).
