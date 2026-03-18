## Context

Current frontend uses Vuetify 3 with Material Design. The result is functional but visually generic. The design docs specify a split-view paper detail page with PDF on left and info/QA on right with draggable divider.

## Goals / Non-Goals

**Goals:**
- Replace Vuetify with Tailwind CSS + hand-crafted shadcn-vue-style components
- Modern, clean aesthetic: neutral grays, subtle borders, generous whitespace, smooth transitions
- Paper detail: split-view with pdfjs-dist PDF viewer, draggable resizer
- All pages: polished cards, tables, dialogs, form inputs
- Lucide icons throughout (replacing MDI)

**Non-Goals:**
- Dark mode (can add later)
- Mobile responsive (desktop-first for now)

## Decisions

### 1. Tailwind CSS + custom components over shadcn-vue CLI
Write shadcn-style components directly rather than using the shadcn-vue CLI scaffolding. This gives full control over every pixel without the overhead of the shadcn init process. Use the same design tokens (border-radius, colors, spacing) as shadcn/ui.

### 2. pdfjs-dist for PDF rendering
Use Mozilla's pdfjs-dist to render PDFs in a canvas/container. The PDF viewer will be a dedicated component that loads from the backend's stored PDF path.

### 3. CSS-based draggable split view
Implement the split-view divider with a simple mousedown/mousemove handler that adjusts CSS flex-basis. No heavy library needed.

### 4. Sidebar navigation instead of top bar
Switch from top app-bar to a collapsible left sidebar for navigation. This is more space-efficient and modern for a dashboard-style app.

## Risks / Trade-offs

- **[Risk] pdfjs-dist bundle size** → Use dynamic import to load only when PDF viewer is rendered
- **[Trade-off] No component library** → More code to write, but full design control
