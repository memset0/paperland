## 1. Setup Tailwind + Remove Vuetify

- [ ] 1.1 Remove vuetify, vite-plugin-vuetify, @mdi/font from package.json
- [ ] 1.2 Install tailwindcss, postcss, autoprefixer, lucide-vue-next, pdfjs-dist, clsx, tailwind-merge
- [ ] 1.3 Create tailwind.config.js and postcss.config.js
- [ ] 1.4 Create src/assets/main.css with Tailwind directives and base styles
- [ ] 1.5 Update main.ts — remove Vuetify plugin, import main.css
- [ ] 1.6 Update vite.config.ts — remove vite-plugin-vuetify
- [ ] 1.7 Remove src/plugins/vuetify.ts

## 2. Utility and Base Components

- [ ] 2.1 Create src/lib/utils.ts — cn() helper for Tailwind class merging
- [ ] 2.2 Create base UI components: Button, Badge, Card, Dialog, Input, Table, Tabs

## 3. App Shell

- [ ] 3.1 Rewrite App.vue — sidebar navigation with icons, main content area

## 4. Pages

- [ ] 4.1 Rewrite PaperList.vue — styled table, search bar, add paper dialog with tabs
- [ ] 4.2 Rewrite PaperDetail.vue — split-view with PDF viewer (left) and info+QA (right), draggable divider
- [ ] 4.3 Create PdfViewer.vue component — render PDF using pdfjs-dist
- [ ] 4.4 Rewrite TemplateQA.vue and FreeQA.vue with Tailwind styling
- [ ] 4.5 Rewrite QAPage.vue — paper selector + Q&A components
- [ ] 4.6 Rewrite ServiceDashboard.vue — service cards + execution history table
- [ ] 4.7 Rewrite Settings.vue — token management table

## 5. Verification

- [ ] 5.1 Verify frontend starts, all pages render, API calls work through proxy
