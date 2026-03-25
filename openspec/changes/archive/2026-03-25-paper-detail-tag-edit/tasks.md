## 1. PaperDetail Tag Edit

- [x] 1.1 Add tag editing state (`editingTags` ref, `isEditingTags` ref) and `saveTags()`/`cancelEditTags()`/`startEditTags()` functions to PaperDetail.vue script
- [x] 1.2 Update both tag display sections (split view + single column) to show edit button, and render TagSelector in edit mode with save/cancel buttons
- [x] 1.3 Show "+ 添加标签" button when paper has no tags
- [x] 1.4 After save, refresh paper detail (`store.fetchPaper`) and tag cache (`tagsStore.refreshCache`)

## 2. Documentation

- [x] 2.1 Update `docs/frontend-architecture.md` paper detail section to document tag editing capability
