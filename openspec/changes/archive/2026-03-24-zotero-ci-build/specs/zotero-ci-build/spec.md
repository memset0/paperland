## ADDED Requirements

### Requirement: Automatic build on Zotero plugin changes
The CI workflow SHALL automatically trigger a build when changes are pushed to the `main` branch that affect files under `packages/zotero-plugin/` or `.github/workflows/build-zotero-plugin.yml`.

#### Scenario: Push with Zotero plugin file changes
- **WHEN** a commit is pushed to `main` that modifies files in `packages/zotero-plugin/`
- **THEN** the build workflow SHALL be triggered and produce the `.xpi` artifact

#### Scenario: Push with CI workflow changes
- **WHEN** a commit is pushed to `main` that modifies `.github/workflows/build-zotero-plugin.yml`
- **THEN** the build workflow SHALL be triggered

#### Scenario: Push with unrelated changes only
- **WHEN** a commit is pushed to `main` that only modifies files outside the trigger paths
- **THEN** the build workflow SHALL NOT be triggered

### Requirement: Manual build trigger
The CI workflow SHALL support manual triggering via GitHub Actions `workflow_dispatch`.

#### Scenario: Manual trigger from Actions UI
- **WHEN** a user triggers the workflow manually from the GitHub Actions interface
- **THEN** the build workflow SHALL execute and produce the `.xpi` artifact

### Requirement: Build produces XPI artifact
The CI workflow SHALL build the Zotero plugin and upload the resulting `.xpi` file as a downloadable GitHub Actions artifact.

#### Scenario: Successful build
- **WHEN** the build workflow runs successfully
- **THEN** the `.xpi` file SHALL be uploaded as a GitHub Actions artifact named `zotero-plugin-xpi`
- **AND** the artifact SHALL be downloadable from the workflow run page

#### Scenario: Build failure
- **WHEN** the build step fails (e.g., TypeScript compilation error)
- **THEN** the workflow SHALL report failure and NOT upload any artifact

### Requirement: Bun-based build environment
The CI workflow SHALL use Bun as the runtime, installed via `oven-sh/setup-bun` action, and install dependencies from the project root directory.

#### Scenario: Dependency installation
- **WHEN** the workflow sets up the build environment
- **THEN** it SHALL run `bun install` from the project root (not from `packages/zotero-plugin/`)
- **AND** it SHALL use `oven-sh/setup-bun` to install Bun
