## MODIFIED Requirements

### Requirement: Feature registry
The system SHALL keep a feature registry in the repository. Each feature SHALL have a unique stable `key`, an English `title`, a short English `description`, an illustrative image, and a `released_at` date (`YYYY-MM-DD`) equal to the archive date of the OpenSpec change that shipped it (or, when no such change exists, the date of the earliest commit that introduced it). Images SHALL be served without login. The registry SHALL contain exactly: Custom Q&A (2026-03-18), Highlight model output (2026-03-19), Copy LaTeX (2026-03-20), Notes (2026-05-29), Deep Research paper lists (2026-10-09), Q&A conversation view (2026-10-10) and Usage dashboard (2026-10-10).

#### Scenario: Registry content
- **WHEN** a signed-in user requests the features list
- **THEN** it SHALL contain the seven registered features, each with key, title, description, image URL and release date

#### Scenario: Unreleased feature absent
- **WHEN** the features list is requested
- **THEN** it SHALL contain only the registered features listed above

#### Scenario: Deep Research announced
- **WHEN** a signed-in user requests the features list
- **THEN** it SHALL contain `deep-research` titled "Deep Research paper lists" with release date 2026-10-09

### Requirement: Home features section
The Home page SHALL show a "Features" section listing only the features the signed-in user has not seen yet, newest first, each as a card with image, title, description, release date and a red dot. The section header SHALL show a red count of unseen features (hidden when zero) and an "All features" button. Clicking an unseen card (or pressing Enter/Space on it) SHALL mark that feature seen: the card SHALL disappear from the section and the counts SHALL decrease by one immediately. When the user has seen every feature, the section SHALL show "No new features". Merely opening Home SHALL NOT mark anything seen.

#### Scenario: Clicking a new feature
- **WHEN** a user with three unseen features opens Home and clicks the `copy-latex` card, which shows a red dot
- **THEN** the `copy-latex` card SHALL disappear from the section, the header and sidebar counts SHALL show 2, and on the next visit `copy-latex` SHALL not be listed on Home

#### Scenario: Opening Home without clicking
- **WHEN** a user opens Home and leaves without clicking any card
- **THEN** every unseen feature SHALL still be listed with its red dot on the next visit

#### Scenario: Everything seen
- **WHEN** a user has seen every feature and opens Home
- **THEN** the Features section SHALL show "No new features" and the "All features" button

## ADDED Requirements

### Requirement: Feature history dialog
Clicking "All features" in the Home Features header SHALL open a dialog listing every registered feature newest first, each as a card with image, title, description and release date, whether seen or not. Unseen features in the dialog SHALL show the red dot and clicking them SHALL mark them seen (removing the dot and the card from the Home section). Opening the dialog SHALL NOT mark anything seen. The dialog SHALL be closable and scroll when the list is taller than the viewport.

#### Scenario: Browse history after seeing everything
- **WHEN** a user who has seen every feature clicks "All features"
- **THEN** a dialog SHALL list all seven features newest first with no red dots

#### Scenario: Opening the dialog does not mark seen
- **WHEN** a user with two unseen features opens and closes the dialog without clicking a card
- **THEN** both features SHALL remain listed on Home with red dots
