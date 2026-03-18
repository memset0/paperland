## Context

See docs/frontend-architecture.md sections 2 (Q&A Module) and 7 (防重复提交). Template prompts are .md files in templates/. QA uses content_priority from config to select paper text context.

## Goals / Non-Goals

**Goals:**
- Template Q&A: load templates, one-click generate all missing, regenerate individual
- Free Q&A: user selects models via checkboxes, submits question
- QA service: call OpenAI API (or CLI) with paper content + question
- Store all results with prompt, answer, model_name, completed_at
- Prevent duplicate template submissions

**Non-Goals:**
- Streaming responses (store full response after completion)
- Multi-paper Q&A (single paper context only for now)

## Decisions

### 1. QA service as pure service
QA service is a pure service (not paper-bound). It takes paper content + prompt as input and returns the answer. Called by the QA API endpoints.

### 2. OpenAI-compatible API call
For `type: openai_api` models, call the chat completions endpoint. For CLI types, spawn the CLI process. Start with OpenAI API only, CLI support as future enhancement.

### 3. Content resolution
When submitting a question, the backend resolves the paper's content using content_priority from config.yml. Returns error if no content available.

### 4. Template dedup via DB check
Before submitting a template question, check if a QA entry with that template_name already exists for the paper AND has at least one result. If so, skip (unless user explicitly requests regeneration).
