## Purpose

Give Paperland a lightweight version number, maintained by agents when OpenSpec changes are archived, and show it together with the git commit hash in the web UI so the running build can be identified.

## ADDED Requirements

### Requirement: Single version source
Paperland's version SHALL be the `version` field of the repository root `package.json`, formatted `MAJOR.MINOR.PATCH`. The initial version SHALL be `2.0.0`. Workspace package versions SHALL NOT be treated as the Paperland version.

#### Scenario: Version read from the root package
- **WHEN** the frontend is built or the dev server starts
- **THEN** the displayed version SHALL equal the root `package.json` `version`

### Requirement: Version bump rules
The version SHALL be updated as follows. MAJOR SHALL change only when the developer explicitly asks for it. MINOR SHALL be incremented whenever a change makes an incompatible database schema change, and MAY also be incremented when the user asks; incrementing MINOR SHALL reset PATCH to `0`. PATCH SHALL be incremented when at least one OpenSpec change is archived. The agent performing the archive SHALL update the version as part of the archive; the version SHALL NOT be changed during implementation.

#### Scenario: Archive bumps the patch version
- **WHEN** an agent archives an OpenSpec change while the version is `2.0.3` and the change has no incompatible schema change
- **THEN** the version SHALL become `2.0.4`, committed together with the archive

#### Scenario: Incompatible schema change bumps the minor version
- **WHEN** an archived change includes an incompatible database schema change while the version is `2.0.4`
- **THEN** the version SHALL become `2.1.0`

#### Scenario: Major version requires an explicit request
- **WHEN** no developer has asked for a major version change
- **THEN** MAJOR SHALL remain unchanged regardless of the changes archived

### Requirement: Footer shows version and git hash
The frontend SHALL embed, at build time (or dev server start), the version and the short hash of the checked-out git `HEAD`; when the hash cannot be determined it SHALL show `unknown`. Every page rendered with the shared `AppPage` layout SHALL end with a small muted footer reading `Paperland v<version> · <hash>`, where the hash links to that commit on the project's GitHub repository. The mobile navigation drawer SHALL show the same line at its bottom. Pages that do not use `AppPage` (e.g. paper detail) SHALL NOT be required to show it.

#### Scenario: Management page footer
- **WHEN** a user opens a management page built from commit `abc1234` with version `2.0.0`
- **THEN** the page SHALL show `Paperland v2.0.0 · abc1234` at its bottom, with `abc1234` linking to the GitHub commit

#### Scenario: Hash unavailable
- **WHEN** the build runs where `git` is unavailable
- **THEN** the footer SHALL show `unknown` in place of the hash without a link, and the build SHALL succeed
