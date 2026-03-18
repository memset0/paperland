## Why

The current Vuetify-based frontend looks generic and lacks visual polish. Switching to Tailwind CSS + shadcn-vue will produce a modern, distinctive UI with clean typography, thoughtful spacing, and a professional aesthetic suitable for an academic paper management tool.

Additionally, the paper detail page needs the designed split-view layout: PDF viewer on the left, paper info + Q&A on the right, with a draggable divider.

## What Changes

- Replace Vuetify with Tailwind CSS + shadcn-vue components
- Remove vuetify, vite-plugin-vuetify, @mdi/font dependencies
- Add tailwindcss, @shadcn-vue components, lucide-vue-next (icons), pdfjs-dist (PDF viewer)
- Complete redesign of all pages with high visual quality
- Paper detail page: split-view with embedded PDF viewer (left) and info+Q&A (right), draggable divider
- All other pages: modern card-based layouts with proper spacing, typography, hover states

## Capabilities

### New Capabilities
- `shadcn-tailwind-ui`: Complete frontend redesign using Tailwind CSS + shadcn-vue with production-grade visual quality
- `pdf-split-view`: Paper detail page with embedded PDF viewer in left pane and paper info/Q&A in right pane, with draggable resize

### Modified Capabilities

(none)

## Impact

- **Removed deps**: vuetify, vite-plugin-vuetify, @mdi/font
- **New deps**: tailwindcss, autoprefixer, postcss, shadcn-vue components, lucide-vue-next, pdfjs-dist, class-variance-authority, clsx, tailwind-merge
- **Rewritten**: All .vue files in packages/frontend/src/
- **New files**: tailwind.config.js, postcss.config.js, shadcn component files
- **No backend changes**
