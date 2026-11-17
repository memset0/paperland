# Design

- **Counts.** `summary()` parses `topics.snapshot`, which is already loaded with the row:
  - `page_count` = `Object.keys(snapshot.pages ?? {}).length`, or 1 when only a legacy `report` exists;
  - `reference_count` = `snapshot.list.papers.length`.
  Parsing failures give 0. No new queries.
- **Card.** Built from shadcn `Card`, `Badge` and `Separator`. Lucide `FileText` and `Quote` icons sit next to the counts.
  - **Monogram:** first letters of the first two words. Background is `oklch(0.92 0.06 h)` in light mode and `oklch(0.32 0.06 h)` in dark mode, with `h = (id * 47) % 360`, set through CSS variables so both themes work.
  - **Owner:** a 20px round initial avatar.
  - **Layout:** fixed min-height for the description (2 lines), and the footer pinned to the bottom with `mt-auto`.
  - **Hover:** translate-y of -1px, a stronger ring and a shadow.
  - **Archived:** `opacity-80` and an outline badge.
- **Verification.** Screenshots of `/topics` at 1440 and 390 px, light and dark.
