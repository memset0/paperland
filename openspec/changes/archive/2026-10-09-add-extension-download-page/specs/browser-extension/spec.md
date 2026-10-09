## MODIFIED Requirements

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
