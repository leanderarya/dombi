# OUTLET UI AUDIT

Audit date: 2026-06-05  
Scope: Outlet Dashboard, Orders, Order Detail, Deliveries, Inventory, Restocks, Distribution confirmation, Settings/navigation, Sheets, Filters, Status Actions, Empty/Loading states.  
Audit type: UI/UX and information architecture review only. No implementation changes were made.

## Executive Summary

Outlet UI is functionally usable, but it is not yet a first-class mobile operational experience. The role is supposed to be used by store operators on Android/iPhone in kitchen, counter, and fast-paced outlet environments. Current Outlet screens still mix mobile cards, desktop tables, generic admin forms, and Owner-specific components.

Compared with Customer and Courier, Outlet has weaker shared foundation adoption. Courier now uses `MobileRoleLayout`, `PageHeader`, `SectionCard`, `FilterChips`, `BottomSheet`, and `StickyActionBar`; Outlet still uses a custom `OutletLayout`, horizontal top nav, raw tables, raw forms, and custom sheet markup. This causes visible design drift and creates workflow friction for Accept, Reject, Assign Courier, Confirm Received, and Restock Request.

The strongest Outlet page is the dashboard: it surfaces delivery pressure, order pressure, low stock, restock shortcuts, and recent orders. The weakest pages are Orders Index, Inventory, Restock Create, and Restock Detail because they use desktop/table/form assumptions and do not optimize for thumb-friendly mobile operations.

Current answer to "Can outlet understand orders, deliveries, inventory alerts, and restock requests within 5 seconds?": partially. Dashboard metrics are visible, but priority order is noisy and the highest-frequency action path is not sticky or standardized.

## Scores

Consistency Score: 58 / 100

Mobile Usability Score: 61 / 100

Operational Speed Score: 60 / 100

Shared Foundation Adoption Score: 42 / 100

## Strengths

- Dashboard polls every 20 seconds in [dashboard.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/dashboard.tsx:8), which fits real-time outlet operations.
- Dashboard surfaces delivery pressure first: needs dispatch, waiting pickup, in transit, failed, completed today, and average dispatch time in [dashboard.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/dashboard.tsx:18).
- Dashboard shows low stock warnings with available/minimum stock and a restock CTA in [dashboard.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/dashboard.tsx:70).
- Delivery list uses mobile cards and a filter sheet rather than a desktop table in [deliveries/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/deliveries/index.tsx:101).
- Order detail has a rejection bottom sheet flow with reason selection and safe-area padding in [orders/show.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/orders/show.tsx:160).

## Critical Findings

### Critical 1: Outlet does not use the shared mobile role foundation

Evidence:
- Outlet uses a custom `OutletLayout` with its own header, horizontal nav, background, and content width in [outlet-layout.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/layouts/outlet-layout.tsx:17).
- Courier uses `MobileRoleLayout` and `PageHeader` in [courier-layout.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/layouts/courier-layout.tsx:46).
- Shared `MobileRoleLayout` already provides safe-area-aware bottom spacing and max mobile width in [mobile-role-layout.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/components/ui/mobile-role-layout.tsx:18).

Root cause: Outlet predates or bypasses the newer shared Customer/Courier mobile foundation.

Business risk: Outlet feels like a separate app, not Dombi. Operational controls, spacing, headers, empty states, and sheets behave differently from Courier and Customer.

Safe fix direction: migrate `OutletLayout` to compose `MobileRoleLayout`, `PageHeader`, and an Outlet bottom nav. Keep page content unchanged first, then refactor screens incrementally.

### Critical 2: Outlet primary navigation is a horizontal top nav, not a mobile bottom nav

Evidence:
- Outlet nav is rendered as horizontal scroll under the header in [outlet-layout.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/layouts/outlet-layout.tsx:28).
- Customer uses fixed bottom navigation with safe-area support in [bottom-nav.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/components/customer/bottom-nav.tsx:14).
- Courier uses fixed bottom navigation with safe-area support in [courier-bottom-nav.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/components/courier-bottom-nav.tsx:13).

Root cause: Outlet navigation is still closer to a responsive web admin nav than an operator mobile nav.

Business risk: high-frequency modules are less reachable one-handed. Operators must reach the top of the screen and may horizontally scroll to find navigation.

Safe fix direction: add `OutletBottomNav` with Dashboard, Orders, Deliveries, Inventory, More/Restocks. Keep top header for outlet identity and account actions only.

