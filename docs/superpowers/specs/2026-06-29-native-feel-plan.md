# Native Feel — Full Plan

## Goal

Make every Dombi page feel native across all roles. Eliminate "web feel" — no rubber-band scrolling, no delayed taps, no janky transitions.

## Design Quality Assurance

For every page or component refactored, apply these skills to ensure UI quality:

| Skill | When to Use | Purpose |
|-------|-------------|---------|
| `/gpt-taste` | Before implementation | Generate clean, compact, minimal UI designs. Break LLM defaults (cramped layouts, poor hierarchy, generic patterns). |
| `/steve-jobs-design-review` | After implementation | Audit for visual polish: spacing consistency, typography hierarchy, color contrast, touch target sizes, information density. |

**Process per page:**
1. `/gpt-taste` — design the layout, spacing, hierarchy
2. Implement the design
3. `/steve-jobs-design-review` — audit and fix issues
4. Move to next page

**What to look for:**
- Spacing: consistent padding/margin, no cramped elements
- Typography: clear hierarchy (title > subtitle > body > caption)
- Colors: proper contrast, semantic usage
- Touch targets: 44px minimum on mobile
- Information density: compact but not cluttered
- Functional: every element serves a purpose

## Scope: All Roles

| Role | Experience | Platform | Pages |
|------|-----------|----------|-------|
| **Customer** | Mobile-first | PWA / Mobile browser | Home, Checkout, Orders, Track, Profile |
| **Outlet** | Mobile-first | PWA / Mobile browser | Dashboard, Orders, Scan, Inventory, Restocks, Returns, Exchanges, Analytics, More |
| **Courier** | Mobile-first | PWA / Mobile browser | Dashboard, Deliveries, Profile |
| **Owner** | Desktop-first | Desktop browser / Tablet | Dashboard, Orders, Deliveries, Returns, Exchanges, Pricing, Inventory, Outlets, Products, Reports, Analytics, Finance, Settings |

### Customer / Outlet / Courier — Mobile Experience
- Touch-optimized (44px min targets)
- Bottom navigation
- Pull-to-refresh
- Swipe gestures
- Haptic feedback
- Full-screen layouts
- Bottom sheets for dialogs

### Owner — Desktop Experience
- Mouse/keyboard optimized
- Sidebar navigation
- Hover states (no tap-highlight)
- Multi-column layouts where appropriate
- Modal dialogs (not bottom sheets)
- Keyboard shortcuts
- Responsive breakpoints (desktop → tablet → mobile fallback)

## Current State

- PWA with service worker registered
- Tailwind CSS v4 with custom design tokens
- Inertia.js SPA navigation
- Public Sans font
- Owner uses `OwnerPageShell` layout (sidebar)
- Customer/Outlet/Courier use mobile layouts (bottom nav)

## Quick Wins (Done)

- `scroll-behavior: smooth`
- `overscroll-behavior-y: contain` (prevent pull-to-refresh)
- `-webkit-tap-highlight-color: transparent`
- `user-select: none` on interactive elements
- `-webkit-overflow-scrolling: touch`

## Full Implementation Plan

### Phase 1: Touch & Haptics

**1.1 — Fast tap (eliminate 300ms delay)**
```css
/* Already handled by mobile viewport meta, but ensure: */
html { touch-action: manipulation; }
```

**1.2 — Haptic feedback on actions**
```ts
// Add to button onClick handlers
if (navigator.vibrate) navigator.vibrate(10); // subtle tap
```

**1.3 — Active state feedback**
```css
button:active, a:active {
    transform: scale(0.97);
    opacity: 0.8;
    transition: transform 50ms;
}
```

### Phase 2: Page Transitions

**2.1 — Inertia.js page transition**
```ts
// In app.tsx — add progress bar on navigation
import NProgress from 'nprogress';
router.on('start', () => NProgress.start());
router.on('finish', () => NProgress.done());
```

**2.2 — Fade transition between pages**
```css
/* Inertia page transition */
[inertia] {
    animation: fadeIn 150ms ease-out;
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
}
```

### Phase 3: Scroll Behaviors

**3.1 — Sticky headers with backdrop blur**
```css
header {
    position: sticky;
    top: 0;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background: rgba(255, 255, 255, 0.85);
}
```

**3.2 — Scroll restoration**
```ts
// Inertia scroll restoration
router.on('navigate', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});
```

