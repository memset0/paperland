## Why

The frontend currently uses plain CSS styling. Adopting Vuetify (Material Design component library for Vue 3) provides a consistent, professional UI with rich pre-built components (data tables, dialogs, navigation, forms) that will accelerate development of remaining features (paper detail page, Q&A module, service dashboard).

## What Changes

- Install Vuetify 3 and @mdi/font (Material Design Icons)
- Configure Vuetify plugin in frontend main.ts
- Rewrite App.vue navigation using Vuetify's v-app-bar, v-navigation-drawer
- Rewrite PaperList.vue using v-data-table, v-dialog, v-text-field, v-btn
- Rewrite PaperDetail.vue using v-card, v-chip, v-tabs
- Rewrite Settings.vue using v-data-table, v-btn, v-alert
- Update placeholder pages (QA, ServiceDashboard) with basic Vuetify layout

## Capabilities

### New Capabilities
- `vuetify-ui`: Vuetify 3 Material Design component framework integrated into Vue 3 frontend

### Modified Capabilities

(none)

## Impact

- **New dependencies**: vuetify, @mdi/font
- **Modified files**: All Vue components in packages/frontend/src/
- **No backend changes**
