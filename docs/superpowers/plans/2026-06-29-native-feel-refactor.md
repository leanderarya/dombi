# Native Feel Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Dombi page feel native across all roles — mobile experience for Customer/Outlet/Courier, desktop experience for Owner.

**Architecture:** CSS-only native feel enhancements (touch, transitions, scroll) applied globally via `app.css`, role-specific UI improvements in layout components, and per-page polish using `/gpt-taste` + `/steve-jobs-design-review`.

**Tech Stack:** Tailwind CSS v4, Inertia.js, React, TypeScript

## Global Constraints

- All touch targets minimum 44px on mobile
- Input font-size minimum 16px (prevent iOS zoom)
- No `oklch()` in animations (browser support)
- `scroll-behavior: smooth` already applied (quick wins done)
- Inertia progress bar already configured (emerald-700)

---

### Task 1: Touch & Haptics (CSS + Hook)

**Files:**
- Modify: `resources/css/app.css`
- Create: `resources/js/hooks/use-haptic.ts`

**Interfaces:**
- Produces: `useHaptic()` hook with `tap()`, `success()`, `error()` methods

- [ ] **Step 1: Add touch-action and active states to CSS**

Add to `resources/css/app.css` after the existing quick wins section:

```css
/* ─── Touch & Haptics ──────────────────────────────────── */

/* Eliminate 300ms tap delay */
html {
    touch-action: manipulation;
}

/* Active state feedback — all interactive elements */
button:active,
a:active,
[role="button"]:active {
    transform: scale(0.97);
    opacity: 0.85;
    transition: transform 50ms ease-out;
}

/* Remove active state transform on disabled */
button:disabled:active,
a:disabled:active {
    transform: none;
    opacity: 0.5;
}
```

- [ ] **Step 2: Create haptic feedback hook**

Create `resources/js/hooks/use-haptic.ts`:

```ts
export function useHaptic() {
    const vibrate = (pattern: number | number[]) => {
        if ('vibrate' in navigator) {
            navigator.vibrate(pattern);
        }
    };

    return {
        tap: () => vibrate(10),
        success: () => vibrate([10, 50, 10]),
        error: () => vibrate([50, 100, 50]),
    };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep "use-haptic"`
Expected: No output (no errors)

- [ ] **Step 4: Commit**

```bash
git add resources/css/app.css resources/js/hooks/use-haptic.ts
git commit -m "feat: touch feedback and haptic hook

- touch-action: manipulation (eliminate 300ms delay)
- Active state scale(0.97) on buttons/links
- useHaptic hook for tap/success/error feedback"
```

---

### Task 2: Page Transitions (CSS)

**Files:**
- Modify: `resources/css/app.css`

**Interfaces:**
- Produces: CSS animation `pageFadeIn` applied to Inertia page containers

- [ ] **Step 1: Add page transition animation to CSS**

Add to `resources/css/app.css`:

```css
/* ─── Page Transitions ─────────────────────────────────── */

/* Inertia page enter animation */
[data-page] {
    animation: pageFadeIn 150ms ease-out;
}

@keyframes pageFadeIn {
    from {
        opacity: 0;
        transform: translateY(4px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
```

- [ ] **Step 2: Verify CSS compiles**

Run: `npm run build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add resources/css/app.css
git commit -m "feat: page enter transition animation

- Fade in + slide up 4px on page load
- 150ms ease-out duration
- Applied via [data-page] selector"
```

---

### Task 3: Shared Native UI Components (CSS)

**Files:**
- Modify: `resources/css/app.css`

**Interfaces:**
- Produces: Native-feel toggle switches, inputs with 16px min font

- [ ] **Step 1: Add native toggle switch styles**

Add to `resources/css/app.css`:

```css
/* ─── Native UI Components ─────────────────────────────── */

/* Toggle switch — native iOS feel */
input[type="checkbox"].toggle,
.toggle-switch {
    appearance: none;
    -webkit-appearance: none;
    width: 51px;
    height: 31px;
    background: #e2e8f0;
    border-radius: 15.5px;
    position: relative;
    cursor: pointer;
    transition: background 150ms ease;
    flex-shrink: 0;
}

input[type="checkbox"].toggle::after,
.toggle-switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 27px;
    height: 27px;
    background: white;
    border-radius: 50%;
    transition: transform 150ms ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

input[type="checkbox"].toggle:checked,
.toggle-switch:checked {
    background: var(--color-primary);
}

input[type="checkbox"].toggle:checked::after,
.toggle-switch:checked::after {
    transform: translateX(20px);
}

/* All inputs — prevent iOS zoom (font-size >= 16px) */
input[type="text"],
input[type="email"],
input[type="tel"],
input[type="number"],
input[type="password"],
input[type="search"],
textarea,
select {
    font-size: 16px !important;
    border-radius: 10px;
    padding: 12px 16px;
    transition: border-color 150ms ease, box-shadow 150ms ease;
}

input:focus,
textarea:focus,
select:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(4, 120, 87, 0.1);
    outline: none;
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/css/app.css
git commit -m "feat: native toggle switch and input styles

- Toggle: 51x31px, iOS-style with shadow
- Inputs: 16px min font (prevent iOS zoom)
- Focus ring: 3px emerald glow"
```

