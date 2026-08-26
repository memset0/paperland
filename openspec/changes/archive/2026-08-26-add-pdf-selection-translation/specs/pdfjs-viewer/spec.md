## ADDED Requirements

### Requirement: Stable PDF text selection triggers translation
For an authenticated user, the PDF viewer SHALL observe native browser selections inside one rendered pdf.js page text layer. A non-empty selection SHALL become eligible for translation only when its selected text, page number, and `[ts, te)` text offsets remain unchanged for at least 500 milliseconds. Before that delay expires, the viewer SHALL preserve normal selection behavior and SHALL NOT call the translation API. Each stable selection identity SHALL start at most one active translation request unless the user later selects a different identity or explicitly retries.

#### Scenario: Selection remains stable for 500ms
- **WHEN** an authenticated user selects `hello, world` within one PDF text layer and its text/page/offset identity remains unchanged for 500ms
- **THEN** the viewer SHALL start one cache-first streaming translation request for `hello, world`

#### Scenario: Selection changes before timeout
- **WHEN** the user changes the selection before 500ms elapses
- **THEN** the old timer SHALL be cancelled and no translation SHALL start for the superseded selection
- **AND** a new 500ms interval SHALL begin only for the new valid selection

#### Scenario: Collapsed selection does not translate
- **WHEN** the native selection is empty or collapsed
- **THEN** the viewer SHALL cancel any pending stable-selection timer and SHALL NOT call the translation API

#### Scenario: Selection outside one PDF page is ineligible
- **WHEN** a selection is outside the viewer, outside a pdf.js text layer, or crosses PDF pages
- **THEN** the viewer SHALL preserve native selection but SHALL NOT start selection translation

#### Scenario: Existing stable identity does not duplicate request
- **WHEN** repeated `selectionchange` events report the same page/text/offset identity after its request has begun
- **THEN** the viewer SHALL NOT create duplicate translation requests

### Requirement: Selection-anchored streaming translation panel
When an eligible stable selection begins translating, the viewer SHALL show a lightweight panel anchored to that selection. It SHALL prefer a position centered above the selection; when the available space is insufficient it SHALL appear below, and its final position/width SHALL remain clamped within the visible PDF viewer. The panel SHALL show a Translation heading plus waiting, streaming, completed, or failed state and SHALL render the selected text's result using the existing streaming translation component. Genuine provider deltas SHALL become visible according to that component's rendering contract; a cache hit SHALL complete immediately.

#### Scenario: Panel appears above selection
- **WHEN** sufficient viewer space exists above the selected range
- **THEN** the translation panel SHALL be centered above the range with a visual gap and SHALL NOT cover the selected text

#### Scenario: Panel falls below near top edge
- **WHEN** the selection is too close to the top of the visible viewer for the panel
- **THEN** the panel SHALL appear below the selection without overlapping the existing selection-link action

#### Scenario: Panel is clamped on narrow viewer
- **WHEN** the selection center is close to a left/right edge or the viewer is narrow
- **THEN** the panel width and horizontal position SHALL be clamped inside the viewer with a safe inset

#### Scenario: Streaming result grows in panel
- **WHEN** the provider emits ordered translation deltas
- **THEN** the panel SHALL show the growing translated text before completion and SHALL finish with the authoritative final text

#### Scenario: Cached selection translation is immediate
- **WHEN** the exact selected text already exists in the shared translation cache
- **THEN** the panel SHALL show the cached completed translation without a model call or fabricated streaming

#### Scenario: Translation failure remains actionable
- **WHEN** selection translation fails after zero or more partial deltas
- **THEN** the panel SHALL show a concise failure state and a retry action for the unchanged selection

### Requirement: Selection translation lifecycle follows the native selection
The pending timer, active request, and panel SHALL belong to one immutable selection identity. An ordinary outside click, unowned native-selection collapse, leaving the valid text layer, switching PDF/paper, entering region-capture mode, or unmounting the viewer SHALL cancel pending work, abort active work, and remove the old panel. A transient collapse caused by pointer interaction inside the panel SHALL preserve the active panel/source snapshot. A different valid selection SHALL leave the old panel visible during its 500ms candidate interval and replace it only when the new identity activates. Late events from cancelled or superseded requests SHALL NOT alter the current panel. Scrolling the PDF while the selection remains valid SHALL reposition the selection UI at the next animation frame; zoom or text-layer rerender that invalidates the DOM Range SHALL close it.

#### Scenario: New selection replaces active translation
- **WHEN** a translation is active and the user selects different text
- **THEN** the old panel SHALL remain visible while the new selection completes its own 500ms stability delay
- **AND** when the new identity activates, the old request SHALL be aborted and the panel SHALL be replaced by the new translation

#### Scenario: Plain outside click dismisses panel
- **WHEN** the translation panel is visible and a pointer interaction outside it completes without creating a different valid PDF selection
- **THEN** the viewer SHALL close the panel and abort any active request

#### Scenario: Escape closes panel
- **WHEN** the translation panel is visible and the user presses Escape
- **THEN** the panel and active request SHALL close while the existing completed database cache, if any, remains unchanged

#### Scenario: Viewer scroll repositions panel
- **WHEN** the selected text remains selected while the PDF viewport scrolls
- **THEN** panel positioning SHALL be recomputed on an animation frame so it stays attached to the selection or closes if the range is no longer valid/visible

#### Scenario: Zoom rerender invalidates selection
- **WHEN** zooming or page rerender replaces the selected text-layer nodes
- **THEN** the old timer/request/panel SHALL be cancelled instead of remaining at stale coordinates

#### Scenario: Late event is ignored
- **WHEN** an aborted selection request emits a late delta or terminal event
- **THEN** it SHALL NOT update the panel for the current selection

### Requirement: Selection translation coexists with PDF selection tools and authentication
Selection translation SHALL reuse the native text selection and SHALL NOT remove or replace the existing copy-selection-link action. Pointer interaction inside the translation panel SHALL NOT inadvertently clear the source selection. Entering region screenshot capture mode SHALL suppress selection translation. Only authenticated users SHALL trigger the translation API; anonymous users SHALL retain native selection and existing public PDF behavior without an automatic login prompt or translation panel.

#### Scenario: Copy selection link remains available
- **WHEN** an authenticated user has a valid single-page selection
- **THEN** the existing copy-selection-link action SHALL remain usable alongside the translation panel and SHALL address the same page/offset selection

#### Scenario: Panel interaction preserves source selection
- **WHEN** the user presses a panel control or scrolls the panel and browser focus transfer temporarily collapses the source PDF selection
- **THEN** the viewer SHALL preserve the translation panel and source snapshot instead of treating that `selectionchange` as outside dismissal
- **AND** the viewer SHALL restore the cloned source Range on pointer-up when the DOM Range remains valid

#### Scenario: Capture mode suppresses translation
- **WHEN** region screenshot capture mode is active
- **THEN** selection translation timers/panels SHALL be cancelled and drag capture SHALL retain its existing behavior

#### Scenario: Anonymous selection does not call API
- **WHEN** an anonymous visitor selects PDF text and leaves it unchanged for 500ms
- **THEN** no translation request or automatic login prompt SHALL occur
- **AND** the native selection and other anonymously available viewer behavior SHALL remain intact
