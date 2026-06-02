## ADDED Requirements

### Requirement: Node width and heading text wrapping

Mind-map nodes SHALL have a bounded maximum width that is comfortably wide for typical headings. When a heading or center node's text exceeds that maximum width, the text SHALL wrap onto multiple lines and be shown in **full**; it SHALL NOT be truncated with an ellipsis (`…`). Very long unbroken tokens (e.g. a URL with no spaces) SHALL also wrap within the node's maximum width rather than overflow it. The grey parenthesised character-count badge SHALL remain beside the heading text when the heading wraps. Connectors drawn to a node SHALL remain correctly anchored when the node grows taller because its text wrapped.

#### Scenario: Long heading wraps and shows full text

- **WHEN** a heading node's text is longer than the node's maximum width
- **THEN** the text SHALL wrap onto multiple lines and the full heading SHALL be visible, with no ellipsis truncation

#### Scenario: Short heading stays on a single line

- **WHEN** a heading node's text fits within the node's maximum width
- **THEN** it SHALL render on a single line as before

#### Scenario: Character count stays beside a wrapped heading

- **WHEN** a heading node whose leaf body is non-empty has text that wraps onto multiple lines
- **THEN** the grey parenthesised character-count badge SHALL still be displayed beside the heading text

#### Scenario: Connector stays anchored to a taller node

- **WHEN** a node becomes taller because its heading wrapped onto multiple lines
- **THEN** the connector from its parent SHALL remain correctly anchored to the node