---

### Task 4: Scroll Behaviors — Hide Bottom Nav (Hook + Layout)

**Files:**
- Create: `resources/js/hooks/use-hide-on-scroll.ts`
- Modify: `resources/js/components/ui/mobile-role-layout.tsx`

**Interfaces:**
- Produces: `useHideOnScroll()` hook returning `{ visible: boolean }`
- Consumes: `mobile-role-layout.tsx` bottom nav slot

- [ ] **Step 1: Create hide-on-scroll hook**

Create `resources/js/hooks/use-hide-on-scroll.ts`:

```ts
import { useEffect, useState } from 'react';

export function useHideOnScroll(threshold = 10) {
    const [visible, setVisible] = useState(true);
    const [lastY, setLastY] = useState(0);

    useEffect(() => {
        let ticking = false;

        const handleScroll = () => {
            if (ticking) return;
            ticking = true;

            requestAnimationFrame(() => {
                const currentY = window.scrollY;
                const delta = currentY - lastY;

                if (currentY < 50) {
                    setVisible(true);
                } else if (delta > threshold) {
                    setVisible(false);
                } else if (delta < -threshold) {
                    setVisible(true);
                }

                setLastY(currentY);
                ticking = false;
            });
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastY, threshold]);

    return { visible };
}
```

- [ ] **Step 2: Integrate into MobileRoleLayout**

Modify `resources/js/components/ui/mobile-role-layout.tsx` to apply `translateY` transition to bottom nav:

```tsx
import { useHideOnScroll } from '@/hooks/use-hide-on-scroll';

// Inside component:
const { visible } = useHideOnScroll();

// On the nav element:
<nav style={{
    transform: visible ? 'translateY(0)' : 'translateY(100%)',
    transition: 'transform 200ms ease',
}}>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -E "hide-on-scroll|mobile-role-layout"`
Expected: No output

- [ ] **Step 4: Commit**

```bash
git add resources/js/hooks/use-hide-on-scroll.ts resources/js/components/ui/mobile-role-layout.tsx
git commit -m "feat: hide bottom nav on scroll down

- useHideOnScroll hook with requestAnimationFrame
- Smooth 200ms translateY transition
- Shows again on scroll up or near top"
```

---

### Task 5: Skeleton Screens (Component)

**Files:**
- Modify: `resources/js/components/ui/skeleton.tsx`

**Interfaces:**
- Produces: `SkeletonCard`, `SkeletonList`, `SkeletonTable` components

- [ ] **Step 1: Read existing skeleton component**

Read `resources/js/components/ui/skeleton.tsx` to understand current implementation.

- [ ] **Step 2: Add skeleton variants**

Add to `resources/js/components/ui/skeleton.tsx`:

```tsx
export function SkeletonCard() {
    return (
        <div className="rounded-xl border border-border bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="h-4 w-24 bg-surface-muted rounded animate-pulse" />
                <div className="h-5 w-16 bg-surface-muted rounded-full animate-pulse" />
            </div>
            <div className="h-3 w-full bg-surface-muted rounded animate-pulse" />
            <div className="h-3 w-2/3 bg-surface-muted rounded animate-pulse" />
        </div>
    );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-border">
                    <div className="space-y-1.5">
                        <div className="h-3 w-32 bg-surface-muted rounded animate-pulse" />
                        <div className="h-2.5 w-20 bg-surface-muted rounded animate-pulse" />
                    </div>
                    <div className="h-4 w-16 bg-surface-muted rounded animate-pulse" />
                </div>
            ))}
        </div>
    );
}
```

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/ui/skeleton.tsx
git commit -m "feat: skeleton card and table components

- SkeletonCard: header + 2 lines placeholder
- SkeletonTable: configurable row count"
```

---

### Task 6: Owner Desktop Hover States (CSS)

**Files:**
- Modify: `resources/css/app.css`

**Interfaces:**
- Produces: Hover states for cards, buttons, interactive elements (owner only)

- [ ] **Step 1: Add desktop hover states**

Add to `resources/css/app.css`:

```css
/* ─── Owner Desktop Experience ─────────────────────────── */

/* Card hover — subtle lift */
@media (hover: hover) {
    .card-interactive:hover,
    [data-interactive]:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        transform: translateY(-1px);
        transition: box-shadow 200ms ease, transform 200ms ease;
    }

    /* Button hover states */
    .btn-primary:hover {
        background-color: var(--color-primary-hover);
    }

    .btn-ghost:hover {
        background-color: var(--color-surface-muted);
    }

    /* Cursor pointer on interactive */
    button, a, [role="button"], input[type="submit"] {
        cursor: pointer;
    }
}

