## Context

Current App.vue has a fixed sidebar. Need to make it responsive.

## Goals / Non-Goals

**Goals:** Sidebar on desktop, top navbar + drawer on mobile
**Non-Goals:** Bottom tab bar, gestures

## Decisions

### 1. CSS breakpoint at 768px
Use `window.innerWidth` reactive check + resize listener. Below 768px = mobile mode.

### 2. Drawer as overlay
Mobile drawer slides in from left with a semi-transparent backdrop. Uses CSS transform for smooth animation. Same nav items as sidebar.

### 3. Top navbar in mobile mode
Simple bar with hamburger icon (Menu) on the left, app title centered. Fixed at top.
