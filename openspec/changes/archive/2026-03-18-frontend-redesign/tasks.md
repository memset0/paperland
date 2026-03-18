## 1. Setup Tailwind + Remove Vuetify

- [x] 1.1 Remove vuetify, vite-plugin-vuetify, @mdi/font from package.json
- [x] 1.2 Install tailwindcss, postcss, autoprefixer, lucide-vue-next, clsx, tailwind-merge
- [x] 1.3 Create tailwind.config.js and postcss.config.js
- [x] 1.4 Create src/assets/main.css with Tailwind directives and base styles
- [x] 1.5 Update main.ts — remove Vuetify plugin, import main.css
- [x] 1.6 Update vite.config.ts — remove vite-plugin-vuetify
- [x] 1.7 Remove src/plugins/vuetify.ts

## 2. Utility and Base Components

- [x] 2.1 Create src/lib/utils.ts — cn() helper for Tailwind class merging
- [x] 2.2 Create base UI components: inline Tailwind classes (shadcn-style, no separate component files needed)

## 3. App Shell

- [x] 3.1 Rewrite App.vue — collapsible sidebar navigation with Lucide icons, main content area

## 4. Pages

- [x] 4.1 Rewrite PaperList.vue — styled table, search bar, add paper dialog with segmented tabs
- [x] 4.2 Rewrite PaperDetail.vue — responsive split-view with native PDF iframe (left) and info+QA (right), draggable divider, narrow screen fallback with arxiv PDF link
- [x] 4.3 Create PdfViewer.vue component — native iframe PDF viewer (replaced pdfjs-dist with browser native)
- [x] 4.4 Rewrite TemplateQA.vue and FreeQA.vue with Tailwind styling
- [x] 4.5 Rewrite QAPage.vue — paper selector + Q&A components
- [x] 4.6 Rewrite ServiceDashboard.vue — service status cards + filterable execution history table
- [x] 4.7 Rewrite Settings.vue — token management with copy-to-clipboard

## 5. Verification

- [x] 5.1 Verify frontend starts, all pages render, API calls work through proxy
