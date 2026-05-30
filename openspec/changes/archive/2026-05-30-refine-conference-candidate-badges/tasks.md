## 1. Badge styling on the candidate card

- [x] 1.1 In `packages/frontend/src/views/ConferenceDetail.vue`, change the arXiv link in the links row (currently `<a … :class="chipClass">arXiv</a>`) to a red badge: `<Badge as="a" variant="destructive" :href="…" target="_blank" rel="noopener" @click.stop>arXiv</Badge>`, keeping the existing `displayArxivId(c)` guard and `https://arxiv.org/abs/{id}` href.
- [x] 1.2 Leave the S2 badge as the existing `<S2Badge v-if="displayCorpusId(c)" :corpus-id="displayCorpusId(c)" />` (already blue/consistent).
- [x] 1.3 Change the `c.link` chip (currently `<a … :class="chipClass">{{ OpenReview|原文 }}</a>`) to a gray badge: `<Badge as="a" variant="secondary" :href="c.link" target="_blank" rel="noopener" @click.stop>{{ /openreview\.net/.test(c.link) ? 'OpenReview' : '原文' }}</Badge>`, keeping the existing `v-if="c.link"` guard.
- [x] 1.4 Remove the now-unused `chipClass` constant if no other usage remains in the file (grep to confirm).

## 2. Remove the redundant per-row topic tag

- [x] 2.1 Remove the inline `<Badge v-else-if="c.topic" … >#{{ c.topic }}</Badge>` from the links row.
- [x] 2.2 Keep the inline topic editor `<template v-if="editingTopicId === c.id"> … </template>` (Input + confirm button) so `编辑主题` from the `⋯` overflow menu still opens it.
- [x] 2.3 Confirm the `⋯` overflow menu still contains `编辑主题` (calls `startEditTopic`) and `删除`, so topic editing is preserved.

## 3. Verify

- [x] 3.1 Run the frontend (`bun run dev` from project root) and open `/conferences/:id`; confirm arXiv badges render red, S2 blue, OpenReview/原文 gray, each only when its link/id exists.
- [x] 3.2 Confirm no `#topic` tag appears on candidate rows, and that selecting `编辑主题` from a row's `⋯` menu opens the inline topic editor and saving works.
- [x] 3.3 Confirm the links row still wraps cleanly (`flex-wrap`) with multiple badges.

## 4. Docs & spec sync

- [x] 4.1 Update `docs/frontend-architecture.md` to note the per-source badge styling (red arXiv / blue S2 / gray OpenReview) on the conference candidate card and the removal of the inline topic tag.
- [x] 4.2 If implementation deviates from this plan, fold the change back into `proposal.md` / `design.md` / the delta spec before archiving.
