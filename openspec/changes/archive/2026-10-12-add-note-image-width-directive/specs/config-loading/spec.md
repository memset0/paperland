## ADDED Requirements

### Requirement: Notes image width tiers configuration
The config SHALL support a `notes.image_width_tiers` block specifying the pixel `max-width` for the three note-image width tiers `sm`, `md`, and `lg`. Each value SHALL be a positive integer. The block and each field SHALL have explicit defaults (`sm` = 240, `md` = 480, `lg` = 720) so that omitting the block, or any field, yields the designed default rather than an empty/undefined value.

#### Scenario: Tiers omitted from config
- **WHEN** `config.yml` does not contain a `notes.image_width_tiers` block
- **THEN** the loaded config SHALL provide `sm = 240`, `md = 480`, `lg = 720`

#### Scenario: Tiers fully specified
- **WHEN** `config.yml` contains `notes.image_width_tiers` with `sm`, `md`, and `lg` integer values
- **THEN** the loaded config SHALL use those values

#### Scenario: Partial override
- **WHEN** `config.yml` specifies only `notes.image_width_tiers.md`
- **THEN** the loaded config SHALL use the provided `md` value and the defaults for `sm` and `lg`

#### Scenario: Invalid tier value
- **WHEN** `config.yml` specifies a non-integer or non-positive value for a tier
- **THEN** the server SHALL fail to start with a Zod validation error identifying the offending field
