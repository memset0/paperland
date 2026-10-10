## Why

On the narrow Deep Research page all three bottom-bar sections share one page scroll, so switching from a scrolled report to Papers lands somewhere in the middle of the list.

## What Changes

- Switching sections on the narrow Deep Research page resets the scroll: Instruct scrolls to the bottom (newest round, as before), Report and Papers scroll to the top.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `mobile-bottom-bar`: Deep Research section switching resets the scroll position.

## Impact

- Frontend: `views/ResearchDetail.vue`. Docs: `docs/frontend-architecture.md`.