/* Tooltip on hover for icon buttons */
[data-tooltip] {
    position: relative;
}

[data-tooltip]::after {
    content: attr(data-tooltip);
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%) translateY(-4px);
    background: var(--color-text);
    color: white;
    font-size: 11px;
    font-weight: 500;
    padding: 4px 8px;
    border-radius: 6px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 150ms ease;
}

[data-tooltip]:hover::after {
    opacity: 1;
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/css/app.css
git commit -m "feat: desktop hover states and tooltips

- Card hover: shadow + translateY lift
- Button hover: background shift
- Tooltip via data-tooltip attribute
- All gated behind @media (hover: hover)"
```

---

### Task 7: PWA Status Bar & Theme (Meta Tags)

**Files:**
- Modify: `resources/views/app.blade.php`

**Interfaces:**
- Produces: Theme color, status bar style, standalone detection

- [ ] **Step 1: Update meta tags in app.blade.php**

Add after existing meta tags in `resources/views/app.blade.php`:

```html
<!-- PWA Status Bar -->
<meta name="theme-color" content="#047857">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Dombi">
```

- [ ] **Step 2: Add standalone detection to app.tsx**

Add to `resources/js/app.tsx` after service worker registration:

```ts
// Detect standalone PWA mode
if (window.matchMedia('(display-mode: standalone)').matches) {
    document.documentElement.classList.add('pwa-standalone');
}
```

- [ ] **Step 3: Add standalone CSS to app.css**

```css
/* PWA standalone mode adjustments */
.pwa-standalone {
    /* Extra padding for status bar */
    padding-top: env(safe-area-inset-top);
}
```

- [ ] **Step 4: Commit**

```bash
git add resources/views/app.blade.php resources/js/app.tsx resources/css/app.css
git commit -m "feat: PWA status bar and standalone detection

- Theme color: emerald-700
- Status bar: black-translucent
- Standalone class for PWA-specific styles"
```

---

### Task 8: Per-Page Polish — Apply /gpt-taste + /steve-jobs-design-review

**Files:**
- All pages across all roles (listed in spec scope)

**Interfaces:**
- Uses: `/gpt-taste` skill before implementation
- Uses: `/steve-jobs-design-review` after implementation

- [ ] **Step 1: Customer pages — /gpt-taste**

Apply `/gpt-taste` to generate clean designs for:
- `resources/js/pages/customer/home.tsx`
- `resources/js/pages/customer/checkout/*.tsx`
- `resources/js/pages/customer/orders/*.tsx`
- `resources/js/pages/track.tsx`

Focus: spacing, hierarchy, touch targets, compact layouts.

- [ ] **Step 2: Customer pages — implement designs**

Apply the designs generated in Step 1.

- [ ] **Step 3: Customer pages — /steve-jobs-design-review**

Apply `/steve-jobs-design-review` to audit:
- Spacing consistency
- Typography hierarchy
- Color contrast
- Touch target sizes (44px min)
- Information density

Fix any issues found.

- [ ] **Step 4: Outlet pages — /gpt-taste**

Apply `/gpt-taste` to generate clean designs for:
- `resources/js/pages/outlet/dashboard.tsx`
- `resources/js/pages/outlet/orders/*.tsx`
- `resources/js/pages/outlet/inventory.tsx`
- `resources/js/pages/outlet/restocks/*.tsx`
- `resources/js/pages/outlet/returns/*.tsx`
- `resources/js/pages/outlet/exchanges/*.tsx`

- [ ] **Step 5: Outlet pages — implement + audit**

Implement designs, then apply `/steve-jobs-design-review`.

- [ ] **Step 6: Courier pages — /gpt-taste + implement + audit**

Apply to:
- `resources/js/pages/courier/dashboard.tsx`
- `resources/js/pages/courier/deliveries/*.tsx`

- [ ] **Step 7: Owner pages — /gpt-taste (desktop focus)**

Apply `/gpt-taste` with desktop-first focus:
- Sidebar navigation polish
- Multi-column layouts
- Hover states
- Keyboard shortcuts

- [ ] **Step 8: Owner pages — implement + audit**

Implement designs, then apply `/steve-jobs-design-review`.

- [ ] **Step 9: Final commit**

```bash
git add -A
git commit -m "refactor: native feel polish across all pages

- Customer/Outlet/Courier: mobile-first touch optimization
- Owner: desktop hover states and keyboard support
- All pages audited with /steve-jobs-design-review"
```

---

## Verification

After all tasks:

1. Run `npm run build` — no errors
2. Test on mobile device:
   - Tap feedback works (scale animation)
   - Bottom nav hides on scroll down
   - Page transitions smooth
   - Inputs don't trigger iOS zoom
3. Test on desktop:
   - Card hover effects work
   - Tooltips appear on icon buttons
   - Keyboard shortcuts work (Esc to close modals)
4. Run `/steve-jobs-design-review` on final state
