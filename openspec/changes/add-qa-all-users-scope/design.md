## Context

`qa_entries.user_id` already distinguishes user questions; preset entries use null. Paper QA currently fetches all entries then filters free rows to the viewer, while the feed honors `scope=all` only for admins and paginates after loading all matching rows. No schema change is needed.

## Goals / Non-Goals

**Goals:**

- Let every logged-in viewer explicitly read others' User Q&A.
- Keep mine as the privacy-preserving default.
- Keep mutation ownership and all non-QA private data unchanged.

**Non-Goals:**

- No public/anonymous User Q&A.
- No sharing of another user's highlights, notes, tags, or preferences.
- No database migration or External API scope change.

## Decisions

### 1. Use the same scope contract on both Internal APIs

Add `scope=mine|all` to paper QA and retain it on feed. Invalid/missing values behave as mine. Anonymous paper reads are forcibly mine and therefore return no User Q&A; feed remains login-only.

### 2. Separate read scope from write authorization

Response entries carry `user_id`, `username`, and a viewer capability such as `can_manage` (or an equivalent frontend-derived flag from current user/role). Backend mutation handlers remain authoritative: owner/admin succeeds, other users receive 404.

### 3. Query and paginate in SQL

Use filtered count/page queries and joins/batched user lookup instead of loading all entries and slicing in JavaScript. Paper detail is unpaginated but usernames/results should be loaded without one user query per entry.

### 4. Keep PaperDetail and feed scope state independent

Each surface defaults to mine on entry. Feed switching resets page to 1. Paper switching refetches with the current mounted card scope; leaving/re-entering starts mine. This avoids a hidden global preference changing another screen.

## Risks / Trade-offs

- [All scope reveals user questions to every account] → Make it explicit, default mine, display asker, preserve owner/admin mutations.
- [N+1 queries] → Batch creators/results and paginate in SQL.
- [Frontend hides an action but API is callable] → Keep backend authorization and test direct calls.

## Migration Plan

No database migration. Deploy backend response/auth changes, shared types/store, then both UI selectors. Roll back by removing all scope; stored data is unchanged.