### Critical 3: Orders Index uses a desktop table on a mobile-first role

Evidence:
- Outlet Orders Index wraps a table in `overflow-x-auto` in [orders/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/orders/index.tsx:24).
- The table has five columns: Order, Customer, Total, Status, Created in [orders/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/orders/index.tsx:28).

Root cause: desktop admin table pattern was used for a role whose primary devices are 360-412px mobile screens.

Business risk: order triage becomes slower on Android/iPhone. Horizontal scrolling hides status/time/action context, and the order list does not match Customer/Courier card patterns.

Safe fix direction: replace mobile order table with operational order cards: order code, customer, fulfillment type, age, status, item count/total, and immediate detail/action affordance. Desktop/table can be optional only above tablet widths.

### Critical 4: Critical actions are not sticky and some are below preferred touch target size

Evidence:
- Accept/Reject/Preparing/Ready actions sit inside the item card after the item list in [orders/show.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/orders/show.tsx:51).
- Accept and Reject buttons use `px-4 py-2`, likely around 36-40px high, in [orders/show.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/orders/show.tsx:54).
- Assign Courier button uses `min-h-[36px]` in [deliveries/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/deliveries/index.tsx:89).
- Shared `StickyActionBar` already provides `min-h-12` actions and safe-area bottom placement in [sticky-action-bar.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/components/ui/sticky-action-bar.tsx:25).

Root cause: Outlet action placement is page-local rather than workflow-local.

Business risk: fast-paced operators must scroll and hunt for action buttons. Miss-taps are more likely during kitchen/counter use.

Safe fix direction: use `StickyActionBar` for Accept, Reject, Start Preparing, Mark Ready, Assign Courier, Confirm Received, and Submit Restock.

## Major Findings

### Major 1: Dashboard hierarchy is useful but crowded and not clearly exception-first

Evidence:
- Dashboard renders delivery stats, failure reasons, order stats, quick actions, low stock warnings, and recent orders sequentially in [dashboard.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/dashboard.tsx:18).
- Order stats use six cards after delivery stats in [dashboard.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/dashboard.tsx:53).
- Quick actions are a horizontal scroller in [dashboard.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/dashboard.tsx:63).

Impact: important alerts exist, but the first 5 seconds may show too many similarly weighted cards. "What should I do now?" is not always the dominant message.

Recommendation: prioritize one top "Now" panel: pending orders, failed deliveries, needs dispatch, and critical low stock. Move secondary metrics below.

### Major 2: Order workflow takes more taps/scrolling than necessary

Current likely path:
1. Open Orders.
2. Use select filter.
3. Tap order code in table.
4. Scroll through items.
5. Tap Accept or Reject.
6. If Reject, select reason in sheet and confirm.

Evidence:
- Status filter is a native select at page top in [orders/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/orders/index.tsx:19).
- Detail actions are inside content below item list in [orders/show.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/orders/show.tsx:51).

Impact: Accepting a pending order should be a low-friction operator action. The current flow is functionally correct but not fast enough for repeated use.

Recommendation: use filter chips for statuses and make pending order cards expose primary action or a sticky detail action bar.

### Major 3: Inventory is table-based and weak for fast stock problem identification

Evidence:
- Inventory uses an `overflow-x-auto` table in [inventory.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/inventory.tsx:16).
- It shows current/reserved/available/minimum/level, which is correct data, but not grouped by urgency or action state in [inventory.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/inventory.tsx:17).

Impact: outlet can see stock data, but identifying critical/low items requires scanning rows and columns. On a 360px device this is not optimal.

Recommendation: render stock cards grouped as Critical, Low Stock, Healthy. Each card should show available stock as the main number and a Request Restock action.

### Major 4: Restock Create is a desktop-form layout

Evidence:
- Restock Create uses a grid with `md:grid-cols-[1fr_130px_160px_auto]` in [create.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/restocks/create.tsx:23).
- Product select, quantity input, stock metadata, and delete action are packed into one row in [create.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/restocks/create.tsx:24).
- Submit button is in normal form flow, not sticky, in [create.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/restocks/create.tsx:40).

Impact: creating restock requests on phone is more manual and error-prone than necessary.

Recommendation: use stacked item cards with stock context first, large quantity controls, "Tambah item" as secondary action, and sticky submit CTA.

### Major 5: Restock status model shown in Outlet UI includes stale/hidden states

