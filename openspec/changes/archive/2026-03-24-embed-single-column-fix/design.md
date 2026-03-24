## Context

PaperDetail.vue uses a responsive breakpoint (`isWide = window.innerWidth >= 900`) to switch between dual-column split view (PDF left, info right) and single-column layout. In embed mode, the page is rendered inside a narrow sidebar (e.g., Zotero), but if the container happens to be wide enough (>=900px), the split view activates — which is never desirable in embed mode.

## Goals / Non-Goals

**Goals:**
- Ensure embed mode always renders single-column layout in PaperDetail, regardless of viewport width.

**Non-Goals:**
- Changing the 900px breakpoint for normal mode.
- Modifying any other embed mode behavior (padding, header, background).

## Decisions

**Override `isWide` when in embed mode**: Compute an effective layout flag like `const showSplitView = computed(() => isWide.value && !isEmbed.value)` and use it in the template instead of raw `isWide`. This keeps the responsive logic intact for normal mode while cleanly disabling split view in embed mode.

Alternative considered: Setting `isWide` to false directly in embed mode — rejected because it conflates two concerns (viewport size vs. embed policy).

## Risks / Trade-offs

- [Minimal risk] This is a one-line computed property change with clear, isolated impact.
