## Context

The conference detail page (`ConferenceDetail.vue`) renders each candidate as a screening card. The card's "links + topic" row currently renders:

- arXiv as a plain anchor with the shared `chipClass` (a muted gray pill): `<a … :class="chipClass">arXiv</a>`
- S2 via the dedicated `<S2Badge>` component (blue)
- the `link` (OpenReview or other source) as another gray `chipClass` anchor labelled `OpenReview` or `原文`
- a `#topic` `<Badge variant="outline">` that doubles as the inline edit-topic trigger

The paper detail page (`PaperDetail.vue`) renders the same sources differently: arXiv through `SourceTag` as a **red** `Badge` (`variant="destructive"`), S2 through `S2Badge` (blue), and OpenReview as a gray bordered pill. So the same arXiv source reads red on one page and gray on another, and the per-row `#topic` tag duplicates the group header the row already sits under.

This is a purely presentational frontend change to one component. No backend, API, DB, or data-shape changes.

## Goals / Non-Goals

**Goals:**
- Make the candidate card's source badges color-consistent with the paper detail page: arXiv red, S2 blue, OpenReview/原文 gray.
- Render each badge only when the corresponding id/link exists (unchanged behavior).
- Remove the redundant inline `#topic` tag while keeping topic editing reachable from the overflow menu.

**Non-Goals:**
- No change to the existing `S2Badge` component or its blue styling.
- No change to which links are shown, their hrefs, or the `displayArxivId` / `displayCorpusId` / `c.link` resolution logic.
- No change to the candidate-screening API, the grouping-by-topic logic, or the group header.
- Not reusing `SourceTag` verbatim (see Decisions).

## Decisions

### Decision: Use the shared `Badge` component with `variant` for each source, not the raw `chipClass` anchor
The detail page expresses source color through the `Badge` component's `variant` (`destructive` = red, `secondary` = gray) and `S2Badge`'s explicit blue classes. To be consistent, the conference card should do the same: render arXiv as `<Badge as="a" variant="destructive" …>arXiv</Badge>` and the `link` as `<Badge as="a" variant="secondary" …>OpenReview|原文</Badge>`. `S2Badge` is already used and stays.

- **Why over keeping `chipClass`:** `chipClass` is a one-off gray style that can't express the red arXiv requirement and drifts from the rest of the app's badge styling.

### Decision: Match the detail page's *color*, keep the compact `arXiv` label (not `arxiv:{id}`)
`SourceTag` labels the arXiv badge `arxiv:{id}`. On the dense candidate list, the short `arXiv` label is preferable and is what the row already uses. The user's requirement is the red **style** consistency; the label stays compact. The href is unchanged (`https://arxiv.org/abs/{id}`).

- **Alternative considered — reuse `SourceTag` directly:** rejected. `SourceTag` takes `link` + `arxivId` and would render the OpenReview `link` as a host-derived label (`openreview.net`) rather than the friendly `OpenReview`, and would emit the long `arxiv:{id}` label. Rendering the three badges explicitly keeps the existing friendly labels and the OpenReview-vs-原文 distinction while only changing color.

### Decision: Remove the inline `#topic` badge; topic editing moves entirely to the overflow menu trigger
The `<Badge v-else-if="c.topic">#{{ c.topic }}</Badge>` is removed. The inline edit `<template v-if="editingTopicId === c.id">` (the `Input` + confirm button) is kept, so when the user picks `编辑主题` from the `⋯` menu (which already calls `startEditTopic`), the inline editor still appears in the links row. The `spec`'s existing "Secondary actions in overflow" requirement already guarantees `编辑主题` lives in the overflow menu, so no editing capability is lost.

- **Why:** the card already sits under a group header showing its topic/session; repeating it per row is noise.

## Risks / Trade-offs

- [Removing the inline `#topic` badge could feel like topic editing disappeared] → It does not: `编辑主题` remains in the `⋯` menu and triggers the same inline editor. Verify by opening the menu and confirming the inline `Input` appears.
- [`Badge as="a"` styling differs subtly from the old `chipClass` (padding/size)] → Acceptable and intended: aligning to the app-wide `Badge` look is the goal. Visually verify the row still wraps cleanly with `flex-wrap`.
- [Other non-arXiv, non-OpenReview `link` values still labelled `原文`] → Unchanged from today; gray `secondary` is the right neutral color for them.
