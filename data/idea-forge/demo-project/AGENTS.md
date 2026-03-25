# Idea Forge Project: demo-project

This file describes the project structure and conventions for AI agents operating in this directory. Read this file carefully before creating or modifying any content. This project lives under `data/idea-forge/demo-project/` in the Paperland repository.

## Directory Structure

```
demo-project/
├── AGENTS.md              ← You are here. Read this first.
├── papers/                ← Dumped papers from Paperland
│   └── {paper-title-id}/
│       ├── metadata.json      ← Paper metadata (structured)
│       ├── full_text.md       ← Full paper content (Markdown)
│       └── alphaxiv_summary.md  ← (optional) AI summary from AlphaXiv
└── ideas/                 ← Research ideas organized by review status
    ├── unreviewed/        ← New ideas, not yet reviewed
    ├── under-review/      ← Currently being evaluated
    ├── validating/        ← Accepted for validation/prototyping
    └── archived/          ← Completed, discarded, or shelved
```

## Papers Directory

Papers are dumped from the Paperland web app (filtered by tags). Each paper lives in its own subdirectory under `papers/`.

### metadata.json

```json
{
  "id": 123,
  "title": "Paper Title",
  "authors": ["Author A", "Author B"],
  "abstract": "Paper abstract text...",
  "arxiv_id": "2401.12345",
  "corpus_id": "12345678",
  "link": "https://arxiv.org/abs/2401.12345",
  "tags": ["tag1", "tag2"],
  "created_at": "2026-01-15T00:00:00.000Z",
  "updated_at": "2026-03-20T00:00:00.000Z"
}
```

### full_text.md

The full paper content in Markdown format. This is the resolved text from Paperland's content sources (user input or PDF-parsed).

### alphaxiv_summary.md

(Future feature) AI-generated summary from AlphaXiv. May not be present for all papers.

## Ideas Directory

Each idea lives at `ideas/{category}/{idea-name}/README.md`.

### Categories

| Category | Meaning |
|---|---|
| `unreviewed` | Newly created, not yet reviewed by human. **Default for all new ideas.** |
| `under-review` | Currently being evaluated by the researcher |
| `validating` | Accepted for validation, prototyping, or deeper investigation |
| `archived` | Completed, discarded, or shelved for later |

### Idea README.md Format

Every idea MUST have a `README.md` file with YAML frontmatter followed by Markdown content:

```markdown
---
name: "Descriptive Idea Name"
author: "gpt-5.4"
tags:
  - "relevant-topic"
  - "method-category"
create_time: "2026-03-25T14:30:00+09:00"
update_time: "2026-03-25T14:30:00+09:00"
my_score: 0
llm_score: 3
my_comment: ""
summary: "One-line summary: what this idea proposes or investigates"
---

# Idea Title

## Motivation

Why this idea is worth exploring...

## Approach

How to implement or validate this idea...

## Expected Outcome

What we expect to find or achieve...

## Related Papers

- Paper A: relevant because...
- Paper B: relevant because...
```

### Frontmatter Fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | string | yes | — | Display name of the idea |
| `author` | string | yes | — | Who created this idea. Use your model name (e.g. `"gpt-5.4"` for Codex, `"claude-opus-4.6"` for Claude, `"gemini-2.5-pro"` for Gemini). Human-created ideas use `"me"`. |
| `tags` | string[] | no | `[]` | Topic/method tags for filtering |
| `create_time` | ISO 8601 | yes | — | Creation timestamp with timezone |
| `update_time` | ISO 8601 | yes | — | Last modification timestamp with timezone |
| `my_score` | number (0-5) | no | `0` | Human reviewer's score (0 = unrated) |
| `llm_score` | number (0-5) | no | `0` | AI agent's confidence score (0 = unrated) |
| `my_comment` | string | no | `""` | Human reviewer's notes/feedback |
| `summary` | string | yes | — | One-line summary for list views |

**Important**: You may add custom fields to frontmatter as needed. Unknown fields will be preserved by the web UI — they won't be deleted or overwritten.

## Conventions for AI Agents

### Creating Ideas

1. Always place new ideas in `ideas/unreviewed/`
2. Use kebab-case for idea directory names (e.g., `attention-pruning-for-long-context`)
3. Fill in ALL required frontmatter fields
4. Set `author` to your model name — e.g. `"gpt-5.4"` for Codex, `"claude-opus-4.6"` for Claude, `"gemini-2.5-pro"` for Gemini. Do NOT use `"me"` — that is reserved for human-created ideas
5. Set `create_time` and `update_time` to the current time (ISO 8601 with timezone)
6. Set `llm_score` to your confidence level (1-5). Be honest — inflated scores waste reviewer time
7. Leave `my_score` as `0` and `my_comment` as `""` — these are for the human reviewer
8. Write a clear, specific `summary` — the reviewer sees this first in the list view

### Referencing Papers

When your idea builds on papers in the `papers/` directory, reference them by directory name. The reviewer can then cross-reference with the paper content.

### Quality Guidelines

- **Be specific**: "Use LoRA to reduce fine-tuning cost for domain-specific LLMs" is better than "Make fine-tuning cheaper"
- **Be honest about limitations**: Note assumptions, potential failure modes, and what you're uncertain about
- **Show your reasoning**: Explain why this idea is promising, what evidence supports it
- **One idea per README**: Don't combine multiple unrelated ideas in a single file
- **Reference sources**: Link back to specific papers or findings that inspired the idea

### Do NOT

- Move ideas between categories — that's the human reviewer's job (via the web UI)
- Modify `my_score` or `my_comment` — those belong to the human reviewer
- Overwrite existing ideas without being explicitly asked to
- Create ideas outside the `ideas/` directory structure
- Delete or rename paper directories in `papers/`
