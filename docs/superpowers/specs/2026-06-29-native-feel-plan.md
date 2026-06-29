# Native Feel — Full Plan

## Goal

Make the Dombi PWA feel like a native mobile app. Eliminate "web feel" — no rubber-band scrolling, no delayed taps, no janky transitions.

## Current State

- PWA with service worker registered
- Tailwind CSS v4 with custom design tokens
- Inertia.js SPA navigation
- Public Sans font

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

**6.1 — Native-feel switches**
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
```

**6.2 — Native-feel inputs**
```css
input, textarea, select {
    font-size: 16px; /* Prevent iOS zoom */
    border-radius: 10px;
    padding: 12px 16px;
}
```

**6.3 — Native-feel alerts**
- Use bottom sheets instead of browser `alert()`
- Smooth slide-up animation

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

1. Phase 1 (Touch) — 1 hour
2. Phase 2 (Transitions) — 2 hours
3. Phase 3 (Scroll) — 1 hour
4. Phase 4 (Loading) — 3 hours
5. Phase 6 (Native UI) — 2 hours
6. Phase 7 (Performance) — 2 hours
7. Phase 5 (Gestures) — 4 hours
8. Phase 8 (PWA) — 1 hour

**Total: ~16 hours**

## Priority for Demo

After demo, start with:
1. Phase 1 + 2 (Touch + Transitions) — biggest visual impact
2. Phase 6 (Native UI) — inputs, switches, alerts
3. Phase 4 (Loading) — skeletons, optimistic UI
