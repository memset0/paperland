# Proposal

## Why

The Topics list (`/topics`) and the Topic page (`/topics/:id`) look rough. Problems seen in screenshots:
- **List page:**
  - each card repeats a telescope icon, an "Owner" chip and an arrow, so they dominate it;
  - there is no skeleton while loading.
- **Topic page:**
  - six outline buttons sit in a row above the title, and on mobile they wrap into a cluster;
  - meta information is scattered over four lines (Topic · owner, chip, Original research, commit / references / Browse linked papers);
  - the report sits in a floating card offset from the page tree;
  - the drawers use native `<select>` elements.

The code has the same problem. `TopicDetail.vue` is a 435-line file of dense one-line templates mixing data loading, reading-cache animation, sharing, history and Git connection. The developer wants a cleaner design built from shadcn-vue's own components and patterns, and a simpler frontend structure.

## What Changes

- **Topics list:**
  - shadcn `Tabs` for "Active" and "Archived (N)", replacing the collapsible section (archived Topics stay separate);
  - a toolbar with the Mine/All toggle and search;
  - shadcn `Card` tiles (title, two-line description, owner, last update, and a role badge only when it is not Owner);
  - `Skeleton` loading and shadcn-style empty states.
- **Topic page header:**
  - a breadcrumb (Topics › title);
  - one row with the title and actions: History and Share as buttons, and a `DropdownMenu` (…) holding All references, Browse linked papers, Refresh, Rename, Original research and Archive/Unarchive;
  - a single muted meta line (owner · role · updated · N references · commit);
  - archived and historical-version notices as shadcn `Alert`s.
  - Rename moves into a `Dialog`.
  - The Connect button and drawer are removed by `unify-mcp-app-auth`; this change assumes they are gone.
- **Topic page body:**
  - a documentation layout with the page tree as a sticky left sidebar (no card) and the document in the content column without a floating card;
  - the 680px reading width, citation cards, folded page references, the mobile Pages sheet and reading-cache animations keep their current behavior.
- **Drawers:**
  - Share uses shadcn `Select` and a member list with `Separator`;
  - History shows each version as a compact entry (message, time, "Pushed by X via App", Git author on hover);
  - All references keeps its right `Sheet`.
- **Small shared fixes found during the redesign:**
  - Markdown table borders and header backgrounds use theme tokens (`--border`, `--muted`) instead of hard-coded light colors. Table headers were unreadable white in dark mode on every Markdown surface.
  - `TopicAccessSelect` (also used by the New topic dialog) switches from native selects to shadcn `Select`.
  - Choosing the newest entry in History returns to the latest version.
  - An empty report tells editors to connect an app on the Plugins page.
- **Code structure:**
  - split `TopicDetail.vue` into a thin view and focused pieces: `useTopicDetail` (loading, polling, scope guard), `useTopicReading` (reading-surface baselines and animations), `TopicHeader`, `TopicShareSheet`, `TopicHistorySheet`, `TopicReferencesSheet`, `TopicRenameDialog`;
  - `TopicCard` for the list;
  - add the shadcn-vue `Breadcrumb` component if missing.
  - Behavior stays the same apart from the visual changes above.

## Capabilities

### New Capabilities

### Modified Capabilities
- `topics`: the Topics list groups archived Topics with tabs; Topic page header actions and the rename entry point change.

## Impact

- Frontend only: `views/TopicsList.vue`, `views/TopicDetail.vue`, `components/MarkdownContent.vue` (table colors), new `lib/relative-time.ts`, new `components/topics/*`, `composables/useTopicDetail.ts` and `useTopicReading.ts`, `components/ui/breadcrumb`. No backend or API change.
- Depends on `unify-mcp-app-auth` for the Connect removal and the `pushed_via` history field (shown when present).
- Docs: `docs/frontend-architecture.md` (Topics section).
