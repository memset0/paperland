## REMOVED Requirements

### Requirement: Inline math rendering with backslash-parenthesis
**Reason**: `@traptitech/markdown-it-katex` does not recognize `\(...\)`; the requirement described behavior the implementation never had. Backslash delimiters are intentionally left unrendered so that wrongly formatted model output stays visible.
**Migration**: Write inline math as `$...$`; see "Only dollar delimiters render as math".

### Requirement: Display math rendering with backslash-bracket
**Reason**: `@traptitech/markdown-it-katex` does not recognize `\[...\]`; the requirement described behavior the implementation never had. Backslash delimiters are intentionally left unrendered so that wrongly formatted model output stays visible.
**Migration**: Write display math as `$$...$$`; see "Only dollar delimiters render as math".

## ADDED Requirements

### Requirement: Only dollar delimiters render as math
Only `$...$` (inline) and `$$...$$` (display) SHALL be rendered as math. The system SHALL NOT convert `\(...\)` or `\[...\]` into math delimiters, so content using them is shown as text and formatting mistakes remain visible. Model prompts that produce Markdown (Q&A and Deep Research) SHALL instruct the model to use `$` / `$$`.

#### Scenario: Backslash-parenthesis is not rendered
- **WHEN** markdown content contains `The value \(\alpha\) is positive`
- **THEN** no KaTeX element SHALL be rendered for it

#### Scenario: Dollar math is rendered
- **WHEN** markdown content contains `The value $\alpha$ is positive`
- **THEN** alpha SHALL be rendered as inline math
