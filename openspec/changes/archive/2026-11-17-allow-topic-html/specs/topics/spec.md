## ADDED Requirements

### Requirement: Sanitized HTML in Topic Markdown
Topic page bodies, directory descriptions and catalog entry comments SHALL render raw HTML embedded in their Markdown after sanitizing it. Sanitizing SHALL remove scripts, event-handler attributes, `javascript:` URLs, `style`/`iframe`/`object`/`embed` elements and form controls, and SHALL drop `style` attributes that set `position: fixed` or `position: sticky`; other inline styles SHALL be kept. Markdown outside Topics SHALL keep raw HTML disabled.

#### Scenario: Highlight span renders
- **WHEN** a Topic page contains `<span style="background:#fef08a">key idea</span>`
- **THEN** the page SHALL show "key idea" with that background instead of the literal tag text

#### Scenario: Unsafe HTML is removed
- **WHEN** Topic Markdown contains `<script>`, `<img onerror=…>`, an `<a href="javascript:…">` link or `<div style="position:fixed">`
- **THEN** the rendered page SHALL contain no script, event handler, `javascript:` URL or fixed/sticky positioning

#### Scenario: Other Markdown unchanged
- **WHEN** a Q&A answer or note contains `<span style="color:red">x</span>`
- **THEN** it SHALL still render as literal text
