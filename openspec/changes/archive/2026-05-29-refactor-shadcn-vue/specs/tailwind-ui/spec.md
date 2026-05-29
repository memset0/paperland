## MODIFIED Requirements

### Requirement: Tailwind CSS integration
The frontend SHALL use Tailwind CSS v4 for all styling, integrated via the `@tailwindcss/vite` plugin. Theme tokens (colors, radius, fonts) SHALL be defined as CSS variables in `src/assets/main.css` via an `@theme inline { ... }` block, sourced from `:root` / `.dark` OKLCH variables. The `--font-sans` SHALL be `Noto Sans Variable` and `--font-mono` SHALL be `Noto Sans Mono Variable` (its paired monospace family), both loaded via `@fontsource-variable`.

#### Scenario: Tailwind loaded
- **WHEN** the frontend starts
- **THEN** Tailwind v4 utility classes SHALL be available and applied
- **AND** color utilities such as `bg-primary`, `text-foreground`, `border-border` SHALL resolve to the OKLCH variables defined in `:root`

#### Scenario: No legacy v3 config
- **WHEN** the project is built
- **THEN** there SHALL be no `tailwind.config.js`, no `postcss.config.js`, no `autoprefixer` / `postcss` packages, and `main.css` SHALL use `@import "tailwindcss"` instead of `@tailwind base/components/utilities`

## ADDED Requirements

### Requirement: shadcn-vue as component primitive library
The frontend SHALL use shadcn-vue (backed by reka-ui) as the source of UI primitives—buttons, inputs, dialogs, selects, tabs, badges, tooltips, dropdown menus, tables, textareas, alerts, separators, scroll areas, sheets, command, sonner (toast), and collapsibles. Primitive components SHALL live in `packages/frontend/src/components/ui/` and SHALL be installed via `bunx shadcn-vue@latest add <component>`.

#### Scenario: Buttons use shadcn-vue Button
- **WHEN** any page renders an interactive button
- **THEN** the implementation SHALL import `Button` from `@/components/ui/button` (or its parent index) instead of using a raw `<button>` styled with inline Tailwind utilities

#### Scenario: Form inputs use shadcn-vue primitives
- **WHEN** any page renders a text input, textarea, or select
- **THEN** the implementation SHALL use `Input`, `Textarea`, or `Select` from `@/components/ui/*`

#### Scenario: Modal dialogs use shadcn-vue Dialog or Sheet
- **WHEN** any page opens a modal or drawer-like surface
- **THEN** the implementation SHALL use `Dialog` (modal) or `Sheet` (drawer) from `@/components/ui/*` instead of hand-written fixed-position overlays

#### Scenario: Disclosure / collapsible regions use shadcn-vue Collapsible
- **WHEN** any page renders an expandable / collapsible content row (e.g., Q&A entry expand, FAQ accordion)
- **THEN** the implementation SHALL use `Collapsible` + `CollapsibleTrigger` + `CollapsibleContent` from `@/components/ui/collapsible` instead of native HTML `<details>/<summary>`
- **AND** open state SHALL be managed via reactive state (`openMap` keyed by entry id), not via DOM queries
- **AND** `CollapsibleContent` SHALL apply `overflow-hidden` + `data-[state=open]:animate-collapsible-down` / `data-[state=closed]:animate-collapsible-up` so expand / collapse is animated via the `--animate-collapsible-*` tokens registered by `tw-animate-css`

#### Scenario: Cross-component scroll-to-and-open uses CollapsibleTrigger
- **WHEN** an external nav widget (e.g., `QAPanelNav`) needs to scroll to and open a specific collapsible entry
- **THEN** the `CollapsibleTrigger` SHALL carry a stable `data-qa-entry` (or analogous) attribute, and the nav SHALL find the trigger by selector, check `data-state="closed"`, and call `trigger.click()` to open—delegating state persistence to the Collapsible's own `@update:open` handler

#### Scenario: Toast notifications use shadcn-vue Sonner
- **WHEN** the app needs to show a transient notification (API error, copy confirmation, etc.)
- **THEN** the implementation SHALL call `toast.success` / `toast.error` from `vue-sonner`, and a single `<Toaster>` SHALL be mounted at the app root in `App.vue`
- **AND** per-toast position SHALL be passed via the second argument (e.g., LaTeX copy uses `{ position: 'bottom-center' }`) when context-specific placement is required

### Requirement: Idea-forge category mapping centralized
The shared idea-category constants (`IDEA_CATEGORIES`, `IDEA_CATEGORY_LABELS`, `IDEA_CATEGORY_VARIANT`) SHALL be defined once in `src/lib/idea-categories.ts` and imported by all idea-forge components, rather than duplicated per-file.

#### Scenario: Single source of truth for category mapping
- **WHEN** any idea-forge component (e.g., `InboxView`, `ListView`, `KanbanView`, `IdeaDetail`, `IdeaManager`) renders or iterates the four idea categories
- **THEN** it SHALL import from `@/lib/idea-categories` and not redefine the constants locally

### Requirement: Lucide icons sourced from `@lucide/vue`
The frontend SHALL import Lucide icons from `@lucide/vue` (the package referenced by the shadcn-vue preset). The legacy `lucide-vue-next` dependency SHALL be removed after the migration.

#### Scenario: Icon import
- **WHEN** a component needs a Lucide icon
- **THEN** it SHALL import from `@lucide/vue` (e.g., `import { ArrowLeft } from '@lucide/vue'`)

#### Scenario: No leftover legacy icon imports
- **WHEN** the refactor is complete
- **THEN** there SHALL be no `lucide-vue-next` import in `packages/frontend/src/` and the dependency SHALL be removed from `package.json`

### Requirement: Component-level styling responsibility
The Tailwind utility classes that appear in individual `.vue` files SHALL primarily express **layout** (grid, flex, spacing, sizing, responsive breakpoints) and SHALL NOT re-implement visuals (colors, hover/focus states, borders, rounded corners) that the shadcn-vue primitive already provides.

#### Scenario: No button look-alike utilities
- **WHEN** a `.vue` file renders a button
- **THEN** it SHALL NOT contain utility class strings like `rounded-md p-1 text-gray-400 hover:bg-gray-100`—it SHALL use `<Button variant="ghost" size="icon">` (or similar) and pass only layout-related extra classes

#### Scenario: Theme color references use semantic tokens
- **WHEN** a `.vue` file needs a theme color
- **THEN** it SHALL use semantic utility classes (`bg-primary`, `text-muted-foreground`, `border-border`, etc.) sourced from the OKLCH theme, NOT raw scales such as `bg-blue-500` for primary brand colors
