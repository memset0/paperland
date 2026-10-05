## 1. Safe Preference Schema

- [x] 1.1 Confirm `add-qa-all-users-scope` visibility behavior is applied, create a fresh SQLite online backup, and verify integrity/counts before migration
- [x] 1.2 Add `qa_user_preferences` with composite uniqueness, foreign keys, timestamps, and palette field; generate migration and verify no unrelated destructive SQL
- [x] 1.3 Apply migration to a disposable production snapshot and test entry/paper deletion cleanup plus integrity; verify no existing QA rows change

## 2. Preference API and Read Enrichment

- [x] 2.1 Add palette validation and authenticated set/clear upsert endpoint with entry visibility checks; verify invalid, anonymous, preset, own, and other-visible cases
- [x] 2.2 Batch current-viewer preferences into paper/feed QA responses as `background_color`; verify two users receive different values for the same entry and anonymous receives null
- [x] 2.3 Update shared types/store mutation and optimistic/local refresh behavior; verify changing/clearing one entry does not affect another user or entry

## 3. Frontend Rendering

- [x] 3.1 Add one reusable compact palette/clear control to PaperDetail and feed entries; verify keyboard labels and click propagation do not toggle the card unexpectedly
- [x] 3.2 Add theme-aware pale palette container styles for collapsed and expanded states; verify text, badges, hover, focus, and light/dark contrast
- [x] 3.3 Verify cross-surface/device persistence by setting a color in feed and reloading PaperDetail from backend state

## 4. Documentation and Verification

- [x] 4.1 Update all three required docs for schema, API, ownership, palette, and UI; verify snake_case fields match migration/code
- [x] 4.2 Run focused preference/auth/deletion tests plus backend/frontend builds without external calls; verify all pass
- [x] 4.3 Run strict OpenSpec validation, snapshot migration checks, and final diff audit; verify no unrelated paths are staged

## 5. Expanded Notion-style Palette

- [x] 5.1 Expand the shared type and backend validation to gray/brown/orange/yellow/green/blue/purple/pink/red while retaining null as clear; verify unsupported keys remain rejected
- [x] 5.2 Expand the reusable picker and theme-aware card styling to all nine pale colors on both QA surfaces
- [x] 5.3 Update all three required docs and run focused backend tests, frontend/backend builds, and strict OpenSpec validation
