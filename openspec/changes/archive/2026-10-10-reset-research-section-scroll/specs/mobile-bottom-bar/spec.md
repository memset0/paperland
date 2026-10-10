## MODIFIED Requirements

### Requirement: Deep Research sections on narrow screens
In the narrow layout the Deep Research detail page SHALL show one section at a time, switched from the bottom bar: **Instruct**, **Report**, and **Papers**. Instruct SHALL show the round timeline oldest to newest and, for the owner, the message input (with queued messages) fixed at the bottom of the screen just above the bar; switching to Instruct SHALL scroll to the bottom (the newest round), and switching to Report or Papers SHALL scroll to the top. Report and Papers SHALL show the version selector and then the selected version's report or paper list. The Instruct item SHALL indicate when a round is running and show the number of queued messages. Report SHALL be the initial section.

#### Scenario: Sending from a phone
- **WHEN** the owner opens Instruct on a phone
- **THEN** the input SHALL stay visible at the bottom while the timeline scrolls above it, with the newest round nearest to the input

#### Scenario: Switching sections resets the scroll position
- **WHEN** a phone user scrolled halfway down the report and taps Papers, then Instruct
- **THEN** Papers SHALL open at the top and Instruct SHALL open at the bottom