**3.3 — Hide bottom nav on scroll down, show on scroll up**
```ts
let lastScrollY = 0;
window.addEventListener('scroll', () => {
    const nav = document.querySelector('nav');
    if (window.scrollY > lastScrollY) {
        nav.style.transform = 'translateY(100%)';
    } else {
        nav.style.transform = 'translateY(0)';
    }
    lastScrollY = window.scrollY;
});
```

### Phase 4: Loading States

**4.1 — Skeleton screens everywhere**
- Replace loading spinners with skeleton placeholders
- Match actual content layout

**4.2 — Optimistic UI**
- Update UI immediately on action
- Revert on error
- Example: order status badge updates before server confirms

**4.3 — Pull-to-refresh**
```ts
// Custom pull-to-refresh for order list
let startY = 0;
element.addEventListener('touchstart', (e) => startY = e.touches[0].clientY);
element.addEventListener('touchmove', (e) => {
    if (e.touches[0].clientY - startY > 100 && window.scrollY === 0) {
        // Trigger refresh
    }
});
```

### Phase 5: Gestures

**5.1 — Swipe to dismiss**
- Swipe left on notification to dismiss
- Swipe right on order to view details

**5.2 — Bottom sheet gestures**
- Drag to dismiss
- Velocity-based snapping

### Phase 6: Native UI Components

**6.1 — Shared (all roles)**
```css
/* Toggle switch */
input[type="checkbox"] {
    appearance: none;
    width: 51px; height: 31px;
    background: #e2e8f0;
    border-radius: 15.5px;
    transition: background 150ms;
}
input[type="checkbox"]:checked {
    background: var(--color-primary);
}

/* All inputs — prevent iOS zoom (font-size >= 16px) */
input, textarea, select {
    font-size: 16px;
    border-radius: 10px;
    padding: 12px 16px;
}
```

**6.2 — Customer / Outlet / Courier (mobile)**
- Bottom sheets for dialogs (slide-up animation)
- `min-height: 44px` on all touch targets
- Full-width buttons
- Bottom navigation with hide-on-scroll
- Pull-to-refresh on list pages
- Swipe gestures

**6.3 — Owner (desktop)**
- Modal dialogs (centered, backdrop blur)
- Hover states on cards and buttons (`hover:shadow-md`, `hover:bg-*`)
- Keyboard shortcuts (Esc to close, Enter to submit)
- Sidebar navigation (fixed left)
- Multi-column grids where appropriate
- `cursor: pointer` on interactive elements
- No pull-to-refresh (desktop doesn't have it)
- Tooltip on hover for icon buttons

### Phase 7: Performance

**7.1 — Image optimization**
- Use `loading="lazy"` on all images
- Serve WebP with fallback
- Proper `srcset` for responsive

**7.2 — Code splitting**
- Dynamic imports for heavy components
- Route-based code splitting via Inertia

**7.3 — Font optimization**
- `font-display: swap`
- Preload critical fonts
- Subset to Latin + Latin Extended

### Phase 8: PWA Polish

**8.1 — Splash screen**
- Match brand colors
- Show app icon centered

**8.2 — App-like status bar**
```html
<meta name="theme-color" content="#047857">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```

**8.3 — Standalone mode detection**
```ts
if (window.matchMedia('(display-mode: standalone)').matches) {
    // PWA mode — hide install prompts
}
```

## Implementation Order

### Shared (all roles)
1. Phase 1 (Touch & Haptics) — 1 hour
2. Phase 2 (Page Transitions) — 2 hours
3. Phase 6.1 (Shared UI: switches, inputs) — 1 hour
4. Phase 7 (Performance) — 2 hours

### Customer / Outlet / Courier (mobile)
5. Phase 3 (Scroll: hide nav, pull-to-refresh) — 1 hour
6. Phase 4 (Loading: skeletons, optimistic UI) — 2 hours
7. Phase 6.2 (Mobile UI: bottom sheets, touch targets) — 1 hour
8. Phase 5 (Gestures: swipe, drag) — 3 hours
9. Phase 8 (PWA: splash, status bar) — 1 hour

### Owner (desktop)
10. Phase 6.3 (Desktop UI: modals, hover, keyboard) — 2 hours

**Total: ~16 hours**

## Priority for Demo

After demo, start with:
1. Phase 1 + 2 (Touch + Transitions) — biggest visual impact, all roles
2. Phase 6 (Native UI) — inputs, switches, alerts
3. Phase 4 (Loading) — skeletons, optimistic UI