Evidence:
- Outlet Restocks Index includes `approved` and `received` in the filter list in [restocks/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/restocks/index.tsx:7).
- Previous restock simplification direction uses requested, preparing, shipped, completed, and rejected as the operational flow.

Impact: operators may see filters that rarely or never represent current operational state, which lowers clarity.

Recommendation: align Outlet restock filters with the simplified operational status vocabulary.

### Major 6: Outlet detail pages still use desktop two-column grid behavior

Evidence:
- Order Detail uses `lg:grid-cols-[1fr_360px]` in [orders/show.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/orders/show.tsx:37).
- Delivery Detail uses `lg:grid-cols-[1fr_360px]` in [deliveries/show.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/deliveries/show.tsx:26).
- Restock Detail uses `lg:grid-cols-[1fr_340px]` in [restocks/show.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/restocks/show.tsx:14).

Impact: desktop adaptation itself is not wrong, but the page structure is optimized like admin detail pages instead of mobile action workflows. Mobile content order is also not always action-first.

Recommendation: define mobile-first detail templates: status strip, customer/order summary, primary action bar, operational info cards, timeline.

### Major 7: Outlet reuses Owner-specific components

Evidence:
- Deliveries Index imports `AssignCourierSheet`, `DeliverySlaBadge`, and `FilterSheet` from `components/owner` in [deliveries/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/deliveries/index.tsx:3).
- Delivery Show imports Owner `DeliverySlaBadge` and `DeliveryTimeline` in [deliveries/show.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/deliveries/show.tsx:2).

Impact: Outlet can inherit Owner visual/interaction assumptions. It also makes component ownership unclear.

Recommendation: move reusable operational components into shared `components/ui` or `components/delivery`, then compose role-specific wrappers only where necessary.

### Major 8: Sheet implementation is duplicated

Evidence:
- Outlet Order rejection sheet is hand-coded in [orders/show.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/orders/show.tsx:160).
- Shared `BottomSheet` already exists with body scroll locking, escape handling, safe-area padding, and max-height behavior in [bottom-sheet.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/components/ui/bottom-sheet.tsx:13).

Impact: sheet behavior, accessibility, and styling can drift between Outlet and Courier.

Recommendation: replace custom reject sheet with `BottomSheet`, then standardize assignment/filter/confirmation sheets around the same primitive.

## Minor Findings

### Minor 1: Visual language uses older warm/admin background

Evidence:
- OutletLayout uses `bg-[#f8f7f2]` in [outlet-layout.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/layouts/outlet-layout.tsx:18).
- Customer/Courier shared foundation uses `bg-[#fbf9f7]` in [customer-mobile-layout.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/layouts/customer-mobile-layout.tsx:30) and [mobile-role-layout.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/components/ui/mobile-role-layout.tsx:19).

Recommendation: align Outlet surface colors with shared mobile foundation.

### Minor 2: Labels are mixed Indonesian and English

Evidence:
- Outlet navigation uses Dashboard, Orders, Inventory, Restocks in [outlet-layout.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/layouts/outlet-layout.tsx:5).
- Dashboard uses Delivery, Low Stock, Restock Active, Order Aktif in [dashboard.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/dashboard.tsx:18).
- Restock buttons use Create Request and Submit Request in [restocks/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/restocks/index.tsx:15) and [create.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/restocks/create.tsx:40).

Recommendation: use Indonesian operational terms consistently: Pesanan, Pengiriman, Inventaris, Restock, Buat Request, Kirim Request.

### Minor 3: Empty states are inconsistent and often not actionable

Evidence:
- Orders uses legacy `EmptyState` in [orders/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/orders/index.tsx:25).
- Deliveries uses custom dashed empty state with emoji in [deliveries/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/deliveries/index.tsx:104).
- Shared EmptyState supports actions in [empty-state.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/components/ui/empty-state.tsx:18), but Outlet does not consistently use it.

Recommendation: use shared empty state with contextual action: Reset Filter, Lihat Pesanan, Buat Restock.

### Minor 4: Some filter controls are not thumb-friendly patterns

Evidence:
- Orders status filter is a select in [orders/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/orders/index.tsx:19).
- Restock status filter is a select in [restocks/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/restocks/index.tsx:17).
- Courier uses `FilterChips` in the header below area in [deliveries/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/courier/deliveries/index.tsx:28).

Recommendation: use `FilterChips` for high-frequency status filters and `BottomSheet` only for less-common filters.

