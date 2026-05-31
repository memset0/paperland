## ADDED Requirements

### Requirement: Content nodes from leading blockquotes
The mind-map SHALL derive read-only **content nodes** from the leading blockquotes of each node's content block. A node's content block is the document **preamble** for the center node, or the **leaf body** for a heading node. Scanning the content block from its start (ignoring leading blank lines, respecting fenced code blocks), each maximal run of consecutive `>`-prefixed lines that appears **before** the first non-blank, non-blockquote line SHALL become one content node, in document order. A content node SHALL render its blockquote's inner Markdown (the leading `> ` stripped) using the project's Markdown renderer, so plain text, images, and formulas all display. Content nodes SHALL be attached to their node and SHALL be ordered **before** that node's heading children.

#### Scenario: A leading blockquote becomes a content node
- **WHEN** a node's content block begins with a blockquote
- **THEN** the mind-map SHALL show a content node rendering that blockquote's content, attached to the node

#### Scenario: Multiple consecutive blockquotes become multiple content nodes
- **WHEN** a node's content block begins with several consecutive blockquote blocks (separated by blank lines)
- **THEN** the mind-map SHALL show one content node per blockquote block, in order

#### Scenario: Content nodes precede heading children
- **WHEN** a node has both leading-blockquote content nodes and heading children
- **THEN** the content nodes SHALL be displayed before the heading children

#### Scenario: Only leading blockquotes count
- **WHEN** a blockquote appears after non-blockquote content in a node's content block
- **THEN** it SHALL NOT become a content node (it remains ordinary rendered Markdown in the section body)

#### Scenario: Rich content renders
- **WHEN** a leading blockquote contains an image or a formula
- **THEN** the content node SHALL render the image or formula (not raw Markdown)

### Requirement: Content nodes are read-only and visually distinct
Content nodes SHALL NOT be interactive: they SHALL NOT open an editor on click, SHALL NOT be draggable, and SHALL NOT offer add / rename / delete actions. Content nodes SHALL be visually distinguished from heading nodes: a heading/center node SHALL keep a full border, while a content node SHALL render with only a **bottom-half border** (the lower portion of the left and right edges with rounded bottom corners plus the bottom edge), its content sitting above that border. The connector line drawn from a parent to a content node SHALL be **as thin as the node border** — thinner than the connector drawn to a heading node.

#### Scenario: Content node is not clickable or editable
- **WHEN** a user clicks or tries to drag a content node
- **THEN** no editor SHALL open and the node SHALL NOT move, and no action menu SHALL appear

#### Scenario: Content node has the bottom-half border style
- **WHEN** a content node is displayed
- **THEN** it SHALL render with the bottom-half-border style, distinct from the full border of heading/center nodes

#### Scenario: Connector to a content node is thinner
- **WHEN** a connector is drawn to a content node
- **THEN** its stroke SHALL be as thin as the node border, thinner than a connector drawn to a heading node
