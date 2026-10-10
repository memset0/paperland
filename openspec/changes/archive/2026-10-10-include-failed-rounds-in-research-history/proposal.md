## Why

A Deep Research round sees earlier steps in `<history>`, but only rounds that finished: a round that failed or was cancelled disappears, so if the owner moves on with a new message the agent never sees what was asked in between. Each user message also sits in a generic `<request>` tag, the same tag as the current round's request, which makes earlier messages harder to tell apart.

## What Changes

- `<history>` includes failed and cancelled agent rounds too (still excluding rounds that are queued or running). Each step carries a `status` attribute, and a failed/cancelled round gets a note saying the round run after this user message failed / was cancelled and produced no new version.
- Each earlier user message is wrapped in its own `<user_message>` element inside its `<step>`, so messages are clearly separated and not confused with the round's own `<request>`.
- Unchanged: earlier user messages are never truncated; only older `changes` notes are dropped to fit `research.history_char_budget`; the agent's earlier raw outputs are not replayed (the report and paper list are the deliverables, given in `<current_version>`).
- The research system prompt's description of `<history>` is updated accordingly.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `deep-research`: round input assembly — history includes failed/cancelled rounds with a status note; user messages in `<user_message>`.

## Impact

- Backend: `services/research_prompt.ts` (`HistoryStep.status`, rendering), `services/research_runtime.ts` (`buildStepInput` filter), tests.
- Prompt: `prompts/system/research.md` input format.
- Docs: `docs/tech-stack.md`.