### Minor 5: Icon system is inconsistent

Evidence:
- Dashboard low stock heading uses emoji in [dashboard.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/dashboard.tsx:73).
- Empty states use emoji in [orders/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/orders/index.tsx:26) and [deliveries/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/deliveries/index.tsx:106).
- Courier uses lucide icons in workflow surfaces such as [dashboard.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/courier/dashboard.tsx:3).

Recommendation: use lucide icons for operational surfaces and reserve emoji only if the Customer reference intentionally uses it.

## Workflow Friction Findings

### Accept / Reject Order

Friction: Medium-high.

Actions are only available inside detail content after item review. Reject sheet itself is decent, but it is custom and not shared. A fast operator flow should expose sticky actions as soon as status is `pending_confirmation`.

Target flow: Orders -> pending card -> detail -> sticky Accept / Reject -> optional reject sheet.

### Start Preparing / Mark Ready

Friction: Medium.

Actions exist in [orders/show.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/orders/show.tsx:68), but they are not sticky, not consistently 48px, and can be pushed below content.

Target flow: detail status strip + sticky next-status action.

### Assign Courier

Friction: Medium.

Delivery list has "Perlu Assign Kurir" cards, which is good. The Assign button is only `min-h-[36px]` and fetches courier options via an Inertia request to the order show endpoint in [deliveries/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/deliveries/index.tsx:26).

Target flow: preloaded courier options or dedicated lightweight endpoint; 48px Assign action; shared assignment sheet.

### Confirm Restock Received

Friction: Medium.

Confirm Received appears inside Restock Detail only when distribution is shipped in [restocks/show.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/restocks/show.tsx:27). It is not sticky and can be visually buried inside a compact aside.

Target flow: shipped distribution card -> sticky Confirm Received action -> confirmation sheet.

### Request Restock

Friction: High.

Form layout is desktop-like and item rows are dense. Operators need product, current stock, minimum stock, and requested quantity in a more touch-friendly card flow.

Target flow: Inventory critical/low item -> Request Restock -> prefilled item card -> quantity stepper -> sticky submit.

## Layout Review By Target Device

360x800:
- Orders Index and Inventory likely require horizontal scrolling because they render tables.
- Top navigation may compete with content height and requires reaching the top.
- Detail pages can be long and actions may appear below the first viewport.

390x844:
- Dashboard generally fits, but multiple KPI grids and quick-action scroller create visual density.
- Delivery cards are acceptable; Assign button should be taller.

412x915:
- Most card pages should be usable, but Restock Create and table pages still feel like adapted desktop pages.

Small tablets:
- Current `max-w-5xl` OutletLayout may spread content wider than mobile patterns, but most outlet use should still be optimized around the mobile single-column rhythm.

## Bottom Navigation Review

Current state:
- Outlet has no fixed bottom nav.
- It uses a top horizontal nav in [outlet-layout.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/layouts/outlet-layout.tsx:28).

Compared with Customer:
- Customer has fixed bottom nav with four items and safe-area support in [bottom-nav.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/components/customer/bottom-nav.tsx:14).

Compared with Courier:
- Courier has fixed bottom nav with role-specific items and safe-area support in [courier-bottom-nav.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/components/courier-bottom-nav.tsx:13).

Recommendation:
- Add Outlet bottom nav: Dashboard, Pesanan, Pengiriman, Inventaris, Lainnya.
- Put Restocks, Settings, and secondary tools in More if five tabs becomes too dense.

## Sheet Review

Current sheet usage:
- Outlet Deliveries uses Owner `FilterSheet` in [deliveries/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/deliveries/index.tsx:150).
- Outlet Deliveries uses Owner `AssignCourierSheet` in [deliveries/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/deliveries/index.tsx:140).
- Outlet Order rejection sheet is custom markup in [orders/show.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/orders/show.tsx:160).

Assessment:
- Functional but inconsistent.
- Shared `BottomSheet` should become the base primitive for reject, assign, filter, confirm received, and restock submission.

## Status Badge Review

Current state:
- Outlet uses global `OrderStatusBadge`, `DeliveryStatusBadge`, `RestockStatusBadge`, `DistributionStatusBadge`, and `StockLevelBadge`.
- These are domain-specific and likely useful, but not clearly composed from the shared `StatusBadge`.

