# mcp-pdf-pages Specification

## Purpose

Let agents inspect selected physical PDF pages, including figures and equations when needed, and cite those pages with reliable native Paperland positioning links.

## Requirements

### Requirement: Physical PDF page reading
MCP SHALL expose on-demand reading of an existing paper's local PDF page using a positive 1-based physical page number. Results SHALL include paper_id, page, page_count, page text and a complete native Markdown page reference. Missing PDFs and out-of-range pages SHALL produce actionable tool errors without fetching or parsing an entire remote document.

#### Scenario: Read the fifth physical page
- **WHEN** an agent requests page 5 of paper 123
- **THEN** the result SHALL identify physical PDF page 5 and include a Markdown link targeting paperland://paper/123?pdf=5

### Requirement: Explicit page screenshots
Only an explicit screenshot request SHALL rasterize the requested PDF page. MCP SHALL return a real image content block alongside page metadata and its Markdown citation. Rendering SHALL be local, bounded by configured size/time/concurrency limits, and SHALL NOT expose filesystem paths or render all pages by default.

#### Scenario: Inspect a figure
- **WHEN** an agent explicitly requests an image of page 5
- **THEN** it SHALL receive that page's image and reference, with no automatic images of other pages

#### Scenario: Text-only request
- **WHEN** an agent requests page text without an image
- **THEN** no page screenshot SHALL be generated

### Requirement: Native region references
An optional valid normalized rectangle SHALL produce a complete Markdown link with pdf, rx, ry, rw and rh parameters. Topic report rendering SHALL reuse existing native link handling to navigate to the paper's PDF page/region. Invalid page numbers or rectangle coordinates SHALL be rejected by the tool.

#### Scenario: Cite a rectangular area
- **WHEN** an agent requests page 5 with x=0.1, y=0.2, width=0.3 and height=0.15
- **THEN** the returned Markdown SHALL target paperland://paper/123?pdf=5&rx=0.1&ry=0.2&rw=0.3&rh=0.15 for paper 123
- **AND** clicking it from a Topic report SHALL reveal that PDF region
