## Why

A Deep Research instruction can be long and complex; the owner wants to write it in several parts and send them together. Today a message submitted while no round runs starts a round immediately, so parts can only be queued while a round happens to be running.

## What Changes

- `POST /api/research/:id/steps` accepts `queue_only: true`: the message is added to the queue without starting a round, even when idle.
- Sending while idle merges all queued messages plus the new text (newline-joined, in order) into one round; `user_text` may be empty when the queue is not empty ("send the queue").
- Startup dispatch only sends the queues of sessions whose round was interrupted by the restart; idle-held queues stay queued. Queues still auto-send when an active round ends (unchanged).
- Research page composer: when idle, "Add to queue" next to "Send" (Send is enabled with an empty input when the queue has messages); while a round runs, "Queue" as before. The queue hint text distinguishes the two cases.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `deep-research`: queued messages can be held while idle and sent explicitly; restart dispatch limited to interrupted sessions.

## Impact

- Backend: `api/research.ts` (submit options), `services/research_runtime.ts` (`recoverInterruptedResearchSteps` returns session ids; startup dispatch per interrupted session), `index.ts`, tests.
- Frontend: `views/ResearchDetail.vue`, `stores/research.ts`, API client.
- Docs: `docs/tech-stack.md`, `docs/frontend-architecture.md`.