Issues:
- Some pages show raw status text in selects, e.g. `status.replaceAll('_', ' ')` in [orders/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/orders/index.tsx:21).
- Restock statuses include stale statuses in [restocks/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/restocks/index.tsx:7).

Recommendation:
- Centralize status label/color mapping and use badge components everywhere, including filters/chips.

## Action Target Review

Meets or near target:
- Dashboard quick actions use `py-2.5` in [dashboard.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/dashboard.tsx:64).
- Reject sheet confirm button is `h-12` in [orders/show.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/orders/show.tsx:212).

Below preferred target:
- Order detail status buttons use `py-2` in [orders/show.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/orders/show.tsx:54).
- Assign Courier button uses `min-h-[36px]` in [deliveries/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/deliveries/index.tsx:89).
- Customer map action is `min-h-[36px]` in [orders/show.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/orders/show.tsx:136).
- Restock Create submit uses normal `py-2` in [create.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/outlet/restocks/create.tsx:40).

Recommendation:
- Critical actions: 48px preferred.
- Secondary actions: 44px minimum.
- Use sticky action bar when the action advances operational state.

## Design Drift Detection

Critical drift:
- Outlet layout does not use shared mobile role layout.
- Outlet lacks bottom navigation unlike Customer and Courier.
- Orders and Inventory still use mobile-hostile tables.

Major drift:
- Outlet imports Owner components for delivery SLA, assignment, timeline, and filter sheets.
- Restock and inventory flows look like generic admin CRUD.
- Action placement is content-local instead of sticky operational flow.

Minor drift:
- Mixed language.
- Emoji use in operational screens.
- Older background and card styling.
- Inconsistent empty states.

## Shared Component Opportunities

Immediate reuse:
- `MobileRoleLayout` for OutletLayout base.
- `PageHeader` for all Outlet pages.
- `FilterChips` for status filters in Orders, Deliveries, Restocks.
- `SectionCard` for dashboard sections, order detail, inventory cards, restock cards.
- `BottomSheet` for reject, assign, filter, confirm received.
- `StickyActionBar` for Accept/Reject/Status Update/Assign/Confirm Received/Submit Restock.
- `EmptyState` for no orders, no deliveries, no restocks, no inventory.

New shared components worth creating:
- `OutletBottomNav`
- `OutletOrderCard`
- `OutletInventoryCard`
- `OutletRestockCard`
- `RestockRequestItemCard`
- `OperationalPriorityPanel`

Avoid:
- Creating another Outlet-only design system.
- Duplicating Owner sheet components.
- Adding desktop tables as the default mobile view.

## Empty State Review

No Orders:
- Present, but uses legacy EmptyState inside table container. Needs action such as "Reset Filter" when filters are active.

No Deliveries:
- Present as custom dashed card. Should use shared EmptyState.

No Restocks:
- Present, but should include primary action "Buat Request Restock".

No Inventory Issues:
- No clear dedicated "healthy inventory" empty/positive state. Inventory page only shows table or "Belum ada inventory".

Recommendation:
- Standardize all empty states with icon, title, description, and primary action.

## Loading State Review

Findings:
- Dashboard and Deliveries poll regularly via `usePolling`, but no visible refresh/polling state is shown.
- There are no skeleton loaders on Outlet list/detail pages.
- Form buttons show limited processing states; Reject sheet shows `Menolak...`, but order status actions and restock submit do not visibly disable/show loading.

Recommendation:
- Add lightweight skeletons for list pages.
- Add processing state on all state-changing actions.
- Add subtle "updated just now" or last refresh metadata for dashboard/delivery operations.

## Priority Fix List

1. Rebuild `OutletLayout` on `MobileRoleLayout` and `PageHeader`.
2. Add `OutletBottomNav` with safe-area support and high-frequency modules.
3. Replace Orders Index table with mobile order cards and filter chips.
4. Replace Inventory table with stock-level cards grouped by urgency.
5. Move critical order actions into `StickyActionBar`.
6. Replace custom reject sheet and Owner filter/assign sheets with shared `BottomSheet`-based Outlet flows.
7. Refactor Restock Create into touch-friendly stacked cards with sticky submit.
8. Simplify Outlet restock status filters to operationally valid statuses.
9. Move shared Owner delivery components into neutral shared components.
10. Standardize empty states, loading states, labels, badges, and touch target sizes.

## Command Results

Passed:
- `npm run build` — passed, Vite build completed in 3.80s.
- `npm run types:check` — passed, `tsc --noEmit` completed without errors.
