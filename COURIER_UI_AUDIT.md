# Courier UI Consistency Audit

Date: 2026-06-04

Reference:

- `DESIGN.md`
- Customer mobile UI patterns in `resources/js/layouts/customer-mobile-layout.tsx`
- Customer order pages and shared Customer components

Scope:

- Courier Dashboard
- Courier Delivery List
- Courier Delivery Detail
- Proof of Delivery Sheet
- Failure Sheet
- Availability Controls
- Shift Controls
- Empty States
- Loading States
- Navigation and bottom navigation behavior

This is an audit only. No UI fixes were implemented.

---

## 1. Executive Summary

Courier is functionally usable and mostly mobile-first, but it does not fully feel like the same Dombi product as Customer.

The strongest parts are:

- Courier pages are single-column and mobile-oriented.
- Delivery detail exposes the right operational actions: WhatsApp, call, maps, pickup, start delivery, complete, fail.
- Cards use clear borders, readable text sizes, and generally meet minimum touch target requirements.
- Bottom-sheet patterns exist for complete and fail flows.

The biggest consistency problems are:

- Courier has its own layout system instead of adapting the Customer layout pattern.
- Courier uses a top tab navigation, while `DESIGN.md` requires shared bottom navigation behavior.
- Several Courier cards are strongly color-coded by delivery state, making the screen feel like a separate dispatch dashboard.
- Icons are a mix of inline SVG, emoji, and no shared icon system.
- Primary delivery actions are placed inline at the bottom of page content rather than in a sticky bottom action area.
- Empty and loading states are lighter than the Customer reference and do not consistently include a primary action.

Overall, Courier currently feels like:

> A functional courier operations module inside Dombi, but with noticeable design drift from the Customer reference.

---

## 2. Consistency Score

Score: 74 / 100

Rating: Needs Improvement

Reasoning:

- Mobile-first structure is mostly present.
- Card and form basics are usable.
- Operational flow is clear enough for daily use.
- Navigation, action placement, icon language, sheet styling, and shared component reuse are not yet aligned with `DESIGN.md`.

---

## 3. Screens Reviewed

| Screen | File | Reviewed Areas |
| --- | --- | --- |
| Courier Layout | `resources/js/layouts/courier-layout.tsx` | Header, navigation, background, flash, page padding |
| Courier Dashboard | `resources/js/pages/courier/dashboard.tsx` | Availability, shift controls, stats, active tasks, empty state |
| Delivery List / History | `resources/js/pages/courier/deliveries/index.tsx` | Header, filter, list cards, empty state, pagination |
| Delivery Detail | `resources/js/pages/courier/deliveries/show.tsx` | Header, customer card, address, contact actions, maps, items, sticky actions, sheets |
| Proof of Delivery Sheet | `resources/js/pages/courier/deliveries/show.tsx` | Complete sheet form and confirmation action |
| Failure Sheet | `resources/js/pages/courier/deliveries/show.tsx` | Failure reason choices, note field, submit action |
| Customer Layout Reference | `resources/js/layouts/customer-mobile-layout.tsx` | Background, top bar, bottom nav, safe-area content padding |
| Customer Orders Reference | `resources/js/pages/customer/orders/index.tsx` and `resources/js/pages/customer/orders/show.tsx` | Header, filters, cards, bottom sheets, sticky actions |

---

## 4. Critical Inconsistencies

### C1. Courier uses top tab navigation instead of shared bottom navigation

Severity: Critical

File:

- `resources/js/layouts/courier-layout.tsx:18`
- `resources/js/layouts/courier-layout.tsx:31`

Component:

- `CourierLayout`

Issue:

Courier navigation is embedded inside the sticky header as horizontal tabs. Customer uses fixed bottom navigation through `CustomerBottomNav`, and `DESIGN.md` explicitly defines Courier bottom navigation as:

```text
Tugas Saya
Riwayat
```

Why it breaks consistency:

- It changes the core navigation behavior between Customer and Courier.
- It makes Courier feel like a separate app shell.
- It reduces one-hand ergonomics because primary role navigation sits at the top.

Recommended fix:

