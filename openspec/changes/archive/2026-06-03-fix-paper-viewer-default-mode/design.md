## Context

`PaperViewerPanel` renders whenever `showSplitView` (wide screen, non-embed) is true — it does **not** wait for `store.currentPaper` to load. So on first mount `pdfPath` / `arxivId` are `null`. The viewer modes are data-driven: `pdf` (available iff `pdf_path`), `translation` (available iff `arxiv_id`), and `walkthrough` ("Note", `available: true` **always**, so it renders an empty state for note-less papers / anonymous users).

The previous selection logic was:

```ts
watch(availableModes, (newModes) => {
  if (newModes.length > 0 && !newModes.find(m => m.id === activeId.value)) {
    activeId.value = newModes[0].id
  }
}, { immediate: true })
```

At mount `availableModes === [walkthrough]`, so `activeId` became `'walkthrough'`. When the paper resolved and `availableModes` grew to `[pdf, translation, walkthrough]`, the guard `!newModes.find(... === activeId)` was *false* (walkthrough still present), so it never switched away — the viewer stayed on "Note".

## Goals / Non-Goals

- **Goal**: a freshly opened paper defaults to a primary viewer (PDF, else translation); "Note" is only the default when it is the only mode.
- **Goal**: preserve explicit selections (manual click + `?view=note` / `?note=` / `?pdf=` deep links) against later `availableModes` changes.
- **Non-Goal**: changing cross-paper "sticky tab" behavior or the set of modes; no API/store changes.

## Decisions

- **`pickDefault(list)`** = `list.find(m => m.id !== 'walkthrough') ?? list[0]` — a primary mode wins; "Note" is the fallback only when alone. This is evaluated every time `availableModes` changes (while no explicit choice is pinned), which fixes the late-load case: once PDF/translation appear, the default switches to them.
- **`userChose` flag** distinguishes an automatic default from an explicit choice. Set by `selectMode()` (user tab click, wired via `@update:model-value`) and by the three deep-link watches. While `userChose` is true the auto-default no longer overrides; it only re-picks `newModes[0]` if the chosen mode vanished from `availableModes`.
- **Brief "Note" flash**: during the sub-second load window the panel may momentarily show "Note" (the only mode) before switching to PDF. Accepted as proportionate — the *final* default is correct, and distinguishing "loading" from "genuinely note-only" would require threading a `loaded` flag for marginal benefit.
