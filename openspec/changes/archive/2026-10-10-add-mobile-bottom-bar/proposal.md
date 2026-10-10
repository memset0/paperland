## Why

On phones the complex pages are hard to use: the paper detail page collapses to one long column with no way to read the PDF/Markdown at all, and the Deep Research page stacks the version view and the whole timeline into one scroll, with the next-round input at the very end. A bottom app bar (as in native mobile apps) that switches between the page's functional areas makes each area reachable with one tap.

## What Changes

- New shared `MobileBottomBar` component: a fixed bar at the bottom of the screen with icon + label items, safe-area aware, that slides/fades in with an animation when shown. It appears only on complex pages that opt in, and only in their single-column (narrow, < 900px) layout; never in embed mode. Pages reserve bottom space so content is not hidden behind it.
- **Paper detail** (narrow, non-embed): the single column is split into sections switched by the bar — **Info** (metadata, citations, notes card, Kimi summary), **Read** (the multi-mode viewer: PDF / Markdown / translation / notes, now available on phones), **Q&A** (the Q&A list) — plus an **Ask** action that opens the question box. Each section keeps its own scroll position. Deep links switch to the right section (PDF anchors / note links → Read; Q&A reveals → Q&A). The mobile floating action button and the header function buttons are replaced by the bar there.
- **Deep Research detail**:
  - Narrow: bar sections **Instruct** (round timeline, oldest → newest, with the message input fixed at the bottom of the screen above the bar and the view scrolled to the newest round), **Report**, **Papers** (the version selector stays above Report / Papers). The Instruct item shows activity while a round runs and the number of queued messages.
  - Wide: the left column is reversed — the message input (with queued messages) at the top, then rounds newest first.
  - Each finished round shows how long it took (start → finish), in both layouts.
- Q&A list headers (Preset / User Q&A) wrap their controls instead of overflowing on narrow screens (found while checking the Q&A section on a phone).

## Capabilities

### New Capabilities
- `mobile-bottom-bar`: the shared bottom bar and its use on the paper detail and Deep Research pages.

### Modified Capabilities
- `paper-action-launcher`: in the narrow layout the functions live in the bottom bar instead of the FAB / header buttons.
- `deep-research`: research page layout (wide: input on top, newest rounds first; narrow: bottom-bar sections).

## Impact

- Frontend: new `components/MobileBottomBar.vue`, `composables/useNarrowLayout.ts`; `views/PaperDetail.vue`, `views/ResearchDetail.vue`, `components/PaperActionLauncher.vue` (no FAB where the bar is used).
- No backend or API change.
- Docs: `docs/frontend-architecture.md`.
- After archive: production frontend build (`bun run build:frontend`).