Create a shared `CourierBottomNav` based on `resources/js/components/customer/bottom-nav.tsx`, or better, extract a generic `MobileBottomNav` and feed it role-specific items. Keep Courier header at the standard 56px and move `Tugas Saya / Riwayat` to bottom nav.

---

### C2. Courier primary actions are not sticky

Severity: Critical

File:

- `resources/js/pages/courier/deliveries/show.tsx:238`

Component:

- `CourierDeliveryShow`

Issue:

Primary actions such as `Ambil Pesanan`, `Mulai Antar`, `Selesaikan Pengiriman`, and `Gagal Antar` live inside the scroll content near the page bottom.

Why it breaks consistency:

- Customer order detail uses a sticky bottom action pattern through `StickyOrderActions`.
- `DESIGN.md` says primary actions should live at the bottom of card or sticky bottom area.
- For Courier, these actions are operationally time-sensitive and should remain available without long scrolling.

Recommended fix:

Move courier delivery actions into a sticky bottom action component, likely a shared `StickyActionBar` that can also support Customer and Outlet flows. Preserve safe-area padding with `env(safe-area-inset-bottom)`.

---

## 5. Major Inconsistencies

### M1. Courier layout background does not match Customer reference

Severity: Major

File:

- `resources/js/layouts/courier-layout.tsx:16`
- `resources/js/layouts/customer-mobile-layout.tsx:30`

Component:

- `CourierLayout`

Issue:

Courier uses `bg-[#f8f7f2]`, while Customer uses `bg-[#fbf9f7]`.

Why it breaks consistency:

- It creates a subtle but visible role-specific palette.
- `DESIGN.md` says no role-specific color palettes; every role must remain Dombi.

Recommended fix:

Align Courier to the same app background token used by Customer, ideally through a shared layout token instead of hardcoded hex values.

---

### M2. Courier header is a role-specific app shell

Severity: Major

File:

- `resources/js/layouts/courier-layout.tsx:18`
- `resources/js/layouts/courier-layout.tsx:21`
- `resources/js/layouts/courier-layout.tsx:29`

Component:

- `CourierLayout`

Issue:

Header displays `Dombi Courier`, online status, logout, and role nav. Customer pages use simpler task-specific headers or `CustomerTopBar` patterns.

Why it breaks consistency:

- `DESIGN.md` requires standard header structure: Title, optional subtitle, optional action.
- Courier header is doing too many jobs: app branding, availability state, logout, and navigation.
- Logout in the primary header is not aligned with Customer profile/account navigation.

Recommended fix:

Use a standard role header with title such as `Tugas Saya` or `Riwayat`. Move logout into profile/account area or a `Lainnya` sheet if Courier later gains a More menu. Keep availability as a dashboard card or compact status chip, not a permanent header concern.

---

### M3. Dashboard cards are too state-colored and feel dispatch-dashboard-like

Severity: Major

File:

- `resources/js/pages/courier/dashboard.tsx:123`
- `resources/js/pages/courier/dashboard.tsx:156`
- `resources/js/pages/courier/dashboard.tsx:185`
- `resources/js/pages/courier/dashboard.tsx:257`

Component:

- `CourierDashboard`
- `StatCard`

Issue:

Active sections use strong blue, amber, and red tinted cards. Stats use a four-color dashboard grid.

Why it breaks consistency:

- Customer reference uses mostly white cards with light borders and restrained accent states.
- `DESIGN.md` says Dombi should avoid heavy admin panels and role-specific palettes.
- The four-color stat grid reads more like operations analytics than a courier task interface.

Recommended fix:

Use white cards with neutral border as the default. Apply status badges or small accent strips for state instead of making entire cards blue/amber/red. Replace the 4-column stat grid with a compact task summary card or two-row scan pattern on 360px screens.

---

### M4. Icons are inconsistent and not shared

Severity: Major

File:

- `resources/js/pages/courier/dashboard.tsx:143`
- `resources/js/pages/courier/dashboard.tsx:146`
- `resources/js/pages/courier/dashboard.tsx:244`
- `resources/js/pages/courier/deliveries/show.tsx:151`
- `resources/js/pages/courier/deliveries/show.tsx:170`
- `resources/js/pages/courier/deliveries/show.tsx:263`
- `resources/js/pages/courier/deliveries/show.tsx:272`

