## MODIFIED Requirements

### Requirement: Branching mind-map view of small notes
The small notes of a (user, paper) SHALL be presented as a branching mind-map — an automatically laid-out hierarchical node view where parent/child relationships are shown as connected nodes (not a left-indented outline, and not a free-placement infinite canvas). Each node SHALL display the note's title. A node whose `body` is non-empty SHALL additionally display a small grey, parenthesised character count of its body (e.g. `(123)`) next to the title; a node with an empty body SHALL NOT display a count.

#### Scenario: Tree renders as a branching map
- **WHEN** an authenticated user views a paper's small notes
- **THEN** the notes SHALL render as a branching mind-map with parent/child nodes connected, each node showing its title

#### Scenario: Node shows title only
- **WHEN** a node is displayed in the mind-map
- **THEN** it SHALL show the note's title and SHALL NOT inline the full body

#### Scenario: Non-empty node shows a character count
- **WHEN** a node's body is non-empty
- **THEN** the node SHALL display, next to its title, a grey parenthesised count of the number of characters in its body

#### Scenario: Empty node shows no character count
- **WHEN** a node's body is empty
- **THEN** the node SHALL NOT display any character-count badge
