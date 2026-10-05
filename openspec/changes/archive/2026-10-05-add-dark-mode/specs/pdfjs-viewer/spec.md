## ADDED Requirements

### Requirement: Theme-Aware PDF Rendering

The system SHALL render PDF pages with colors matching the active theme: in light mode a white page background with the document's native colors, and in dark mode a gray page background with light (near-white) foreground text, using pdf.js's native `pageColors` render option to set background and foreground independently.

#### Scenario: Rendering a page in light mode
- **WHEN** the active resolved theme is light and a page is rendered
- **THEN** the page SHALL render with a white background and the document's original colors
- **AND** the `.pdf-page` background SHALL be white

#### Scenario: Rendering a page in dark mode
- **WHEN** the active resolved theme is dark and a page is rendered
- **THEN** the page SHALL be rendered with `pageColors` set to a gray background and a light foreground
- **AND** the `.pdf-page` background SHALL be a dark/gray tone rather than hard-coded white

#### Scenario: Overlays remain theme-correct
- **WHEN** a page is rendered in dark mode
- **THEN** the text-selection highlight and the transient region-flash overlay SHALL continue to use the UI theme tokens and remain visible (they are not affected by `pageColors`, since they sit above the canvas raster)

### Requirement: Flicker-Free PDF Rendering

The system SHALL NOT show a flash of a wrongly-colored (e.g. white) canvas while a page is rendering. Because pdf.js fills the canvas with its background color at the start of a render and applies the `pageColors` recolor only at the end, the system SHALL render each page into an off-document canvas and insert (or swap in) that canvas only after rendering completes, so no intermediate frame is painted. Any previously-rendered canvas for the page SHALL remain visible until the new one is ready.

#### Scenario: Opening a PDF in dark mode
- **WHEN** a PDF page is rendered for the first time while the resolved theme is dark
- **THEN** the page SHALL appear already dark (gray background, light text)
- **AND** no white (or otherwise un-themed) frame SHALL be visible at any point during that render

#### Scenario: Re-rastering on zoom keeps the page visible
- **WHEN** a rendered page is re-rastered at a new scale
- **THEN** the existing rendered canvas SHALL stay visible until the new one finishes
- **AND** no blank or white frame SHALL appear during the re-raster

### Requirement: Re-Render PDF Pages On Theme Change

The system SHALL re-render the live (visible / near-viewport) PDF page(s) when the active resolved theme changes, since `pageColors` are baked into the rasterized canvas and cannot recolor in place; off-screen pages MAY re-render lazily when next scrolled into view.

#### Scenario: Switching theme with a PDF open
- **WHEN** a PDF is open and the resolved theme changes from light to dark (or dark to light)
- **THEN** the live page(s) SHALL re-render with the new theme's colors
- **AND** each page's previous canvas SHALL remain visible until its newly-colored canvas is ready, so the switch shows no blank or white flash