Component:

- `CourierDashboard`
- `CourierDeliveryShow`

Issue:

Courier uses emoji for operational actions and manually embedded SVG for phone/maps/WhatsApp.

Why it breaks consistency:

- Customer order pages use `lucide-react` icons consistently.
- `DESIGN.md` asks for consistent components and visual language.
- Emoji action labels make Courier feel less polished and different from Customer.

Recommended fix:

Use `lucide-react` icons for operational actions: `PackageCheck`, `Navigation`, `CheckCircle2`, `XCircle`, `Phone`, `MapPin`, `MessageCircle`. Extract shared icon button/action row patterns where useful.

---

### M5. Bottom sheets do not match Customer sheet style

Severity: Major

File:

- `resources/js/pages/courier/deliveries/show.tsx:303`
- `resources/js/pages/courier/deliveries/show.tsx:366`
- `resources/js/pages/customer/orders/show.tsx:249`

Component:

- `CompleteSheet`
- `FailSheet`

Issue:

Courier sheets use `rounded-t-2xl`, `bg-black/50`, no drag handle, no safe-area bottom padding, and less refined spacing. Customer cancellation sheet uses `rounded-t-3xl`, drag handle, `bg-slate-950/40`, safe-area padding, and clearer mobile hierarchy.

Why it breaks consistency:

- Sheets are a core interaction pattern in Dombi.
- Courier sheets feel more like ad hoc modals than shared Dombi bottom sheets.
- Lack of safe-area padding can make submit buttons feel cramped on iPhone.

Recommended fix:

Extract a shared `BottomSheet` component from Customer's cancel sheet pattern. Use it for Courier complete/fail sheets, Customer recovery/cancel sheets, and future Outlet/Owner sheets.

---

### M6. Delivery list uses desktop-style select filter instead of mobile chips/sheet

Severity: Major

File:

- `resources/js/pages/courier/deliveries/index.tsx:14`
- `resources/js/pages/courier/deliveries/index.tsx:16`
- `resources/js/pages/customer/orders/index.tsx:85`

Component:

- `CourierDeliveriesIndex`

Issue:

Courier history uses a native `select` in the page header. Customer orders use filter chips in a sticky header.

Why it breaks consistency:

- The native select feels less like the Customer UI.
- It is harder to scan quickly than visible chips for common status filters.
- It creates a different navigation/filter behavior for similar history screens.

Recommended fix:

Reuse or generalize `OrderFilterChips` into `FilterChips`, or move advanced filters into a bottom sheet. For Courier, visible chips for `Semua`, `Pickup`, `Diantar`, `Selesai`, `Gagal` would align better.

---

### M7. Delivery detail lacks status timeline despite data being available

Severity: Major

File:

- `resources/js/pages/courier/deliveries/show.tsx:46`
- `resources/js/pages/courier/deliveries/show.tsx:109`
- `resources/js/pages/customer/orders/show.tsx:125`

Component:

- `CourierDeliveryShow`

Issue:

`status_histories` is present in the data type but is not rendered. Customer order detail renders `OrderTimeline`.

Why it breaks consistency:

- Tracking clarity is a core Dombi pattern.
- Courier needs operational context, especially after failed/retry/returned flows.
- Omitting timeline makes Courier less transparent than Customer even though it has more operational responsibility.

Recommended fix:

Create shared `StatusTimeline` that supports order and delivery histories, or adapt Customer `OrderTimeline` into a generic timeline component.

---

## 6. Minor Inconsistencies

### m1. Courier cards use `rounded-lg`, Customer commonly uses `rounded-xl`

Severity: Minor

File:

- `resources/js/pages/courier/dashboard.tsx:72`
- `resources/js/pages/courier/dashboard.tsx:132`
- `resources/js/pages/courier/deliveries/index.tsx:38`
- `resources/js/pages/courier/deliveries/show.tsx:123`

Issue:

Most Courier cards use `rounded-lg`, while Customer core cards commonly use `rounded-xl`.

Recommended fix:

Normalize high-level cards to `rounded-xl`. Keep `rounded-lg` for internal controls or smaller nested elements.

---

### m2. Courier list spacing is tighter than Customer list spacing

Severity: Minor

File:

