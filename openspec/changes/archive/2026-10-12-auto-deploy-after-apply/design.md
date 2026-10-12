## Context

AGENTS.md already separates verification builds from production builds and requires user-requested archive. See proposal.md for motivation.

## Goals / Non-Goals

Goals: make deployment and result verification a normal continuation of successful apply before requesting user acceptance.
Non-goals: auto-archive without authorization or change application code.

## Decisions

Add an explicit after-apply section and link it from the existing apply and archive sections. Frontend deployment uses the existing queued production build; scratch builds are verification only. Backend changes use the existing deployment mechanism from project root where required. Pure documentation changes report that runtime deployment is unnecessary. User instructions can explicitly defer deployment. Ask for acceptance only after reporting concrete deployment evidence.

## Risks / Trade-offs

Deployment failure → report the failure, retain active change and do not ask to archive as successful.
Documentation-only work → report no runtime deployment needed rather than rebuilding unrelated code.
