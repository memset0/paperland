## Context

Current frontend uses custom CSS. All 5 view components and App.vue need to be rewritten with Vuetify components.

## Goals / Non-Goals

**Goals:**
- Vuetify 3 setup with Material Design Icons
- All existing pages rewritten with Vuetify components
- Consistent Material Design look and feel

**Non-Goals:**
- Custom theme (use Vuetify defaults for now)
- New pages or features (just migrate existing UI)

## Decisions

### 1. Vuetify 3 with Vite plugin
Use `vuetify` with `vite-plugin-vuetify` for tree-shaking and automatic component imports.

### 2. MDI icons
Use `@mdi/font` for Material Design Icons, loaded globally.

### 3. Remove all custom CSS
Replace all scoped styles with Vuetify utility classes and components. Remove the custom styles from App.vue.
