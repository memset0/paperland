## Context

The tag management page (`TagManagement.vue`) already has a merge confirmation dialog and the backend already has a working merge endpoint (`POST /api/tags/:id/merge`). The rename endpoint (`PATCH /api/tags/:id`) correctly returns HTTP 409 with a JSON body containing `{ error: { code: 'TAG_NAME_CONFLICT' }, target_tag: {...} }` when a name conflict occurs.

The bug: the generic API client (`api/client.ts`) throws an error on any non-2xx response (line 20-25), discarding the response body. The `renameTag` store call never returns the 409 body — it throws a generic Error. The `confirmRename` function's catch block (line 67-74) catches this generic error and shows the red "标签名已存在" text, never reaching the merge dialog code path (line 58-63).

## Goals / Non-Goals

**Goals:**
- Make the tag rename conflict flow correctly trigger the merge confirmation dialog
- Minimal, surgical fix — the merge dialog and backend endpoint already work

**Non-Goals:**
- Changing the backend 409 response format (it's already correct)
- Refactoring the generic API client for all endpoints (only fix the rename path)
- Adding new UI components (the merge dialog already exists)

## Decisions

### Decision 1: Handle 409 in the `renameTag` store function instead of modifying the generic API client

**Rationale:** The generic API client's throw-on-error behavior is correct for most endpoints. Modifying it globally (e.g., not throwing on 409) could introduce subtle bugs elsewhere. Instead, the `renameTag` function in the tags store will use `fetch` directly (or catch the error and re-fetch the response) to preserve the 409 response body.

**Approach:** Change `renameTag` in `stores/tags.ts` to use raw `fetch` so it can read the 409 response body and return it instead of throwing. The `confirmRename` handler in `TagManagement.vue` already has the correct logic to detect `TAG_NAME_CONFLICT` and show the merge dialog — it just needs to receive the response body.

**Alternative considered:** Adding a `rawPatch` method to the API client that doesn't throw on specific status codes. Rejected because it adds complexity to the generic client for a single use case.

### Decision 2: Clean up the catch block in `confirmRename`

The catch block currently has a redundant 409 check (line 68) that sets the red error text. After the fix, 409 responses will be handled in the success path, so the catch block only needs to handle genuine errors (network failures, server errors).

## Risks / Trade-offs

- [Risk] Bypassing the generic API client for one call → slight inconsistency in error handling patterns → Acceptable for a single endpoint; the alternative (modifying the generic client) has higher blast radius.
