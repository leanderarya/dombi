# Safe Area Cutout — Outlet Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe area inset handling to the outlet role so content is not clipped by notches, Dynamic Island, or gesture bars in PWA standalone mode.

**Architecture:** Centralized approach — handle safe area padding at 3 layout component touch points (PageHeader, MobileRoleLayout, OutletPageShell). All outlet pages automatically get coverage. CSS `env(safe-area-inset-*)` returns `0px` in normal browser mode, so no visual side effects.

**Tech Stack:** React, TypeScript, Tailwind CSS v4

## Global Constraints

- `viewport-fit=cover` is already set in `app.blade.php` — do not modify
- PWA manifest already has `display: "standalone"` — do not modify
- `pwa-standalone` class detection in `app.tsx` stays — only the CSS rule is removed
- Customer/Owner/Courier roles are out of scope — do not modify their layouts
- Fixed bottom elements (StickyActionBar, BottomSheet, etc.) already handle safe area — do not modify

---

### Task 1: Add top safe area to PageHeader

**Files:**
- Modify: `resources/js/components/ui/page-header.tsx:21`

**Interfaces:**
- Produces: PageHeader now adds `pt-[env(safe-area-inset-top)]` to its `<header>` element. All consumers (OutletLayout, any page using PageHeader) automatically get top safe area coverage.

- [ ] **Step 1: Add safe area padding to PageHeader header element**

In `resources/js/components/ui/page-header.tsx`, line 21, add `pt-[env(safe-area-inset-top)]` to the header className:

```tsx
// BEFORE (line 21)
<header className={`sticky top-0 z-30 ${transparent ? '' : 'border-b border-border bg-surface/95 backdrop-blur'}`}>

// AFTER
<header className={`sticky top-0 z-30 pt-[env(safe-area-inset-top)] ${transparent ? '' : 'border-b border-border bg-surface/95 backdrop-blur'}`}>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "page-header"`
Expected: No errors related to page-header.tsx

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/ui/page-header.tsx
git commit -m "feat: add top safe area padding to PageHeader for notch/Dynamic Island support"
```

---

### Task 2: Remove redundant pwa-standalone CSS rule

**Files:**
- Modify: `resources/css/app.css:236-240`

**Interfaces:**
- Consumes: None
- Produces: `.pwa-standalone { padding-top }` rule removed. Top safe area is now handled by PageHeader (Task 1).

- [ ] **Step 1: Remove the pwa-standalone padding-top rule**

In `resources/css/app.css`, remove lines 236-240:

```css
/* REMOVE THIS BLOCK */
/* ─── PWA Standalone Mode ──────────────────────────────── */

.pwa-standalone {
    padding-top: env(safe-area-inset-top);
}
```

Keep the `@utility pb-safe` block that follows it — it's a separate utility.

- [ ] **Step 2: Verify CSS compiles**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds (no CSS errors)

- [ ] **Step 3: Commit**

```bash
git add resources/css/app.css
git commit -m "chore: remove redundant pwa-standalone padding-top rule (handled by PageHeader)"
```

---

### Task 3: Add bottom safe area to MobileRoleLayout

**Files:**
- Modify: `resources/js/components/ui/mobile-role-layout.tsx:15`

**Interfaces:**
- Produces: MobileRoleLayout default padding changes from `pb-8` to `pb-[calc(2rem+env(safe-area-inset-bottom))]`. All pages using MobileRoleLayout (via OutletLayout) automatically get bottom safe area. The `footerSlot` branch is unchanged.

- [ ] **Step 1: Update default bottom padding to include safe area**

In `resources/js/components/ui/mobile-role-layout.tsx`, line 15, change the else branch:

```tsx
// BEFORE (line 15)
: 'pb-8';

// AFTER
: 'pb-[calc(2rem+env(safe-area-inset-bottom))]';
```

The full `bottomPad` assignment becomes:

```tsx
const bottomPad = footerSlot
    ? 'pb-[calc(8rem+env(safe-area-inset-bottom))]'
    : 'pb-[calc(2rem+env(safe-area-inset-bottom))]';
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "mobile-role-layout"`
Expected: No errors related to mobile-role-layout.tsx

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/ui/mobile-role-layout.tsx
git commit -m "feat: add bottom safe area to MobileRoleLayout default padding"
```

---

### Task 4: Add bottom safe area to OutletPageShell

**Files:**
- Modify: `resources/js/components/outlet/outlet-page-shell.tsx:12`

**Interfaces:**
- Produces: OutletPageShell padding changes: `pb-8` → `pb-[calc(2rem+env(safe-area-inset-bottom))]`, `pb-24` → `pb-[calc(6rem+env(safe-area-inset-bottom))]`. All outlet pages using OutletPageShell automatically get bottom safe area.

- [ ] **Step 1: Update both padding variants to include safe area**

In `resources/js/components/outlet/outlet-page-shell.tsx`, line 12, update the className:

```tsx
// BEFORE (line 12)
<div className={`mt-4 ${noGap ? '' : 'space-y-4'} ${hasStickyBar ? 'pb-24' : 'pb-8'}`}>

// AFTER
<div className={`mt-4 ${noGap ? '' : 'space-y-4'} ${hasStickyBar ? 'pb-[calc(6rem+env(safe-area-inset-bottom))]' : 'pb-[calc(2rem+env(safe-area-inset-bottom))]'}`}>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "outlet-page-shell"`
Expected: No errors related to outlet-page-shell.tsx

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/outlet/outlet-page-shell.tsx
git commit -m "feat: add bottom safe area to OutletPageShell padding"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit --pretty 2>&1 | grep "error TS" | wc -l`
Expected: Same error count as before (17 pre-existing errors, 0 new)

- [ ] **Step 2: Run build**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 3: Verify all 4 commits are present**

Run: `git log --oneline -5`
Expected: 4 new commits from Tasks 1-4

- [ ] **Step 4: Final commit with all changes**

No additional commit needed — changes are already committed per-task.
