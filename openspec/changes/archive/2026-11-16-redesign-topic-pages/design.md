# Design

## Decisions

- **shadcn first.** Use the existing `components/ui` primitives: Card, Tabs, Badge, Button, DropdownMenu, Dialog, Sheet, Select, Alert, Separator, Skeleton, Tooltip and Collapsible. Add `Breadcrumb` from shadcn-vue (reka-mira style, matching `components.json`). Prefer component variants over custom classes. Keep custom CSS only for citation chips.
- **List.** `TopicsList.vue` keeps loading, create and seed logic and renders a toolbar, `Tabs` (`active` / `archived`, the tab remembered only in component state) and a grid of `TopicCard` (`components/topics/TopicCard.vue`, a RouterLink wrapping `Card`). Relative time uses `Intl.RelativeTimeFormat`, with the full date in a title tooltip.
- **Detail layout.** Full-height page with no muted background. The header sits in a top container of `max-w-[1200px]`. The body is a grid: `lg:grid-cols-[260px_minmax(0,680px)]`, centered. The sidebar is sticky and borderless with a small "Pages" label. The document has no card, and a `Separator` comes before the folded page references. Mobile keeps the Pages sheet, triggered by a ghost button in the header row.
- **Split.**
  - `composables/useTopicDetail.ts`: id/version/file routing state, `load`, polling, scope/gate guard, history, sharing and import actions. It returns refs and functions.
  - `composables/useTopicReading.ts`: `displayReading` and reading-surface animations, `decorateCitations`, `locateReference`.
  - `components/topics/`: `TopicHeader`, `TopicShareSheet`, `TopicHistorySheet`, `TopicReferencesSheet`, `TopicRenameDialog` and `TopicCard`. The existing `TopicFileNav`, `TopicReferenceList` and `TopicCitationCard` move into `components/topics/` unchanged.
  - The view wires them together and stays under about 150 lines.
- **No behavior change** in reading caches, citations, routes, polling or permissions. Existing unit tests (`topic-navigation`, `topic-reading`) must keep passing. Visual checks use screenshots at 1440 and 390 widths in light and dark themes.
