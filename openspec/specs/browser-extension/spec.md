# browser-extension Specification

## Purpose
A Manifest V3 browser extension that detects the arxiv id of the paper on the current page (arxiv, Hugging Face, alphaXiv and similar sites) and opens it in Paperland with one click through the quick-open GET path.

## Requirements
### Requirement: Arxiv id detection from page URL
The extension SHALL extract an arxiv id from the active tab URL for at least these patterns, returning the id without version:
- `arxiv.org/abs/<id>`, `arxiv.org/pdf/<id>[.pdf]`, `arxiv.org/html/<id>`, and the same on `export.arxiv.org` / `www.arxiv.org`
- `huggingface.co/papers/<id>`
- `alphaxiv.org/abs/<id>`, `alphaxiv.org/overview/<id>`, `alphaxiv.org/pdf/<id>` (with or without `www.`)

#### Scenario: arxiv abs page with version
- **WHEN** the URL is `https://arxiv.org/abs/2401.12345v3`
- **THEN** the detected id is `2401.12345`

#### Scenario: arxiv pdf page
- **WHEN** the URL is `https://arxiv.org/pdf/2401.12345v1.pdf` or `https://arxiv.org/pdf/2401.12345`
- **THEN** the detected id is `2401.12345`

#### Scenario: arxiv html page
- **WHEN** the URL is `https://arxiv.org/html/2401.12345v2#S3`
- **THEN** the detected id is `2401.12345`

#### Scenario: Old-style arxiv id
- **WHEN** the URL is `https://arxiv.org/abs/hep-th/9901001`
- **THEN** the detected id is `hep-th/9901001`

#### Scenario: Hugging Face paper page
- **WHEN** the URL is `https://huggingface.co/papers/2401.12345`
- **THEN** the detected id is `2401.12345`

#### Scenario: alphaXiv page
- **WHEN** the URL is `https://www.alphaxiv.org/abs/2401.12345v2` or `https://www.alphaxiv.org/overview/2401.12345`
- **THEN** the detected id is `2401.12345`

#### Scenario: Unrelated page
- **WHEN** the URL is `https://example.com/2401.12345`
- **THEN** no id is detected from the URL

### Requirement: Page metadata fallback
When the URL yields no id, the extension SHALL inspect the active page for a `<meta name="citation_arxiv_id">` value and use it if it parses as an arxiv id. Failure to inspect the page (restricted pages) SHALL be treated as "no id found".

#### Scenario: Meta tag present
- **WHEN** the URL has no id but the page contains `<meta name="citation_arxiv_id" content="2401.12345">`
- **THEN** the detected id is `2401.12345`

### Requirement: One-click open in Paperland
Clicking the toolbar button (or pressing the `Alt+Shift+P` shortcut) SHALL open a new tab, next to the current one, at `<base_url>/open/arxiv/<id>?token=<token>` using the configured base URL (trailing slash removed) and token. When no id is detected the extension SHALL NOT open a tab and SHALL show a short-lived "?" badge on the button. When the base URL or token is not configured, it SHALL open the options page instead.

#### Scenario: Supported page
- **WHEN** the user clicks the button on `https://arxiv.org/abs/2401.12345` with base URL `https://paper.example.com/` and token `t0k`
- **THEN** a new tab opens at `https://paper.example.com/open/arxiv/2401.12345?token=t0k`

#### Scenario: Unsupported page
- **WHEN** the user clicks the button on a page without an arxiv id
- **THEN** no tab is opened and the button briefly shows a "?" badge

#### Scenario: Not configured
- **WHEN** the base URL or token is empty
- **THEN** the extension's options page is opened

### Requirement: Extension options
The extension SHALL provide an options page to set the Paperland base URL and the quick-open token, persisted in extension sync storage, with a save confirmation. When sync storage has no value for a setting, the extension SHALL fall back to the bundled `src/preset.json` (written by the personalized download); values saved by the user SHALL take precedence over the preset, and a missing or malformed preset SHALL be treated as empty. The extension SHALL work in Chromium browsers and Firefox without a build step and SHALL request no host permissions beyond what is granted on user click (`activeTab`).

#### Scenario: Save options
- **WHEN** the user enters a base URL and token and saves
- **THEN** the values are persisted and used by subsequent clicks

#### Scenario: Preset from personalized download
- **WHEN** the extension was installed from a personalized download and the user never saved options
- **THEN** clicks use the preset base URL and token, and the options page shows them pre-filled

#### Scenario: No preset
- **WHEN** the extension is loaded from the repository (no `preset.json`) and nothing is saved
- **THEN** the extension behaves as unconfigured and opens the options page on click
