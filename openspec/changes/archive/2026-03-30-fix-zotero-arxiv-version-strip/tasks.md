## 1. Strip version suffix from arXiv IDs

- [x] 1.1 In `packages/zotero-plugin/src/modules/arxiv.ts`, add a `stripVersion()` helper that removes trailing `vN` from an arXiv ID string (e.g. `id.replace(/v\d+$/, "")`)
- [x] 1.2 Apply `stripVersion()` to the return value of `extractArxivId()` — wrap each `return id` and each `return m[1]` so the caller always receives a version-free ID

## 2. Documentation

- [x] 2.1 Update `docs/zotero-plugin.md` to note that arXiv IDs are normalized (version suffix stripped) before being sent to the backend
