## ADDED Requirements

### Requirement: Recent papers on Home
The Home page SHALL show a "Recent papers" section listing up to 6 of the signed-in user's own library papers (the Mine scope, listed papers only), ordered by when the user added each paper to their library, newest first. Each paper SHALL be a card showing its title, authors (truncated) and the date the user added it, plus the user's tags on it; clicking a card SHALL open that paper's detail page (`/papers/:id`). The section header SHALL have an "All papers" link to `/papers`. When the user's library is empty, the section SHALL show "No papers in your library yet" with a link to `/papers`.

#### Scenario: User with papers opens Home
- **WHEN** a user who added papers A (yesterday), B (today) and C (last week) opens Home
- **THEN** the Recent papers section SHALL show cards in the order B, A, C, each with its added date

#### Scenario: Opening a recent paper
- **WHEN** the user clicks the card of paper 42
- **THEN** the app SHALL navigate to `/papers/42`

#### Scenario: Empty library
- **WHEN** a user whose library is empty opens Home
- **THEN** the Recent papers section SHALL show "No papers in your library yet" and a link to the Papers page

### Requirement: Home section order
The Home page SHALL show its sections top to bottom in this order: Recent papers, Features, Usage (the leaderboard podium, overflow table and own usage summary).

#### Scenario: Section order
- **WHEN** a signed-in user opens Home
- **THEN** Recent papers SHALL appear first, Features second, and the Usage leaderboard last
