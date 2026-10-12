## ADDED Requirements

### Requirement: QA user preferences table
The database SHALL have `qa_user_preferences` with `user_id`, `qa_entry_id`, `background_color`, `created_at`, and `updated_at`. `(user_id, qa_entry_id)` SHALL be unique and indexed. Removing an entry SHALL also remove its preferences.

#### Scenario: One row per viewer and entry
- **WHEN** one user changes the same entry repeatedly
- **THEN** updates SHALL affect one row rather than create duplicates

#### Scenario: Different viewers
- **WHEN** two users color the same entry
- **THEN** two independently owned rows SHALL coexist

#### Scenario: Paper deletion
- **WHEN** a paper and its QA entries are deleted
- **THEN** corresponding preference rows SHALL be removed within the same safe deletion flow

