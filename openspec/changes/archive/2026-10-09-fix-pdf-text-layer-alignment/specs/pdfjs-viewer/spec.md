## ADDED Requirements

### Requirement: Text layer aligned with the rendered page
The selectable text layer SHALL stay visually aligned with the rendered page canvas. Each text run's selectable box SHALL match the position, height, and width of the glyphs drawn on the canvas, so the native selection highlight covers exactly the text the user dragged across. This alignment SHALL hold at every zoom level, including while a zoom or split-pane resize is CSS-scaling the existing canvas before the page is re-rasterized.

#### Scenario: Selection matches the glyphs
- **WHEN** the user drags to select part of a line on a rendered page
- **THEN** the selection highlight SHALL cover the dragged glyphs from the line start through the line end, without horizontal drift toward the end of the line and without jumping to an adjacent line

#### Scenario: Alignment after zoom
- **WHEN** the user changes the zoom and the page re-renders at the new scale
- **THEN** the text layer SHALL remain aligned with the newly rendered canvas

#### Scenario: Alignment while a zoom is pending re-raster
- **WHEN** the effective scale changes (zoom or split-pane drag) and the canvas is temporarily CSS-scaled before re-rasterizing
- **THEN** the text layer SHALL scale with the canvas immediately, so a selection made during that window still lines up with the glyphs
