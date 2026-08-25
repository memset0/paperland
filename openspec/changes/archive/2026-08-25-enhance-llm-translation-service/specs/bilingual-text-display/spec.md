## MODIFIED Requirements

### Requirement: On-demand translation gated to logged-in users
`BilingualText` SHALL preserve its existing on-demand and login-gated behavior. It SHALL NOT invoke a model merely because an uncached English source is rendered. For a logged-in user, clicking Translate SHALL mount a `StreamingTranslationText` child for the source text; creating that child SHALL start the authenticated streaming translation request. For an unauthenticated user, clicking SHALL open the existing login prompt and SHALL NOT mount the streaming child or call a translation API. A cache peek that already found a completed translation MAY mount the child automatically because its cache-first stream completes without a model invocation.

#### Scenario: Logged-in user translates on click
- **WHEN** a logged-in user clicks Translate for uncached text
- **THEN** `BilingualText` SHALL mount `StreamingTranslationText` with that text and the child SHALL call `POST /api/translate/stream`

#### Scenario: Not-logged-in user is prompted to log in
- **WHEN** a user who is not authenticated clicks Translate
- **THEN** `BilingualText` SHALL open the login prompt and SHALL NOT mount `StreamingTranslationText` or call the translation API

#### Scenario: Loading state during translation
- **WHEN** the mounted streaming child reports an active request
- **THEN** `BilingualText` SHALL show its existing loading treatment and disable conflicting translation actions until a terminal state

### Requirement: Translated Chinese appended below the original
`BilingualText` SHALL keep the English source visible and compose `StreamingTranslationText` below it for the Chinese text. The compact header row SHALL retain the "Translation" label plus inline hide/show and re-translate controls. The child SHALL expose progressive text and status; `BilingualText` SHALL use those values without reimplementing SSE parsing. Re-translate SHALL remount or restart the child with `force: true`. A successful `done` result SHALL be authoritative, and hiding/showing SHALL remain available for completed text.

#### Scenario: Append Chinese below English with inline controls
- **WHEN** translation completes successfully
- **THEN** the authoritative Chinese text rendered by `StreamingTranslationText` SHALL appear below the English source and the existing inline controls SHALL remain available

#### Scenario: Render genuine deltas progressively
- **WHEN** the child receives multiple non-empty `delta` events
- **THEN** `BilingualText` SHALL expose the child's growing Chinese text while retaining its loading state until completion

#### Scenario: Re-translate refreshes the translation
- **WHEN** the user clicks Re-translate
- **THEN** `BilingualText` SHALL start a new `StreamingTranslationText` request with `force: true` and SHALL ignore events from the superseded child request

## ADDED Requirements

### Requirement: Auto-starting streaming translation text component
The frontend SHALL provide a reusable `StreamingTranslationText` component that accepts source `text` and optional `force`. On creation and whenever its source request identity changes, it SHALL call `POST /api/translate/stream`, consume named SSE events, and maintain `translated_text`, `status`, `cached`, and `error` state. It SHALL append each genuine provider delta in full and in order, then yield one animation frame before processing the next already-available delta. This SHALL allow the browser to repaint periodically during a sustained stream without subdividing provider deltas, rate-limiting output, or adding an artificial timer. It SHALL process all delta callbacks before applying authoritative `done.translated_text`. A cache hit or final-only provider that emits no delta SHALL render done immediately without simulated streaming.

#### Scenario: Creation starts translation
- **WHEN** `StreamingTranslationText` is created with non-empty text
- **THEN** it SHALL immediately start one cache-first streaming translation request for that text

#### Scenario: Deltas fill text progressively
- **WHEN** the API emits three ordered delta events
- **THEN** the component's `translated_text` SHALL grow by those exact fragments in order before `done`

#### Scenario: Coalesced deltas remain visibly progressive
- **WHEN** several provider deltas arrive within one browser rendering frame
- **THEN** the component SHALL append each complete delta and yield one animation frame before processing the next delta so the first repaint does not wait for the whole stream

#### Scenario: Rendering does not throttle provider deltas
- **WHEN** a provider delta contains a large text fragment
- **THEN** the component SHALL append that fragment in one update rather than split it into timed character groups

#### Scenario: Done waits for delta paint callbacks
- **WHEN** `done` arrives while a prior delta callback is yielding its browser frame
- **THEN** the component SHALL finish that callback before replacing text with authoritative `done.translated_text` and marking status completed

#### Scenario: Done is authoritative
- **WHEN** `done` follows zero or more deltas
- **THEN** the component SHALL set `translated_text` to the complete text in `done` and set status to completed

