## MODIFIED Requirements

### Requirement: Selection-anchored streaming translation panel
When the user explicitly starts translating an eligible selection, the viewer SHALL show a lightweight panel anchored to that selection. It SHALL prefer a position centered above the selection; when the available space is insufficient it SHALL appear below, and its final position/width SHALL remain clamped within the visible PDF viewer. The panel SHALL show a Translation heading plus waiting, streaming, completed, or failed state and SHALL render the selected text's result using the existing streaming translation component. Before any translated text is available, the panel's result area SHALL display the selected source text and SHALL NOT display a textual loading placeholder. On the first genuine provider delta or an immediate cache result, the source preview SHALL be replaced by the translated text. Genuine provider deltas SHALL become visible according to that component's rendering contract; a cache hit SHALL complete immediately.

#### Scenario: Panel appears above selection
- **WHEN** sufficient viewer space exists above the selected range
- **THEN** the translation panel SHALL be centered above the range with a visual gap and SHALL NOT cover the selected text

#### Scenario: Panel falls below near top edge
- **WHEN** the selection is too close to the top of the visible viewer for the panel
- **THEN** the panel SHALL appear below the selection without overlapping the selection toolbar

#### Scenario: Panel is clamped on narrow viewer
- **WHEN** the selection center is close to a left/right edge or the viewer is narrow
- **THEN** the panel width and horizontal position SHALL be clamped inside the viewer with a safe inset

#### Scenario: Selected source is visible while awaiting translation
- **WHEN** the user has started translating a PDF selection and no translated text is available yet
- **THEN** the panel result area SHALL display the selected source text
- **AND** it SHALL NOT display a textual loading placeholder such as “等待翻译” or “加载翻译”

#### Scenario: First translated text replaces source preview
- **WHEN** the translation request emits its first non-empty translated text or returns a cached translation
- **THEN** the panel result area SHALL replace the source preview with that translated text
- **AND** subsequent provider deltas SHALL continue growing the translated text normally

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
The active request and panel SHALL belong to one immutable selection identity. An ordinary outside click, unowned native-selection collapse, leaving the valid text layer, switching PDF/paper, entering region-capture mode, or unmounting the viewer SHALL abort active work and remove the panel and selection toolbar. A transient collapse caused by pointer interaction inside the panel SHALL preserve the active panel/source snapshot. Selecting a different valid selection SHALL abort the old request and remove the old panel; the new selection SHALL only show the selection toolbar until the user starts its translation. Late events from cancelled or superseded requests SHALL NOT alter the current panel. Scrolling the PDF while the selection remains valid SHALL reposition the selection toolbar and panel at the next animation frame; zoom or text-layer rerender that invalidates the DOM Range SHALL close them.

#### Scenario: New selection replaces active translation
- **WHEN** a translation panel is visible and the user selects different valid text
- **THEN** the old request SHALL be aborted and the old panel removed
- **AND** the selection toolbar SHALL appear for the new selection without starting a translation

#### Scenario: Plain outside click dismisses panel
- **WHEN** the translation panel is visible and a pointer interaction outside it completes without creating a different valid PDF selection
- **THEN** the viewer SHALL close the panel and abort any active request

#### Scenario: Escape closes panel
- **WHEN** the translation panel is visible and the user presses Escape
- **THEN** the panel and active request SHALL close while the existing completed database cache, if any, remains unchanged

#### Scenario: Viewer scroll repositions panel
- **WHEN** the selected text remains selected while the PDF viewport scrolls
- **THEN** toolbar and panel positioning SHALL be recomputed on an animation frame so they stay attached to the selection or close if the range is no longer valid/visible

#### Scenario: Zoom rerender invalidates selection
- **WHEN** zooming or page rerender replaces the selected text-layer nodes
- **THEN** the toolbar, request, and panel SHALL be cancelled instead of remaining at stale coordinates

#### Scenario: Late event is ignored
- **WHEN** an aborted selection request emits a late delta or terminal event
- **THEN** it SHALL NOT update the panel for the current selection

### Requirement: Selection translation coexists with PDF selection tools and authentication
Selection translation SHALL reuse the native text selection. The translate button and the existing copy-selection-link action SHALL share one floating selection toolbar below the selection. Pointer interaction inside the translation panel or the toolbar SHALL NOT inadvertently clear the source selection. Entering region screenshot capture mode SHALL suppress the toolbar and selection translation. Only authenticated users SHALL see the translate button or trigger the translation API; anonymous users SHALL retain native selection and existing public PDF behavior without an automatic login prompt or translation panel.

#### Scenario: Copy selection link remains available
- **WHEN** an authenticated user has a valid single-page selection in a paper's PDF
- **THEN** the selection toolbar SHALL offer both the translate button and the copy-selection-link action, addressing the same page/offset selection

#### Scenario: Panel interaction preserves source selection
- **WHEN** the user presses a panel control or scrolls the panel and browser focus transfer temporarily collapses the source PDF selection
- **THEN** the viewer SHALL preserve the translation panel and source snapshot instead of treating that `selectionchange` as outside dismissal
- **AND** the viewer SHALL restore the cloned source Range on pointer-up when the DOM Range remains valid

#### Scenario: Capture mode suppresses translation
- **WHEN** region screenshot capture mode is active
- **THEN** the selection toolbar and translation panel SHALL be removed and drag capture SHALL retain its existing behavior

#### Scenario: Anonymous selection does not call API
- **WHEN** an anonymous visitor selects PDF text
- **THEN** no translate button, translation request, or automatic login prompt SHALL appear
- **AND** the native selection and other anonymously available viewer behavior SHALL remain intact

## REMOVED Requirements

### Requirement: Stable PDF text selection triggers translation
**Reason**: Automatic translation after a 500ms stable selection interfered with ordinary selecting/copying and spent model calls on unintended selections.
**Migration**: Replaced by "Selection toolbar translate button starts translation" — the user clicks the 翻译 button in the selection toolbar to translate.

## ADDED Requirements

### Requirement: Selection toolbar translate button starts translation
For an authenticated user, once a native selection inside one rendered pdf.js page text layer settles, the PDF viewer SHALL show a floating selection toolbar centered below the selection containing a 翻译 button. The viewer SHALL NOT call the translation API merely because a selection exists or stays unchanged. Clicking the button SHALL start exactly one cache-first streaming translation for the current page/text/offset selection identity and show the translation panel. Clicking it again for the same identity while its panel is open SHALL NOT start a duplicate request.

#### Scenario: Selection shows toolbar without translating
- **WHEN** an authenticated user selects `hello, world` within one PDF text layer and leaves it selected
- **THEN** the selection toolbar with a 翻译 button SHALL appear below the selection
- **AND** no translation request SHALL be made

#### Scenario: Clicking translate starts translation
- **WHEN** the user clicks the 翻译 button for the current selection
- **THEN** the viewer SHALL start one cache-first streaming translation request for that selected text and show the panel above the selection

#### Scenario: Repeated click does not duplicate
- **WHEN** the panel for the current selection identity is already open and the user clicks 翻译 again
- **THEN** no duplicate translation request SHALL be created

#### Scenario: Selection outside one PDF page is ineligible
- **WHEN** a selection is collapsed, outside the viewer, outside a pdf.js text layer, or crosses PDF pages
- **THEN** the viewer SHALL preserve native selection but SHALL NOT show the selection toolbar or start translation
