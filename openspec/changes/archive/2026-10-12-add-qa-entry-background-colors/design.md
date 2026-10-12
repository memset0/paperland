## Context

QA entry identity is stable and shared, but UI-only localStorage would be per browser and unsuitable for multi-user/cross-device state. Colors apply to the viewer, not the asker or result, so they cannot live on `qa_entries`.

## Goals / Non-Goals

**Goals:**

- Store one optional palette key per viewer/entry.
- Reuse one API/visual component on PaperDetail and feed.
- Allow marking any entry the viewer may read.

**Non-Goals:**

- No arbitrary colors, rich callout metadata, per-result colors, or sharing preferences.
- No change to QA ownership, scope, content, or Service execution.

## Decisions

### 1. Use a separate preference table

`qa_user_preferences(user_id, qa_entry_id, background_color, created_at, updated_at)` uses a composite primary/unique key. This avoids duplicating viewer state on a shared entry and leaves room for explicit future preference columns.

### 2. Upsert one endpoint and enrich normal reads

Use `PUT /api/qa/:entryId/preferences` with `{ background_color: key|null }`. Validate login, entry existence, and viewer visibility. Null deletes the row. Paper/feed QA responses include `background_color`; batch join preferences instead of fetching per card.

### 3. Store semantic keys only

Persist nine Notion-style semantic keys: `gray`, `brown`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`, and `red`. Frontend maps them to very pale light/dark theme tokens. The card root receives the treatment so collapsed/expanded layouts cannot diverge. Hover uses a subtle blend of the same color rather than replacing it with generic muted background.

### 4. Apply after mine/all scope

Implement after `add-qa-all-users-scope` so visibility checks and marking another user's entry share one authorization rule. Preset/own entry behavior is otherwise independent.

## Risks / Trade-offs

- [Preference table grows] → One compact row exists only after a user explicitly colors an entry; composite index supports lookups.
- [Color reduces contrast] → Use semantic pale tokens and verify both themes/focus states.
- [Paper deletion leaves orphans] → Delete preferences before entries in the existing transaction or use an explicit safe cascade.

## Migration Plan

Create a fresh online backup, add the table/index, test on a snapshot, deploy API/read enrichment, then both UI surfaces. No backfill is required. Rollback can leave the unused additive table or drop it in a later explicitly destructive migration.