#### Scenario: Cached result completes immediately
- **WHEN** the API stream reports a cache hit
- **THEN** the component SHALL render the cached `done.translated_text` immediately without expecting or fabricating deltas

#### Scenario: Empty source does not call API
- **WHEN** the component is created with empty or whitespace-only text
- **THEN** it SHALL remain idle and SHALL NOT call the translation API

### Requirement: Streaming text is style-transparent and composable
`StreamingTranslationText` SHALL support direct styling from its parent. In its default rendering mode it SHALL render the current translation through a configurable semantic root element and forward parent-provided `class`, `style`, ARIA, and ordinary HTML attributes to that actual text element. It SHALL also offer a scoped default slot exposing at least `{ text, status, cached, error }`; when the slot is used, the parent SHALL fully control the rendered markup and styling. The component SHALL NOT impose typography, color, spacing, or Markdown rendering beyond the minimal streaming text behavior.

#### Scenario: Parent class styles fallback text
- **WHEN** a parent renders `<StreamingTranslationText class="text-sm text-muted-foreground" ... />` without a slot
- **THEN** those classes SHALL be applied to the actual element containing the translated text

#### Scenario: Parent chooses semantic element
- **WHEN** the parent selects a paragraph root
- **THEN** the translation SHALL render in a `<p>` element without an extra styling wrapper

#### Scenario: Parent uses scoped slot
- **WHEN** a parent supplies the scoped default slot
- **THEN** the slot SHALL receive current text/status/cache/error state and the parent SHALL control all output markup

#### Scenario: Component has no default typography
- **WHEN** no styling attributes or slot are supplied
- **THEN** the component SHALL render readable plain text without adding product-specific typography classes

### Requirement: Translation stream cancellation and failure state
`StreamingTranslationText` SHALL own an abort controller for its active request. It SHALL abort the prior request when its source request identity changes or it unmounts. A terminal stream error SHALL set an error state, stop loading, and SHALL NOT mark partial text as a completed cached translation. It SHALL expose status changes and terminal results through typed events or the scoped slot so composing components do not need to parse SSE. Events from an older or aborted request SHALL NOT overwrite a newer request.

#### Scenario: Component unmounts during translation
- **WHEN** `StreamingTranslationText` unmounts while a request is active
- **THEN** it SHALL abort that request and ignore later events

#### Scenario: Source text changes during translation
- **WHEN** its `text` prop changes before completion
- **THEN** it SHALL abort the old request, clear old provisional state, and start exactly one request for the new non-empty text

#### Scenario: Stream fails after partial display
- **WHEN** an `error` event arrives after partial Chinese text has been received
- **THEN** status SHALL become failed, partial text SHALL remain explicitly provisional or be cleared according to the parent presentation, and it SHALL NOT be treated as a completed cached result

#### Scenario: Stale stream cannot overwrite newer state
- **WHEN** a cancelled earlier request produces a late event after a new request has started
- **THEN** the component SHALL ignore it and preserve the newer request's state

### Requirement: Admin-only hidden translation stream test page
The frontend SHALL provide a dedicated `/translation-test` page for manually exercising the streaming translation flow. The route SHALL have `meta.title`, `meta.icon`, and `requiresAdmin: true`, and the view SHALL use `AppPage`. It SHALL NOT appear in desktop or mobile sidebar navigation. The page SHALL provide editable source text, a force-retranslation control, explicit start/reset controls, visible request/cache/stream/error status, and a `StreamingTranslationText` instance whose growing output can be inspected and styled by the page.

#### Scenario: Admin opens test page directly
- **WHEN** an authenticated administrator navigates directly to `/translation-test`
- **THEN** the router SHALL render the test page and the page SHALL not start a request until the administrator explicitly submits non-empty source text

#### Scenario: Anonymous user is blocked
- **WHEN** an unauthenticated user navigates directly to `/translation-test`
- **THEN** the existing route guard SHALL open the login prompt, redirect or keep the user on a safe public route, and SHALL NOT mount the test page

#### Scenario: Non-admin user is blocked
- **WHEN** an authenticated non-admin user navigates directly to `/translation-test`
- **THEN** the existing route guard SHALL deny access and redirect or keep the user on a safe route

#### Scenario: Test page is absent from navigation
- **WHEN** desktop or mobile sidebar navigation is rendered for an administrator
- **THEN** no `/translation-test` navigation item SHALL be shown

#### Scenario: Administrator observes streaming output
- **WHEN** an administrator submits source text on the test page with a streaming provider selected by `translation.model`
- **THEN** the page SHALL mount `StreamingTranslationText`, show progressive text and status, and expose the authoritative done/error outcome
