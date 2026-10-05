## ADDED Requirements

### Requirement: Image width directive in alt text
The system SHALL recognize an image width directive of the form `w=<value>` embedded in a markdown image's alt text, where `<value>` is one of the preset tier keywords `sm`, `md`, `lg` (case-insensitive) or a positive integer interpreted as a pixel value. The directive SHALL be matched as a whitespace/word-boundary-delimited token located anywhere within the alt text. The first valid `w=` token SHALL be used; any additional `w=` tokens SHALL be ignored.

#### Scenario: Bare image with tier directive
- **WHEN** a note contains `![w=md](https://example.com/fig.png)`
- **THEN** the rendered `<img>` SHALL have its `max-width` capped at the `md` tier value

#### Scenario: Anchor-wrapped PDF screenshot with directive
- **WHEN** a note contains `[![w=lg](https://host/img.png)](paperland://paper/1?pdf=2&rx=0.1&ry=0.1&rw=0.5&rh=0.3)`
- **THEN** the rendered `<img>` inside the anchor SHALL have its `max-width` capped at the `lg` tier value, and the anchor SHALL still link to the `paperland://` target

#### Scenario: Directive mixed with descriptive alt text
- **WHEN** a note contains `![figure 1 w=sm](https://example.com/fig.png)`
- **THEN** the rendered `<img>` SHALL have its `max-width` capped at the `sm` tier value
- **AND** the rendered `<img>` `alt` attribute SHALL be `figure 1` (the directive token removed)

#### Scenario: Explicit pixel directive
- **WHEN** a note contains `![w=100](https://example.com/fig.png)`
- **THEN** the rendered `<img>` SHALL have `max-width` set to 100 pixels (combined with the container cap)

### Requirement: Default rendering when no directive present
The system SHALL render images without a width directive exactly as before — the image fills its column width (`width: 100%`) bounded only by `max-width: 100%` of the container. The directive SHALL act only as an additional upper bound and never as a replacement of the default behavior.

#### Scenario: Image with no directive
- **WHEN** a note contains `![a diagram](https://example.com/fig.png)` with no `w=` token
- **THEN** the rendered `<img>` SHALL keep the default sizing (`max-width: 100%`, `height: auto`) with no additional cap

#### Scenario: Directive never causes overflow
- **WHEN** an image with `w=lg` (or any tier/number larger than the available column) is rendered in a container narrower than that width
- **THEN** the image SHALL be capped at the container width (it SHALL NOT overflow), because the cap is the minimum of the directive value and 100% of the container

#### Scenario: Aspect ratio preserved
- **WHEN** a width directive caps an image's `max-width`
- **THEN** the image height SHALL scale proportionally (`height: auto`)

### Requirement: Width tiers are configurable
The system SHALL source the three tier pixel values (`sm`, `md`, `lg`) from configuration, applying them as CSS custom properties. The rendering CSS SHALL include the designed default values as fallbacks (`sm` = 240px, `md` = 480px, `lg` = 720px) so images render correctly even when the configured values have not been fetched.

#### Scenario: Default tier values
- **WHEN** no `notes.image_width_tiers` overrides are configured
- **THEN** `w=sm` SHALL cap at 240px, `w=md` at 480px, and `w=lg` at 720px

#### Scenario: Overridden tier values
- **WHEN** `notes.image_width_tiers` configures different pixel values for `sm`/`md`/`lg`
- **THEN** the corresponding tier directives SHALL cap at the configured values

#### Scenario: Config not fetched
- **WHEN** note content is rendered in a context where the tier config has not been fetched (e.g. an anonymous/public note view)
- **THEN** the tier directives SHALL still cap at the built-in CSS fallback values (240 / 480 / 720)

### Requirement: Invalid directive values are ignored
The system SHALL ignore malformed or out-of-range width directives and fall back to default image rendering. Numeric pixel values SHALL be clamped to a sane range (`[16, 4096]` px); non-positive or non-integer numeric values, and unrecognized keywords, SHALL be treated as no directive.

#### Scenario: Unrecognized keyword
- **WHEN** a note contains `![w=huge](https://example.com/fig.png)`
- **THEN** the image SHALL render with default sizing (no cap), as if no directive were present

#### Scenario: Out-of-range pixel value
- **WHEN** a note contains `![w=99999](https://example.com/fig.png)`
- **THEN** the applied `max-width` SHALL be clamped to the maximum allowed value (4096px), still bounded by the container

#### Scenario: Zero or negative pixel value
- **WHEN** a note contains `![w=0](https://example.com/fig.png)` or `![w=-50](https://example.com/fig.png)`
- **THEN** the image SHALL render with default sizing (no cap)

### Requirement: Directive applies to direct note rendering only
The system SHALL apply the width directive only during direct note rendering (note views, paper notes card, public notes, walkthrough). It SHALL NOT alter image sizing inside the mindmap (`NoteNode` content nodes), where image size remains governed by the node layout. The directive token SHALL still be stripped from the alt text in mindmap rendering so it does not appear as visible text.

#### Scenario: Mindmap content node with directive
- **WHEN** a mindmap content node renders a blockquote containing `![w=sm](https://example.com/fig.png)`
- **THEN** the image SHALL be sized by the existing mindmap node layout (not capped at the `sm` tier)
- **AND** the rendered `<img>` `alt` attribute SHALL NOT contain the `w=sm` token

#### Scenario: Same image in direct note rendering
- **WHEN** the same `![w=sm](https://example.com/fig.png)` is rendered directly in a note view (not the mindmap)
- **THEN** the image SHALL be capped at the `sm` tier value
