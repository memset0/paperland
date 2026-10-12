## 1. Backend config schema

- [x] 1.1 In `packages/backend/src/config.ts`, add a `notesImageWidthTiersSchema = z.object({ sm: z.number().int().positive().default(240), md: z.number().int().positive().default(480), lg: z.number().int().positive().default(720) })`.
- [x] 1.2 Add a `notesSchema = z.object({ image_width_tiers: notesImageWidthTiersSchema.default({ sm: 240, md: 480, lg: 720 }) })` and wire it into `configSchema` as `notes: notesSchema.default({ image_width_tiers: { sm: 240, md: 480, lg: 720 } })` — use the explicit-literal default (NOT `.default({})`) so inner defaults hold when the key is absent.

## 2. Backend config endpoint

- [x] 2.1 In `packages/backend/src/api/qa.ts` (next to the existing `GET /api/config/pdf`), add `GET /api/config/notes` returning `{ image_width_tiers: { sm, md, lg } }` from the loaded config.
- [x] 2.2 Decide auth: keep it behind `requireUser` like `/api/config/pdf` (anonymous/public-note views rely on the CSS fallbacks, not this endpoint).

## 3. Frontend: config fetch + CSS variables

- [x] 3.1 In `packages/frontend/src/api/client.ts`, extend `configApi` with `notes: () => api.get<{ image_width_tiers: { sm: number; md: number; lg: number } }>('/api/config/notes')`.
- [x] 3.2 On app bootstrap for authenticated users (e.g. in `App.vue` setup or a small composable), fetch the tiers and set CSS custom properties on `document.documentElement`: `--note-img-w-sm/md/lg` (in px). Swallow errors so a failed fetch leaves the CSS fallbacks in place.

## 4. Frontend: directive parsing + rendering in MarkdownContent

- [x] 4.1 Add a helper (in `MarkdownContent.vue` or a small util) `parseImageWidthDirective(alt: string): { tier?: 'sm'|'md'|'lg'; px?: number; cleanedAlt: string }` that extracts the first `w=(sm|md|lg|\d+)` token (case-insensitive, word-boundary delimited), clamps numeric to `[16, 4096]`, ignores zero/negative/unknown, and returns the alt with the token stripped.
- [x] 4.2 In `renderAndHighlight()` (after `el.innerHTML = md.render(...)`), walk `el.querySelectorAll('img')`: for each, parse its `alt`, set the cleaned alt back, and — when the directive is enabled (see 5.1) — apply the cap: tier → add class `md-img-w-{tier}`, numeric px → set inline `style.maxWidth = 'min(' + px + 'px, 100%)'`.
- [x] 4.3 Add scoped CSS classes using the configured custom properties with designed defaults as fallbacks: `.markdown-content :deep(img.md-img-w-sm){max-width:min(var(--note-img-w-sm,240px),100%)}` and `md`/`lg` likewise (480px / 720px fallbacks). Keep `height:auto`.
- [x] 4.4 Confirm the directive works for anchor-wrapped images (`[![w=lg](url)](paperland://…)`) — the `<img>` still carries the alt, so the same walk applies; verify the surrounding `<a>` is untouched.

## 5. Frontend: disable directive in mindmap

- [x] 5.1 Add a prop to `MarkdownContent.vue` (e.g. `applyImageWidth?: boolean`, default `true`) that gates whether the `max-width` cap is applied in step 4.2. The alt-token stripping happens regardless (so `w=…` never shows as text).
- [x] 5.2 In `packages/frontend/src/components/notes/NoteNode.vue` (line ~194), pass `:apply-image-width="false"` to the content-node `MarkdownContent`, so mindmap image sizing stays governed by the existing 260px node layout.

## 6. Config files + docs

- [x] 6.1 Add a `notes.image_width_tiers` block (sm: 240, md: 480, lg: 720, with comments) to `config.yml` and `config.example.yml`, keeping the config shape consistent.
- [x] 6.2 Document the alt-text width directive convention (`w=sm|md|lg|<px>`), the tiers, and the "direct rendering only, not mindmap" behavior in `docs/frontend-architecture.md` (note/markdown rendering section); mention the config block in `docs/tech-stack.md` if it lists config keys.

## 7. Verification

- [x] 7.1 Manually verify in a note: `![w=sm]`, `![w=md]`, `![w=lg]`, `![w=100]`, `![figure 1 w=md]` (alt cleaned), `![w=huge]`/`![w=0]` (no cap), and a directive-less image (unchanged). Confirm none overflow a narrow column.
- [x] 7.2 Verify the same `w=sm` image in the mindmap is NOT shrunk to the tier (sized by node layout) and shows no `w=sm` text.
- [x] 7.3 Verify a public/anonymous note view still caps correctly via CSS fallbacks (no config fetch).
- [x] 7.4 Run backend config tests if a config schema test exists (`bun run --filter '@paperland/backend' test` scoped to config) to confirm defaults/validation; do not run the full external-API-hitting suite.
