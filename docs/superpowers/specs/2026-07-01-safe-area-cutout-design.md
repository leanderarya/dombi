# Safe Area Cutout — Outlet Role

**Date:** 2026-07-01
**Scope:** Outlet role PWA (iOS) + future Capacitor (Android)
**Status:** Approved

## Problem

On devices with notches, Dynamic Island, or camera cutouts, PWA standalone mode removes browser chrome. The app's content extends into unsafe areas:

- **Top:** `PageHeader` uses `sticky top-0` with no safe area padding. On iPhones with Dynamic Island (14 Pro+), the header title and menu button are clipped or too close to the status bar.
- **Bottom:** `MobileRoleLayout` defaults to `pb-8` with no safe area inset. On iPhones with gesture bar (no home button), the last content items and bottom action buttons are hidden behind the home indicator.

## Current State

| Aspect | Status |
|---|---|
| `viewport-fit=cover` | Already set in `app.blade.php` |
| PWA `display: standalone` | Set in `manifest.json` |
| PWA mode detection | `app.tsx` adds `pwa-standalone` class to `<html>` |
| Bottom safe area | Inconsistent — ~20 files use `env(safe-area-inset-bottom)` with different patterns |
| Top safe area | Only `.pwa-standalone { padding-top }` on `<html>`, not on PageHeader |
| `pb-safe` utility | Defined in CSS, never used |

## Approach: Centralized in Layout Components

Handle safe area at 3 central points. All outlet pages automatically get coverage.

`env(safe-area-inset-*)` returns `0px` in normal browser mode — no side effects.

### 1. Top Safe Area — PageHeader

**File:** `resources/js/components/ui/page-header.tsx`

Add `pt-[env(safe-area-inset-top)]` to the `<header>` element:

```tsx
<header className={`sticky top-0 z-30 pt-[env(safe-area-inset-top)] ${transparent ? '' : 'border-b border-border bg-surface/95 backdrop-blur'}`}>
```

**Why on `<header>`, not `<main>`:**
- Header background extends edge-to-edge behind the status bar (looks native)
- Header content (title, buttons) is pushed below the safe zone
- `env(safe-area-inset-top)` = `0px` in browser → no visual change

**Cleanup:** Remove `.pwa-standalone { padding-top: env(safe-area-inset-top); }` from `resources/css/app.css`. The `pwa-standalone` class itself stays in `app.tsx` (useful for future CSS).

### 2. Bottom Safe Area — MobileRoleLayout

**File:** `resources/js/components/ui/mobile-role-layout.tsx`

Update default padding:

| Scenario | BEFORE | AFTER |
|---|---|---|
| No footerSlot | `pb-8` | `pb-[calc(2rem+env(safe-area-inset-bottom))]` |
| With footerSlot | `pb-[calc(8rem+env(...))]` | No change (already correct) |

### 3. Bottom Safe Area — OutletPageShell

**File:** `resources/js/components/outlet/outlet-page-shell.tsx`

Update both padding variants:

| Scenario | BEFORE | AFTER |
|---|---|---|
| `hasStickyBar=false` | `pb-8` | `pb-[calc(2rem+env(safe-area-inset-bottom))]` |
| `hasStickyBar=true` | `pb-24` | `pb-[calc(6rem+env(safe-area-inset-bottom))]` |

### 4. Fixed Bottom Elements — No Changes Needed

These already handle safe area correctly:

| Component | Current pattern |
|---|---|
| `StickyActionBar` | `pb-[calc(0.5rem+env(safe-area-inset-bottom))]` |
| `BottomSheet` | `pb-[env(safe-area-inset-bottom)]` |
| `NotificationSheet` | `pb-[env(safe-area-inset-bottom)]` |
| `returns/create.tsx` sticky bar | `bottom-[calc(3.5rem+env(safe-area-inset-bottom))]` |
| `exchanges/create.tsx` sticky bar | `bottom-[calc(3.5rem+env(safe-area-inset-bottom))]` |

## Files Modified

| File | Change |
|---|---|
| `resources/js/components/ui/page-header.tsx` | Add `pt-[env(safe-area-inset-top)]` to header |
| `resources/js/components/ui/mobile-role-layout.tsx` | Update default `pb-8` → include safe area |
| `resources/js/components/outlet/outlet-page-shell.tsx` | Update both `pb` variants to include safe area |
| `resources/css/app.css` | Remove `.pwa-standalone { padding-top }` rule |

## Edge Cases

- **Normal browser:** `env(safe-area-inset-*)` returns `0px`. Padding stays at `2rem`/`6rem` — identical to current behavior.
- **Landscape orientation:** Safe area insets switch sides (left/right instead of top/bottom). `env()` handles this automatically.
- **Android devices with camera cutouts:** `env(safe-area-inset-top)` returns the cutout height. Works natively.
- **Future Capacitor:** `env(safe-area-inset-*)` works in Capacitor WebView. No changes needed when Capacitor is added.
- **Customer/Owner/Courier roles:** Out of scope. Each has their own layout that handles safe areas independently.

## What This Does NOT Cover

- Left/right safe areas (relevant only in landscape — not a primary use case for outlet role)
- Customer role safe area handling (already handled in `customer-mobile-layout.tsx`)
- Dynamic safe area detection via JavaScript (unnecessary — CSS `env()` is sufficient)
