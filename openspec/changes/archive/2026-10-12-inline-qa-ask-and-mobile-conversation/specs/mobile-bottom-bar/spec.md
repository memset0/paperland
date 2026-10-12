## MODIFIED Requirements

### Requirement: Paper detail sections on narrow screens
In the narrow, non-embed layout the paper detail page SHALL show one section at a time, switched from the bottom bar: **Info** (paper metadata card, citations, notes card, Kimi summary), **Read** (the multi-mode viewer — PDF, Markdown, translation and notes tabs — filling the area between the header and the bar), **Q&A** (the Q&A list with its navigation, shown with a list icon), and, for signed-in users, **Ask** (the conversation view: thread tabs and the docked question box, filling the area between the header and the bar). Info SHALL be the initial section. Each section SHALL keep its scroll position when switching away and back. Deep links SHALL switch sections: a PDF page/region anchor, a public-note link, or `?view=note` SHALL switch to Read; revealing a Q&A entry or answer block SHALL switch to Q&A. Opening an answer in the conversation view, "Follow up", `#moonlight` links and PDF "Add to question" SHALL switch to Ask (to Q&A for signed-out visitors). There SHALL be no floating "Ask" button or full-screen question overlay.

#### Scenario: Reading the PDF on a phone
- **WHEN** a phone user taps Read on a paper with a PDF
- **THEN** the PDF viewer SHALL be shown with its mode tabs

#### Scenario: Q&A link opens the Q&A section
- **WHEN** a phone user opens a `?qa=<entry>` link to a paper
- **THEN** the page SHALL switch to the Q&A section and reveal that entry

#### Scenario: Ask from the bar
- **WHEN** a signed-in phone user taps Ask in the bottom bar
- **THEN** the Ask section SHALL become active and show the conversation view; no full-screen overlay SHALL open

#### Scenario: Ask section is the conversation view
- **WHEN** the Ask section is active
- **THEN** it SHALL show the thread tabs, the active thread and the docked question box

#### Scenario: Continue an answer from the Q&A list
- **WHEN** a signed-in phone user taps "Open in conversation" or "Follow up" under an answer in the Q&A section
- **THEN** the page SHALL switch to Ask with that answer's thread as the active tab

#### Scenario: Signed-out visitor
- **WHEN** a signed-out visitor opens a paper on a phone
- **THEN** the bottom bar SHALL show Info, Read and Q&A only
