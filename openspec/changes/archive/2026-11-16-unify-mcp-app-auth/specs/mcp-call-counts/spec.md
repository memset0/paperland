# Spec Delta

## MODIFIED Requirements

### Requirement: User totals and optional Topic subtotals
Calls to tools that operate on one Topic (with a `topic_id` argument the caller is allowed to use) SHALL also increment that user/Topic's per-tool subtotal as a subset of the user's total. Attribution SHALL use actual authentication context and SHALL NOT depend on client-declared authors or group counts by credential. Rotating or revoking credentials SHALL NOT reset counts.

#### Scenario: Topic and ordinary calls
- **WHEN** a user invokes `get_topic` twice for Topic 3 and calls `search_papers` once without a Topic
- **THEN** their tool totals SHALL count all three calls and the user/Topic 3 subtotal SHALL count the two `get_topic` calls
