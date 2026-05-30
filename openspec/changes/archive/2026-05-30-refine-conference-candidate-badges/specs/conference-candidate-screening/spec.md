## MODIFIED Requirements

### Requirement: Unified external links row

Each candidate card SHALL present external links as a single row of badges — arXiv, Semantic Scholar, and OpenReview (or a generic `原文` for any other source `link`) — showing only those that exist, replacing the previously separate source badge, arXiv badge, S2 badge, and "来源" link. Each badge SHALL be styled by source, consistent with the paper detail page: the **arXiv** badge red (the `destructive` badge variant), the **Semantic Scholar (S2)** badge blue (the existing `S2Badge`), and the **OpenReview / 原文** badge gray (the `secondary` badge variant).

#### Scenario: Resolved candidate shows all available links
- **WHEN** a candidate has a resolved arXiv id, a corpus id, and an OpenReview link
- **THEN** the card shows an arXiv badge (→ `arxiv.org/abs/{id}`), an S2 badge (→ Semantic Scholar `CorpusID:{id}`), and an OpenReview badge (→ its link)

#### Scenario: arXiv badge is red and matches the detail page
- **WHEN** a candidate has a resolved arXiv id
- **THEN** the arXiv badge renders in red (the `destructive` variant), the same color the paper detail page uses for arXiv, not a muted gray chip

#### Scenario: OpenReview badge is gray
- **WHEN** a candidate has a `link` (an OpenReview link, shown as `OpenReview`, or any other source link, shown as `原文`)
- **THEN** that badge renders in gray (the `secondary` variant)

#### Scenario: arXiv badge never renders as a dash
- **WHEN** a candidate has an arXiv id but no arxiv URL stored in `papers.link`
- **THEN** the arXiv badge renders a working link derived from the id and never renders as "-"

#### Scenario: Only available sources render
- **WHEN** a candidate has no corpus id and no `link`
- **THEN** only the arXiv badge renders (if it has an arXiv id), and no S2 or OpenReview badge is shown

## ADDED Requirements

### Requirement: Candidate card omits a redundant per-row topic tag

Because candidate cards are already grouped under their topic/session header, each card SHALL NOT render an inline per-row topic (which-session) tag. Editing a candidate's topic SHALL remain available through the row's `⋯` overflow menu (`编辑主题`), which opens the inline topic editor.

#### Scenario: No inline topic tag on the card
- **WHEN** a candidate has a topic and is displayed under its topic group
- **THEN** the card's links row does not show a `#topic` tag duplicating the group header

#### Scenario: Topic remains editable via the overflow menu
- **WHEN** the user opens a candidate's `⋯` menu and selects `编辑主题`
- **THEN** the inline topic editor (an input with a confirm control) appears in the card so the topic can be changed
