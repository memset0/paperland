## MODIFIED Requirements

### Requirement: Selection-anchored streaming translation panel
When an eligible stable selection begins translating, the viewer SHALL show a lightweight panel anchored to that selection. It SHALL prefer a position centered above the selection; when the available space is insufficient it SHALL appear below, and its final position/width SHALL remain clamped within the visible PDF viewer. The panel SHALL show a Translation heading plus waiting, streaming, completed, or failed state and SHALL render the selected text's result using the existing streaming translation component. Before any translated text is available, the panel's result area SHALL display the selected source text and SHALL NOT display a textual loading placeholder. On the first genuine provider delta or an immediate cache result, the source preview SHALL be replaced by the translated text. Genuine provider deltas SHALL become visible according to that component's rendering contract; a cache hit SHALL complete immediately.

#### Scenario: Panel appears above selection
- **WHEN** sufficient viewer space exists above the selected range
- **THEN** the translation panel SHALL be centered above the range with a visual gap and SHALL NOT cover the selected text

#### Scenario: Panel falls below near top edge
- **WHEN** the selection is too close to the top of the visible viewer for the panel
- **THEN** the panel SHALL appear below the selection without overlapping the existing selection-link action

#### Scenario: Panel is clamped on narrow viewer
- **WHEN** the selection center is close to a left/right edge or the viewer is narrow
- **THEN** the panel width and horizontal position SHALL be clamped inside the viewer with a safe inset

#### Scenario: Selected source is visible while awaiting translation
- **WHEN** a stable PDF selection has started a translation request and no translated text is available yet
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
