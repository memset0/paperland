# mobile-bottom-bar Specification

## Purpose
A bottom app bar that complex pages (paper detail, Deep Research detail) show in their single-column layout to switch between their functional sections, and those pages' narrow-screen sections.

## Requirements

### Requirement: Shared mobile bottom bar
The frontend SHALL provide a shared bottom app bar component that complex pages opt into. It SHALL be fixed to the bottom of the viewport, respect the device's bottom safe-area inset, and show each item as an icon with a short label; section items SHALL show which one is active, action items SHALL trigger an action without changing the active section, and items MAY carry a badge or activity indicator. The bar SHALL appear only on pages that opt in, only while that page uses its single-column layout (viewport narrower than 900px), and never in embed mode. When it appears it SHALL animate in (slide up and fade in); it SHALL disappear when the page switches to its wide layout or is left. Pages using it SHALL reserve bottom space so no content is hidden behind it.

#### Scenario: Bar only on opted-in narrow pages
- **WHEN** a user opens the paper list on a phone
- **THEN** no bottom bar SHALL be shown; **WHEN** the user then opens a paper detail page
- **THEN** the bottom bar SHALL slide in

#### Scenario: Wide layout has no bar
- **WHEN** the viewport is 900px or wider, or the page is in embed mode
- **THEN** the bottom bar SHALL NOT be shown

### Requirement: Paper detail sections on narrow screens
In the narrow, non-embed layout the paper detail page SHALL show one section at a time, switched from the bottom bar: **Info** (paper metadata card, citations, notes card, Kimi summary), **Read** (the multi-mode viewer — PDF, Markdown, translation and notes tabs — filling the area between the header and the bar), and **Q&A** (the Q&A list with its navigation). The bar SHALL also offer an **Ask** action that opens the question box (full screen on phones). Info SHALL be the initial section. Each section SHALL keep its scroll position when switching away and back. Deep links SHALL switch sections: a PDF page/region anchor, a public-note link, or `?view=note` SHALL switch to Read; revealing a Q&A entry or answer block SHALL switch to Q&A.

#### Scenario: Reading the PDF on a phone
- **WHEN** a phone user taps Read on a paper with a PDF
- **THEN** the PDF viewer SHALL be shown with its mode tabs

#### Scenario: Q&A link opens the Q&A section
- **WHEN** a phone user opens a `?qa=<entry>` link to a paper
- **THEN** the page SHALL switch to the Q&A section and reveal that entry

#### Scenario: Ask from the bar
- **WHEN** a phone user taps Ask in the bottom bar
- **THEN** the question box SHALL open full screen and the active section SHALL not change

### Requirement: Deep Research sections on narrow screens
In the narrow layout the Deep Research detail page SHALL show one section at a time, switched from the bottom bar: **Instruct**, **Report**, and **Papers**. Instruct SHALL show the round timeline oldest to newest and, for the owner, the message input (with queued messages) fixed at the bottom of the screen just above the bar; switching to Instruct SHALL scroll to the bottom (the newest round), and switching to Report or Papers SHALL scroll to the top. Report and Papers SHALL show the version selector and then the selected version's report or paper list. The Instruct item SHALL indicate when a round is running and show the number of queued messages. Report SHALL be the initial section.

#### Scenario: Sending from a phone
- **WHEN** the owner opens Instruct on a phone
- **THEN** the input SHALL stay visible at the bottom while the timeline scrolls above it, with the newest round nearest to the input

#### Scenario: Switching sections resets the scroll position
- **WHEN** a phone user scrolled halfway down the report and taps Papers, then Instruct
- **THEN** Papers SHALL open at the top and Instruct SHALL open at the bottom

### Requirement: Q&A list headers fit narrow screens
The Preset Q&A and User Q&A card headers SHALL wrap their controls onto further lines instead of overflowing the card when the screen is too narrow for one line.

#### Scenario: Header controls on a phone
- **WHEN** the Q&A section is shown on a 390px-wide screen
- **THEN** every header control (including "Generate all") SHALL be fully visible inside the card
