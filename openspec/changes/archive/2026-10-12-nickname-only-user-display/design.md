## Context

See proposal.md for motivation. Shared Q&A, notes, reference links and highlights already consume nickname-first `display_name`. Home uses a shared usage formatter for both podium names/tooltips and overflow rows, but that formatter appends username.

## Goals / Non-Goals

Goals: align all regular-user attribution with nickname-only rendering, including tooltip text.
Non-goals: change login identity, admin account management, API payloads or database schema.

## Decisions

Change the existing usage formatter to return nickname directly, retaining its username, numeric-ID and unattributed fallbacks. Audit all frontend username references and backend display-name enrichment; retain already-correct consumers rather than adding a second display-name abstraction. API responses remain compatible because this is a display rule, not an API field-removal request.

## Risks / Trade-offs

Repeated nicknames are allowed → ownership and current-user markers continue to use immutable user IDs.
Missed attribution surface → inspect all frontend username/display-name references and verify existing enrichment coverage.

## Migration Plan

Build frontend normally on deployment; no migration. Rollback restores the previous formatter.

## Deployment verification

Production build completed successfully. Local running service health returned 200 with status ok; served index, entry JS/CSS and Home page bundle matched packages/frontend/dist. Browser visual acceptance remains for the user.
