## Purpose

Provide a user-facing control that switches the application between a light theme, a dark theme, and a "follow system" mode, persisting the choice and applying it to the whole UI via the existing `.dark` design tokens without a flash on load.

## ADDED Requirements

### Requirement: Three-State Theme Cycle

The system SHALL provide a single control that cycles the theme mode through three states — light, dark, and system — advancing one step per activation in the order Light → Dark → System → Light.

#### Scenario: Cycling forward through modes
- **WHEN** the theme mode is "light" and the user activates the control
- **THEN** the mode SHALL become "dark"
- **AND** activating it again SHALL set the mode to "system"
- **AND** activating it once more SHALL return the mode to "light"

#### Scenario: Control reflects the current mode
- **WHEN** the active mode is light, dark, or system
- **THEN** the control SHALL display an indicator distinct to that mode (e.g. a sun, moon, or monitor icon)
- **AND** expose the current mode's name via an accessible label or tooltip

### Requirement: Resolved Theme Applied To Document

The system SHALL apply the resolved theme to the document by adding the `.dark` class to the document root element when the resolved theme is dark and removing it when the resolved theme is light, where "system" resolves to the operating system's `prefers-color-scheme` value.

#### Scenario: Explicit dark mode
- **WHEN** the mode is set to "dark"
- **THEN** the document root SHALL carry the `.dark` class
- **AND** all UI surfaces SHALL use the dark design tokens

#### Scenario: Explicit light mode
- **WHEN** the mode is set to "light"
- **THEN** the document root SHALL NOT carry the `.dark` class

#### Scenario: System mode resolves to OS preference
- **WHEN** the mode is "system" and the OS prefers a dark color scheme
- **THEN** the document root SHALL carry the `.dark` class
- **AND** WHEN the OS prefers a light color scheme the class SHALL be absent

### Requirement: Live System Preference Tracking

The system SHALL, while the mode is "system", react to operating-system color-scheme changes at runtime and update the resolved theme without requiring a reload.

#### Scenario: OS theme changes while in system mode
- **WHEN** the mode is "system" and the OS color scheme changes from light to dark
- **THEN** the resolved theme SHALL update to dark and the `.dark` class SHALL be added

#### Scenario: Explicit mode ignores OS changes
- **WHEN** the mode is "light" or "dark" and the OS color scheme changes
- **THEN** the resolved theme SHALL NOT change

### Requirement: Theme Persistence

The system SHALL persist the chosen mode to `localStorage` under the key `paperland_theme` and restore it on subsequent loads, defaulting to "system" when no value is stored or the stored value is invalid or inaccessible.

#### Scenario: Choice survives reload
- **WHEN** the user sets the mode to "dark" and reloads the page
- **THEN** the restored mode SHALL be "dark"

#### Scenario: Missing or invalid stored value
- **WHEN** no `paperland_theme` value is stored, or the stored value is not one of light/dark/system, or `localStorage` is unavailable
- **THEN** the mode SHALL default to "system"

### Requirement: No Flash Of Light Theme On Load

The system SHALL apply the resolved theme to the document root before the first paint so a reload in dark mode does not briefly display the light theme.

#### Scenario: Reload while in dark mode
- **WHEN** the persisted mode resolves to dark and the page is reloaded
- **THEN** the document SHALL render dark from the first paint, with no visible light-to-dark flash

### Requirement: Toggle Placement

The system SHALL place the theme control in the bottom-left region of the application chrome — within the desktop sidebar's bottom section alongside the account/GitHub controls, and within the mobile navigation drawer's footer.

#### Scenario: Desktop placement
- **WHEN** the app is viewed at desktop width and not in embed mode
- **THEN** the theme control SHALL appear in the sidebar's bottom-left section

#### Scenario: Mobile placement
- **WHEN** the app is viewed at mobile width and not in embed mode
- **THEN** the theme control SHALL appear in the navigation drawer's footer

#### Scenario: Hidden in embed mode
- **WHEN** the app is loaded in embed mode (the sidebar/chrome is hidden)
- **THEN** the theme control SHALL NOT be shown
