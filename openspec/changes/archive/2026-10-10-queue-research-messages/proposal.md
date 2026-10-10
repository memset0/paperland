## Why

While a Deep Research round runs (often many minutes), the owner cannot send the next instruction: submitting is rejected with 409, so they have to wait and remember what to ask. They should be able to type follow-ups at any time and have them sent automatically once the round ends.

## What Changes

- Submitting a message while a round is active queues it in the database instead of returning 409.
- When the active round ends (done, failed or cancelled), all queued messages of the session are merged in order into one message joined only by newlines and sent as one new round (model: that of the latest queued message). The round's time is when it is created from the queue; enqueue times are discarded with the queue rows.
- On startup, queues of sessions without an active round are dispatched (after interrupted rounds are marked failed).
- The owner can remove a queued message before it is sent (`DELETE /api/research/:id/queue/:messageId`). Session detail lists queued messages for the owner only.
- Research page: the input stays enabled during a round; Send becomes "Queue"; queued messages are shown above the input with a remove button and a hint that they will be sent together when the current round finishes.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `deep-research`: submitting during an active round queues the message; queued messages are merged and sent when the round ends.
- `database-schema`: new `research_queued_messages` table.

## Impact

- Backend: `db/schema.ts` + migration `0040`-ish (additive); `api/research.ts` (queue on submit, delete route, detail field); `services/research_runtime.ts` (dispatch after a round ends, startup dispatch); `index.ts` startup.
- Shared: `ResearchQueuedMessage`, `ResearchSessionDetail.queued_messages`.
- Frontend: `views/ResearchDetail.vue`, `stores/research.ts`, API client.
- Docs: `docs/tech-stack.md`, `docs/frontend-architecture.md`.
