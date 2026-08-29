# Customer Frontend Polish Design

## Goal

Improve mobile customer experience in four focused areas: remove browser tap highlight without harming keyboard accessibility, restore lost Pickup/Delivery slide behavior associated with Product Detail flow, keep final product content visible above Floating Cart, and make customer view navigation measurably faster and smoother.

## Scope

### 1. Mobile interaction highlight

Customer-facing interactive elements must not show WebKit blue/gray tap highlight on touch devices. Existing keyboard focus indicators remain intact through `:focus-visible`; no global `outline: none` rule is allowed.

Existing `resources/css/app.css` already disables `-webkit-tap-highlight-color` for `button`, `a`, and `[role='button']`. Work must first reproduce the remaining blue outline and identify whether it comes from omitted controls (`input`, `select`, `textarea`, `summary`) or focus/ring utility classes. Fix only confirmed source.

### 2. Product Detail Pickup/Delivery slide regression

Trace git history and current customer fulfillment flow before changing UI. Product Detail currently contains no fulfillment state, so implementation must identify original owner of Pickup/Delivery transition rather than inventing a new selector.

Restore prior behavior at correct boundary:

- selection moves with a short horizontal slide;
- state remains driven by canonical fulfillment value (`pickup`, `delivery_dombi`, or normalized equivalent already used by owning component);
- animation respects `prefers-reduced-motion`;
- transition does not reset selected product variant, quantity, outlet, or cart state;
- no animation dependency is added.

If history proves transition belonged to Checkout rather than Product Detail, restore it there and document mismatch in commit body.

### 3. Floating Cart content clearance

When Floating Cart is visible, final product/card/action remains fully visible and tappable above both cart bar and bottom navigation, including iOS safe-area inset. Clearance belongs to shared customer layout, not individual product pages.

`CustomerMobileLayout` remains source of bottom spacing. Use actual known bar/navigation dimensions or shared CSS custom properties; do not solve with z-index or page-specific spacer markup. Cases:

- no floating bar;
- Floating Cart only;
- active order bar;
- custom footer slot;
- hidden bottom navigation;
- narrow mobile viewport with safe-area inset.

### 4. Customer navigation performance

Optimize evidence-first. Baseline representative route chain:

`/customer/home → /customer/products → product detail → /customer/checkout → /customer/checkout/customer`

Inspect:

- Inertia request count and duplicate reloads;
- eager customer-page bundle size from `customer-app.tsx`;
- navigation blank/flicker behavior;
- image loading/layout shifts;
- shared-provider remounts;
- route opportunities for intent-based Inertia prefetch.

Prioritized changes:

1. remove duplicate requests/reloads;
2. change eager page imports to async resolution if supported by installed Inertia/Vite versions;
3. add prefetch only to high-frequency customer links/buttons;
4. preserve current page transition only when it improves perceived continuity;
5. avoid broad component rewrites and new dependencies.

## Error Handling

- Failed navigation continues using existing Inertia behavior and flash/toast handling.
- Prefetch failure must not block click navigation.
- Animation absence must never block fulfillment selection.
- Layout spacing must degrade safely when safe-area inset is unavailable.

## Accessibility

- Preserve keyboard `focus-visible` rings.
- Respect `prefers-reduced-motion` for slide/page transitions.
- Do not hide content beneath fixed controls.
- Keep interactive controls at current minimum touch target sizes.

## Testing and Acceptance

Automated:

- focused unit test for fulfillment transition state/class helper if logic is extracted;
- focused test for shared floating-bar clearance calculation/class selection;
- `npm run format:check`;
- `npm run lint:check`;
- `npm run types:check`;
- `npm test`;
- `npm run build` to inspect chunking and catch dynamic import errors.

Manual staging:

1. Tap links/buttons/inputs on iOS Safari or Android Chrome: no blue touch overlay; keyboard focus still visible.
2. Switch Pickup ↔ Delivery in owning Product Detail flow: horizontal transition appears, reduced-motion disables it, state remains correct.
3. Add cart items and scroll to final product: product and CTA remain visible/tappable above Floating Cart.
4. Navigate representative route chain twice: no blank flash, stale page, duplicate request, or checkout state loss.
5. Confirm desktop customer navigation remains functional.

## Non-goals

- Backend query redesign without measured backend bottleneck.
- New animation library.
- New global state framework.
- Visual redesign of Product Detail, checkout, Floating Cart, or bottom navigation.
- Changes to payment runtime or DOKU configuration.