- `resources/js/pages/courier/deliveries/index.tsx:33`
- `resources/js/pages/customer/orders/index.tsx:184`

Issue:

Courier delivery list uses `space-y-2`, while Customer order history uses `space-y-3`.

Recommended fix:

Use `space-y-3` for primary card lists unless there is a strong operational density reason.

---

### m3. Empty state lacks primary action

Severity: Minor

File:

- `resources/js/pages/courier/dashboard.tsx:241`
- `resources/js/pages/courier/deliveries/index.tsx:28`
- `resources/js/components/empty-state.tsx:1`

Issue:

Courier empty states show icon/title/description but no primary action. `DESIGN.md` says every empty state should include Icon, Title, Description, Primary Action.

Recommended fix:

Extend shared `EmptyState` to accept `actionLabel` and `actionHref` or `action`. For Courier dashboard, likely action is `Refresh` or `Lihat Riwayat`; for Offline state, action is `Go Online`.

---

### m4. Badge labels are in English

Severity: Minor

File:

- `resources/js/components/delivery-status-badge.tsx:13`

Issue:

Delivery status badge labels use `Waiting Pickup`, `Picked Up`, `Delivering`, `Failed`, while Customer-facing status labels are localized.

Recommended fix:

Use Indonesian labels consistently: `Menunggu Pickup`, `Sudah Diambil`, `Sedang Diantar`, `Selesai`, `Gagal`. Consider centralizing delivery status labels with order status labels.

---

### m5. Loading state is text-only

Severity: Minor

File:

- `resources/js/pages/customer/orders/index.tsx:130` for Customer reference pattern gap
- Courier pages: no visible skeleton loading state found

Issue:

No Courier skeleton loading state was found. Customer order recovery still uses text loading, so this is a broader shared gap, not Courier-only.

Recommended fix:

Introduce shared skeleton card components for lists and task cards, then use them across Customer and Courier.

---

## 7. Navigation Consistency Review

Current Courier behavior:

- Header is sticky.
- Navigation is a top segmented/tab row.
- No fixed bottom navigation.
- Detail page does not include a standard back button in its local header.

Customer reference behavior:

- Customer app has fixed bottom navigation for primary role routes.
- Detail pages often use a focused sticky header with a back affordance.
- Sheets and sticky actions keep high-frequency actions close to thumb reach.

Assessment:

Courier navigation is the most visible source of design drift. It should be aligned before adding more Courier features.

Recommended target:

- `CourierLayout` should have a shared role header and fixed bottom nav.
- Delivery detail should use a sticky header with back button, title, and status/subtitle.
- Primary actions should live in a sticky bottom action bar.

---

## 8. Card System Audit

Cards reviewed:

- Availability card
- Stat cards
- In-transit delivery card
- Waiting pickup card
- Needs-action card
- Completed card
- Delivery history card
- Customer/address card
- Outlet card
- Order items card
- Proof/failure info cards

Observations:

- Most cards are readable and mobile-sized.
- `p-4` is consistent on larger cards.
- Cards are not overloaded individually.
- Dashboard sections rely too heavily on full-card status color.
- `rounded-lg` is used widely where Customer uses `rounded-xl`.
- Delivery detail has many separate cards; scanability is acceptable, but the primary action is too far down the page.

Cards that feel dashboard-like/admin-like:

- Four-column stat grid in `CourierDashboard`.
- Full-color active delivery cards for blue/amber/red states.
- Native select filter in Delivery List.

---

## 9. Action Consistency Review

Actions reviewed:

- `Go Online`
- `Go Offline`
- `Mulai Shift`
- `Akhiri Shift`
- `Ambil Pesanan`
- `Mulai Antar`
- `Selesaikan Pengiriman`
- `Gagal Antar`
- `WhatsApp`
- `Telepon`
- `Buka di Google Maps`

Findings:

- Most actions meet 44px minimum touch target.
- Primary buttons are generally full-width where they matter.
- Availability and shift actions are too compact for courier field use.
- Delivery state actions should be sticky.
- Icons should move from emoji/manual SVG to shared icon components.
- Destructive action `Gagal Antar` is visually clear but should sit in a consistent secondary/danger pattern in a sticky action area.

