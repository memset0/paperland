## Context

The Zotero plugin extracts arXiv IDs from Zotero items via `extractArxivId()` in `packages/zotero-plugin/src/modules/arxiv.ts`. The current regex patterns capture optional version suffixes (`v\d+`), so IDs like `2401.10774v3` are returned as-is. The backend treats different version strings as different papers, causing deduplication issues.

## Goals / Non-Goals

**Goals:**
- Strip version suffixes from arXiv IDs at extraction time in the Zotero plugin
- Ensure all extraction paths (archiveID, Extra field, URL) produce version-free IDs

**Non-Goals:**
- Backend-side normalization of arXiv IDs (could be done separately if needed)
- Handling existing papers already stored with versioned IDs in the database

## Decisions

**Strip version suffix after regex match, not by changing regex groups.**

The regex patterns already capture the version suffix via `(?:v\d+)?`. Rather than restructuring capture groups (which risks breaking the patterns), we add a single `replace(/v\d+$/, "")` call on the extracted ID before returning.

This is simpler, works for both modern (`2401.10774v3`) and legacy (`cond-mat/0312345v2`) formats, and is applied in one place — the `extractArxivId()` function's return points.

**Alternative considered:** Modify each regex to use non-capturing group only. Rejected because it requires changing 6 regex patterns, increasing the chance of introducing a parsing bug.

## Risks / Trade-offs

- [Risk] Papers already stored with versioned IDs won't auto-merge. → Acceptable; this is a forward-fix. Existing data can be cleaned up separately if needed.
- [Risk] Some rare use case might need version info. → The backend's arXiv service always fetches the latest version anyway, so version info provides no value.
