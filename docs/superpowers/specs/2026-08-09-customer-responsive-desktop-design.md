# Customer Responsive Desktop/Tablet Support

## Goal

Extend customer experience beyond mobile-first layouts so home, products, and checkout feel intentionally designed on tablet and desktop screens while preserving mobile behavior and existing data flows.

## Scope

Phase 1 covers:

- `customer/home`
- `customer/products`
- `customer/checkout`
- `customer/checkout/customer`
- `customer/checkout/payment`
- Shared customer shell and navigation used by these pages

Out of scope:

- Backend/API changes
- New customer features
- Order, profile, favorites, and help page redesign
- Global sheet/component rewrite
- Design-system replacement

## Responsive breakpoints

- Below `768px`: preserve current mobile behavior.
- `768px` through `1023px`: tablet layout; use compact responsive grids and stacked checkout when two columns are not safe.
- `1024px` and above: desktop layout with top navigation and web-native page composition.

Use existing Tailwind breakpoint conventions. Avoid JavaScript viewport detection unless existing behavior makes CSS impossible.

## Shared customer shell

`customer-mobile-layout.tsx` becomes the responsive customer shell without changing its public role as the compatibility wrapper used by existing pages.

Mobile shell retains:

- Customer top bar
- Bottom navigation
- Floating cart bar
- Mobile content width and safe-area spacing
- Bottom-sheet interactions

Tablet/desktop shell adds:

- Sticky horizontal top navigation with brand, Beranda, Produk, Favorit, Pesanan, and Akun links
- Location selector and cart action in header
- Active route styling
- Wider centered content canvas, up to approximately `1280px`
- Hidden bottom navigation
- No floating cart bar when a page provides a desktop cart/summary action

Do not add a second routing abstraction or duplicate mobile/desktop page tree. Use responsive composition and existing routes/state.

Likely files:

- `resources/js/layouts/customer-mobile-layout.tsx`
- `resources/js/layouts/customer-layout.tsx`
- `resources/js/components/customer/customer-top-bar.tsx`
- `resources/js/components/customer/bottom-nav.tsx`
- `resources/js/components/customer/floating-cart-bar.tsx`

## Home composition

At tablet/desktop widths:

- Hero spans the content canvas.
- Greeting card no longer relies on a large mobile overlap.
- Pickup and Delivery quick actions become prominent responsive cards.
- Promo bento uses two columns on tablet and three columns on desktop.
- Active-order and phone prompts may occupy a side column when width allows.
- Preserve existing copy, auth behavior, pickup/delivery handlers, notifications, polling, and overlays.
- Do not introduce new home data fetching.

Mobile composition remains unchanged except for shared shell breakpoint classes.

Likely file:

- `resources/js/pages/customer/home.tsx`

## Products composition

At desktop widths, products becomes a catalog layout:

- Left rail for outlet, fulfillment, and category controls.
- Main area for recommendations and family sections.
- Recommendations use a multi-card grid rather than mandatory horizontal scrolling.
- Family sections use responsive product columns.
- Cart becomes a sticky right-side summary/action only where available width supports it.

At tablet widths:

- Use compact horizontal outlet/fulfillment/category controls.
- Avoid permanent rail if it would make product cards too narrow.
- Keep responsive product grid.
- Floating cart may remain when a summary rail is not appropriate.

Preserve:

- `buildSections` and `buildRecommendations` as data sources
- Outlet context and fulfillment state
- Favorite toggles
- Quick-add and variant selection behavior
- Existing cart mutation/error rollback behavior
- Outlet and delivery dialogs/sheets, changing presentation only by breakpoint where useful

Likely file:

- `resources/js/pages/customer/products.tsx`

## Checkout composition

At desktop widths:

- Progress header remains visible at top.
- Current step content occupies left column.
- Sticky order summary occupies right column.
- Summary exposes items, fulfillment, fees, total, and primary Continue/Pay action.
- Payment and fulfillment choices can be visible cards instead of mobile-only collapsed controls.
- Full-width sticky bottom `StepButton` remains for mobile.

At tablet widths:

- Use two columns only when content remains usable.
- Otherwise stack form and summary safely.

Preserve all existing business safeguards:

- Empty-cart redirect
- Stock validation
- Stock-adjustment confirmation
- Delivery serviceability blocking
- Inline submit/network errors
- Duplicate-submit prevention
- Existing payment redirect behavior

Likely files:

- `resources/js/pages/customer/checkout/index.tsx`
- `resources/js/pages/customer/checkout/customer.tsx`
- `resources/js/pages/customer/checkout/payment.tsx`
- Existing checkout components as needed

## Accessibility and interaction

- Desktop navigation exposes active route and remains keyboard reachable.
- Responsive controls retain visible labels and at least `44px` touch targets on tablet.
- Dialog focus, escape, and close behavior remain intact.
- Sticky actions must not cover errors or trap focus.
- Do not communicate state through color alone.
- No horizontal page overflow at target viewport sizes.

## Verification

Run existing relevant frontend tests and TypeScript/lint checks available in project.

Perform browser/manual verification at:

- `375x812` mobile regression
- `768x1024` tablet
- `1440x900` desktop

Check:

- Correct nav mode
- No horizontal overflow
- Home grids remain balanced
- Products remain scannable and add-to-cart works
- Checkout summary and CTA remain visible/reachable
- Error and loading states are not obscured

Non-trivial responsive composition should leave one runnable check for the desktop contract where practical; avoid adding a test framework or abstraction solely for this feature.

## Implementation constraints

- Prefer existing Tailwind utilities and installed components.
- No new dependency.
- No backend changes.
- Minimum files and shortest working diff.
- Preserve mobile behavior first; desktop enhancements must be additive at breakpoints.