---

## 10. Mobile Field Test Assessment

Static review for target widths:

- 360x800
- 390x844
- 412x915

Potential issues:

- Dashboard stat grid uses 4 columns; on 360px this leaves narrow cards and `text-2xl` values can feel cramped.
- Availability bar has two compact side-by-side controls; on narrow screens the button text can crowd.
- Delivery detail has long scroll before primary action if address, outlet, items, proof/failure cards are present.
- Delivery list header places title and select in one row; long labels or localized status text can crowd on 360px.
- Bottom sheets lack explicit safe-area bottom padding.

No horizontal overflow was obvious from static class review, but a browser viewport pass should still verify 360x800 and iPhone safe-area behavior before implementation.

---

## 11. Empty, Loading, and Error State Review

Empty states:

- Dashboard empty state exists but is custom and lacks a primary action.
- Delivery list uses shared `EmptyState`, but shared `EmptyState` itself lacks primary action support.
- No dedicated Offline state card was found; availability appears as a compact status card.

Loading states:

- Courier uses polling but does not show skeleton refresh/loading states.
- No blocking spinner found, which is good.
- Shared skeleton patterns are not yet established.

Error states:

- Fail sheet shows validation errors.
- Complete sheet has no visible field-level error handling for `delivered_to` or `delivery_note`.
- Delivery detail does not show a general error banner beyond shared flash success.

---

## 12. Design Drift Issues

1. Courier top navigation instead of bottom nav.
2. Courier-specific header with `Dombi Courier` branding.
3. Different app background color.
4. Status cards use strong full-card color fills.
5. `rounded-lg` cards instead of Customer-style `rounded-xl`.
6. Emoji and manual SVG icons.
7. Native select filter instead of chips or bottom sheet.
8. Delivery action buttons are not sticky.
9. Bottom sheet styling differs from Customer.
10. Delivery status labels are English while Customer labels are Indonesian.
11. Empty states lack primary actions.
12. Delivery timeline data exists but is not rendered.

---

## 13. Shared Component Opportunities

Recommended shared components:

- `MobileRoleLayout`
  - Unify background, safe-area padding, max width, flash rendering, and optional top/bottom nav slots.

- `MobileBottomNav`
  - Use for Customer, Courier, Owner, Outlet.
  - Accept `items`, `activeMatcher`, and icon components.

- `MobilePageHeader`
  - Standard 56px header with title, optional subtitle, optional back/action.

- `BottomSheet`
  - Shared sheet shell with overlay, drag handle, rounded top, safe-area padding, close button.

- `StickyActionBar`
  - Shared bottom action area for checkout, customer order actions, courier delivery actions, outlet processing actions.

- `StatusBadge`
  - Shared tone-based badge system: Pending, Success, Warning, Danger, Info.
  - Delivery and order badges should map domain statuses into these tones.

- `EmptyState`
  - Add primary action support and optional secondary action.

- `TaskCard` / `OperationalCard`
  - Shared card for order/delivery task summaries.

- `ContactActionRow`
  - Shared phone, WhatsApp, maps action row for Courier and Customer tracking.

---

## 14. Priority Fix List

### Priority 1

1. Replace Courier top tabs with shared bottom navigation.
2. Move delivery detail primary actions into sticky bottom action bar.
3. Convert Courier sheets to shared BottomSheet pattern.

### Priority 2

4. Align `CourierLayout` background, header, max width, and bottom padding with Customer layout.
5. Replace emoji/manual SVG icons with shared lucide icons.
6. Render delivery timeline using shared timeline component.
7. Replace delivery list select with chips or filter sheet.

### Priority 3

8. Normalize card radius and list spacing.
9. Convert full-color task cards into white cards with badges/accent indicators.
10. Localize delivery status badge labels.
11. Extend `EmptyState` to include a primary action.
12. Add shared skeleton card loading states.

---

## 15. Final Recommendation

Do not build more Courier features yet.

First, align Courier shell and delivery detail with Customer patterns:

1. Shared mobile layout.
2. Shared bottom nav.
3. Shared sticky action bar.
4. Shared bottom sheet.
5. Shared status badge/timeline language.

This will make Courier feel like Dombi while preserving the operational hardening already in place.
