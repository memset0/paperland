## Context

See proposal.md for motivation. agent-browser inspection of production at 1440px and 390px confirmed that long model names and inline buttons squeeze phone question previews to a few characters; the header refresh is clipped. QAFeedPanel currently nests buttons within a role=button collapsible header. AppPage owns the shared title, width, and internal scrolling; QAResultView owns answer behavior and must remain reused.

## Goals / Non-Goals

Goals: a quiet reading surface, readable question previews, clear metadata hierarchy, independent keyboard-accessible controls, and responsive layouts in both themes.

Non-goals: changing question creation, fetching, result rendering, permissions, data, global navigation, or the shared layout's title policy.

## Decisions

- Keep AppPage fill mode and its default content width. Keep Questions Mine / All and refresh in its actions; put the existing Highlights selector in a separate slim toolbar with the feed total. This removes phone header overflow without changing the global component.
- Use generously spaced cards with restrained rings, rounded corners, and existing semantic color tokens. Keep the paper link/time above each card, with wrapping asker metadata in All scope. Unlike adding imagery or strong color blocks, this keeps attention on research questions.
- Use a real button through CollapsibleTrigger for status, a three-line question preview, and a small chevron. Put badges and all ancillary controls in a separate wrapping sibling row. This avoids nested buttons and manual keyboard handlers; an open question is unclamped.
- Preserve the whole-card background preference and use no opaque header/body backgrounds that hide it. Leave QAResultView, store fetching, stream subscriptions, polling, and action authorization intact.
- Match skeleton shapes to the new cards; provide a paper-library link in the empty state and explicit pagination labels. All added labels are English.
- Use agent-browser for before/after screenshots and direct interaction at desktop, 375/390px phone widths, and dark mode. UI inspection reads existing authorized data; synthetic loading/empty and pathological-content checks use local browser interception or in-memory store fixtures, never real model generation.

## Risks / Trade-offs

- Taller cards show fewer questions per screen → cap collapsed previews at three lines and keep metadata compact.
- Long paper/model/user text can overflow → use min-width zero, wrapping controls, and word wrapping; measure browser geometry at narrow widths.
- Broad component changes could affect paper detail → confine edits to the feed page/panel and reuse existing shared components.

## Migration Plan

Update documentation, inspect the diff, validate OpenSpec, then build/deploy only with bun run build:frontend from the project root. Verify health and served asset hashes plus the production page using agent-browser. Keep this change active for user review; archiving and version bump await authorization.

## Verification evidence

- Installed agent-browser 0.41.2 and Chrome 157 on the current device; used a dedicated browser session and reused a valid local login without printing credentials or changing the database.
- Inspected real production before changes at 1440x1000 and 390x844; verified the revised local preview at 1440px, 390px, 375px, and 320px in light/dark themes. Document width matched the viewport, refresh remained visible, and no nested buttons remained.
- A long local question fixture measured exactly three 24px lines collapsed (72px), expanded to its full 720px text, and toggled once each with Enter and Space. A 348-character model name wrapped without clipping or horizontal overflow.
- Verified real current-page pagination (page 1 to 2 and back, scroll reset), All-scope fetching and asker display. Verified skeletons and empty-state library link with in-memory fixtures.
- Verified independent link copying and palette selection, with preference writes intercepted locally. A local two-result fixture verified result-tab switching, Private/reading metadata, whole-card blue background, read-only hidden management actions, and owner-visible management actions. No live model generation was triggered; S2 resolution was intercepted for these browser checks.
- Reviewed the focused implementation/documentation diff and passed git diff --check and openspec validate polish-qa-feed-layout --strict. The three architecture documents also contain pre-existing concurrent deployment/backup work, which was preserved.
- Production deployment succeeded with the queued root command `bun run build:frontend` (exit 0). Public `/api/health` returned `{"status":"ok"}`; `/qa` returned 200 with no-cache HTML identical to the deployed index. The public entry JS, CSS, and `QAPage-BuPGqMSH.js` matched the on-disk build by SHA-256. Static hosting reads the new build directly; no backend restart was needed.
- agent-browser confirmed the deployed public page at 1440x1000 and 375x812, including a separate dark-mode reload. All 20 feed cards were collapsed by default; phone document width was exactly 375px, refresh was visible, and browser errors were empty. Screenshots: `/tmp/qa-after-desktop.png`, `/tmp/qa-after-mobile.png`, `/tmp/qa-after-mobile-dark-production.png`. Build emitted existing dependency annotation and large-chunk warnings but completed successfully.
- Implementation/deployment completed on November 8; the change stayed active until the user explicitly authorized closeout, archive, and push on November 11.

## Closeout verification (2026-11-11)

- Rechecked production with agent-browser at 375x812: 20 collapsed cards, document width 375px, visible refresh, zero nested buttons, and no browser errors. Public health returned `{"status":"ok"}`.
- Synced one modified and two added requirements into qa-feed-page, preserving the other 13 requirements and every existing scenario. The active change passed strict validation; the updated main spec and all main specs passed normal validation with existing style warnings.
- The Q&A additions to the three required architecture documents were already committed in the shared documentation included in `0ea6007`. Current Topic-only documentation and implementation edits are excluded from this archive's staging list.
- Archive authorization includes the required patch bump and commit/push to main. The archive preserves all five completed tasks and the original proposal/design/delta artifacts.
- Archived at `openspec/changes/archive/2026-11-11-polish-qa-feed-layout`; the current root version was incremented from 2.3.10 to 2.3.11. The archived record validates with no issues. A repository-wide archive audit also reports 14 older archives with unfinished historical tasks; those unrelated records were preserved.
