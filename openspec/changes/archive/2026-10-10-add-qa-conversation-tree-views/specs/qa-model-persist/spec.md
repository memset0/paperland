## MODIFIED Requirements

### Requirement: Persist selected models to localStorage
The question box SHALL select exactly one model at a time; choosing another model SHALL replace the selection. The selection SHALL be written to localStorage (key: `paperland_selected_models`, stored as a one-element array) whenever it changes.

#### Scenario: User selects a model and refreshes page
- **WHEN** the user selects model B and reloads the page
- **THEN** the question box restores B as the only selected model

#### Scenario: Picking another model replaces the selection
- **WHEN** model A is selected and the user clicks model B
- **THEN** only B is selected

#### Scenario: Legacy multi-model cache
- **WHEN** localStorage still holds several models from an earlier version
- **THEN** only the first one that is still available stays selected

#### Scenario: User navigates away and returns
- **WHEN** the user selects a model, navigates elsewhere and returns
- **THEN** the selection is unchanged
