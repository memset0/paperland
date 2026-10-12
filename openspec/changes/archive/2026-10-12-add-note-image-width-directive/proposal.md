## Why

Note images currently render at a single fixed size (`max-width: 100%`, i.e. they fill the available column width). There is no way for the note author to say "this screenshot should be small" or "cap this figure at 480px". Large PDF-region screenshots and figures dominate the note, and small crops (an equation, an icon) are blown up to full width. Authors need a lightweight, in-markdown way to control how big an individual image renders — without leaving plain markdown, and without a new editor UI.

## What Changes

- Add an **image width directive** convention encoded in the markdown image **alt text**: `w=sm` / `w=md` / `w=lg` select one of three preset `max-width` tiers, and `w=<number>` (e.g. `w=100`) sets an explicit `max-width` in pixels.
- Default behavior is unchanged: an image with no directive keeps `width: 100%` of its column. The directive is an **additional cap** (`max-width`) layered on top — an image never exceeds its container width, even when the tier/number is larger than the column.
- Designed tier values (see design.md for rationale; values live in `config.yml`, tunable):
  - `w=sm` → **240px**
  - `w=md` → **480px**
  - `w=lg` → **720px**
- The directive token is parsed out of the alt text during rendering so it does not appear as visible alt/caption text.
- The directive affects **direct note rendering only** (`MarkdownContent` in note views, paper notes card, public notes, walkthrough). It explicitly does **not** affect image size inside the **mindmap** (`NoteNode` content nodes), which keeps its own layout-driven sizing. (Mindmap-aware sizing is a possible future follow-up, out of scope here.)
- Expose the three tier values via `config.yml` (new `notes.image_width_tiers` block) and apply them as CSS custom properties, consistent with how `screenshot_dpi` is already configured and fetched by the frontend.

## Capabilities

### New Capabilities
- `note-image-width-directive`: parsing and rendering of `w=sm|md|lg|<px>` directives embedded in markdown image alt text, applied as a `max-width` cap during direct note rendering and skipped in mindmap rendering.

### Modified Capabilities
- `config-loading`: add a `notes.image_width_tiers` configuration block (sm/md/lg pixel values) to the validated config schema, with defaults, so the width tiers are tunable.

## Impact

- **Frontend**
  - `packages/frontend/src/components/MarkdownContent.vue` — parse the alt-text directive in the post-render DOM walk (where highlights are already applied) and apply a `max-width` class/inline style; add a prop to disable the directive in mindmap context.
  - `packages/frontend/src/components/notes/NoteNode.vue` — pass the "disable image width directive" prop so mindmap content nodes are unaffected.
  - `packages/frontend/src/api/client.ts` — extend the config API to fetch the notes image-width tiers (alongside the existing `configApi.pdf()`).
  - App bootstrap — set `--note-img-w-sm/md/lg` CSS custom properties from the fetched config (CSS fallbacks equal to the designed defaults so rendering is correct before/without the fetch).
- **Backend**
  - `packages/backend/src/config.ts` — add the `notes.image_width_tiers` Zod schema with explicit defaults.
  - Config endpoint — expose the tier values to the frontend.
- **Config / Docs**
  - `config.yml` / `config.example.yml` — add `notes.image_width_tiers`.
  - `docs/frontend-architecture.md` (note rendering / markdown) and `docs/tech-stack.md` if relevant — document the alt-text directive convention and tiers.
- **No breaking changes**, no DB/schema migration. Existing notes render identically; the feature is opt-in per image.
