# OWNER DESKTOP UI AUDIT

Audit date: 2026-06-04  
Scope: Owner Dashboard, Orders, Deliveries, Inventory, Restocks, Distributions, Reports, Settings/Profile, and detail pages.  
Audit type: UI/UX and information architecture review only. No implementation changes were made.

## Executive Summary

Owner UI is functionally broad: the main operational modules are present, the sidebar exposes most modules on desktop, and several high-value intelligence components already exist for delivery health, SLA violations, courier performance, restock distribution, and inventory state.

The main issue is not missing backend capability. The issue is desktop operational composition. A number of Owner pages still behave like mobile card feeds placed inside a desktop shell. This reduces information density, weakens scanability, and hides some high-impact actions and filters. Owner is a decision-making role; the interface should help them understand business health within 10 seconds and then drill into exceptions quickly.

The strongest areas are delivery board structure and restock detail visibility. The weakest areas are OwnerPageShell desktop behavior, dashboard desktop hierarchy, table/filter consistency, and action discoverability on desktop.

Current answer to "Can owner understand business health within 10 seconds?": partially. The dashboard surfaces core KPI values and delivery health, but operational alerts, outlet health, recent stock movement, restock pressure, and decision shortcuts are not equally visible on desktop.

## Scores

Consistency Score: 6.8 / 10

Desktop Usability Score: 6.2 / 10

Operational Awareness Score: 6.5 / 10

Decision-Making Readiness Score: 6.0 / 10

## Strengths

- Desktop sidebar in [owner-layout.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/layouts/owner-layout.tsx:7) exposes the major Owner modules: Dashboard, Outlet, Produk, Inventory, Orders, Deliveries, Restocks, Distribution, Audit Trail, Reports.
- Delivery dashboard intelligence exists: health score, SLA violations, oldest deliveries, failure reasons, and courier leaderboard are rendered on desktop in [dashboard.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/dashboard.tsx:232).
- Delivery Board has an operational kanban-like desktop layout with assignment and issue-resolution paths in [board.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/deliveries/board.tsx:124).
- Restock detail has strong operational continuity: distribution card, approval/rejection panels, shipment status, timeline, and notes are visible in [show.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/restocks/show.tsx:61).
- Inventory page correctly foregrounds available stock, reserved stock, low stock, and critical count, which are decision-relevant inventory metrics in [index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/inventories/index.tsx:70).

## Critical Findings

### Critical 1: OwnerPageShell hides desktop page actions

Evidence:
- [owner-page-shell.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/components/owner/owner-page-shell.tsx:26) renders the desktop branch with only `OwnerLayout`, `Head`, and `{children}`.
- The same component only passes `title`, `subtitle`, `backHref`, and `headerRight` into `OwnerMobileHeader` in the mobile branch at [owner-page-shell.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/components/owner/owner-page-shell.tsx:39).
- Pages relying on `headerRight` include Deliveries filters/search in [deliveries/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/deliveries/index.tsx:33), Delivery Board filters in [board.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/deliveries/board.tsx:49), Restocks filters in [restocks/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/restocks/index.tsx:28), Distributions filters in [distributions/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/distributions/index.tsx:30), Reports export/filter in [reports/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/reports/index.tsx:26), Products search/create in [products/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/products/index.tsx:9), and Outlets create action in [outlets/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/outlets/index.tsx:15).

Root cause: the shared Owner shell treats desktop as a pass-through layout instead of a desktop page header system.

Business risk: Owner may not discover filter, export, search, create, or operational action controls on large screens. This directly reduces operational speed.

Safe fix direction: add a desktop header region to `OwnerPageShell` that renders title, subtitle, back action, and headerRight consistently above children.

### Critical 2: Desktop dashboard drops operational alert context available on mobile

Evidence:
- Mobile dashboard shows operational alerts for failed deliveries, low stock, and pending restocks in [dashboard.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/dashboard.tsx:61).
- Mobile dashboard also shows recent activity, outlet health, and quick actions in [dashboard.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/dashboard.tsx:156) and [dashboard.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/dashboard.tsx:181).
- Desktop dashboard renders KPIs and delivery intelligence, but only failed deliveries get a dedicated alert link at [dashboard.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/dashboard.tsx:240).

Root cause: desktop and mobile dashboards are separate implementations, and mobile has more operational exception surfaces than desktop.

Business risk: Owner on desktop can miss low stock and pending restock pressure even though this role is supposed to monitor inventory and make decisions.

Safe fix direction: promote operational alerts, recent stock movement, outlet health, and quick actions into desktop dashboard. Use desktop-appropriate density, not mobile horizontal strips.

### Critical 3: Owner desktop uses card feeds where decision tables are more appropriate

Evidence:
- Orders desktop renders `OwnerOrderCard` list, not a table, in [orders/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/orders/index.tsx:131).
- Deliveries index renders delivery cards, not a table, in [deliveries/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/deliveries/index.tsx:48).
- Restocks index renders request cards in [restocks/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/restocks/index.tsx:40).
- Distributions index renders shipment cards in [distributions/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/distributions/index.tsx:42).
- Stock Movements renders compact rows without table sorting or explicit column headers in [stock-movements/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/stock-movements/index.tsx:35).

Root cause: mobile-first operational card patterns were reused as default Owner desktop presentation.

Business risk: Owner cannot compare many records quickly by status, outlet, date, courier, total, or urgency. Scanability suffers as order volume grows.

Safe fix direction: keep cards for mobile, but introduce desktop tables for Orders, Deliveries, Restocks, Distributions, Products, and Stock Movements where comparison and sorting matter.

## Major Findings

### Major 1: Filter discoverability is inconsistent across modules

Evidence:
- Orders has inline desktop filters for search, status, outlet, and date in [orders/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/orders/index.tsx:119).
- Deliveries, Restocks, Distributions, Stock Movements, and Reports rely on `FilterSheet` opened from `headerRight`, but that area is not rendered on desktop by `OwnerPageShell`.
- Reports has inline date filters but outlet filter and CSV export are placed in `headerRight` in [reports/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/reports/index.tsx:26).

Impact: Owner cannot build a consistent habit for filtering operational data. Some filters are visible, some are hidden, and some are effectively missing on desktop.

Recommendation: standardize desktop filters as an inline toolbar above the data view. Bottom sheets can remain for mobile.

### Major 2: Action discovery differs between desktop and mobile

Evidence:
- Mobile Orders index passes `onAssign` into `OwnerOrderCard` in [orders/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/orders/index.tsx:100), but desktop card only gets `onSelect` at [orders/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/orders/index.tsx:135).
- Mobile order detail has a Resolve Issue action path using `ResolveDeliverySheet` in [orders/show.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/orders/show.tsx:199), while desktop order detail does not expose equivalent action in [orders/show.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/orders/show.tsx:224).
- Inventory adjustment actions are icon-only and 32px on desktop in [inventories/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/inventories/index.tsx:153).

Impact: Owner actions are available, but not predictably located. Important actions require drilling into detail pages or are visually underweighted.

Recommendation: use explicit desktop action columns in tables and a consistent detail-page action rail for Assign, Resolve, Approve, Reject, Mark Shipped, and Adjust Stock.

### Major 3: Dashboard desktop width and density are not optimized for large screens

Evidence:
- Owner content is capped at `max-w-6xl` in [owner-layout.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/layouts/owner-layout.tsx:56).
- Desktop dashboard KPI grid uses fixed sections with `lg:grid-cols-4`, `lg:grid-cols-5`, and `lg:grid-cols-2` in [dashboard.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/dashboard.tsx:204), [dashboard.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/dashboard.tsx:223), and [dashboard.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/dashboard.tsx:233).

Impact at 1440px/1920px: layout likely leaves significant unused whitespace while still not presenting enough operational context.

Recommendation: use a desktop operational workspace grid, for example KPI/alerts row, live operations column, inventory/restock column, and activity column. Consider increasing max width for Owner desktop only.

### Major 4: Status vocabulary has drift across Owner UI

Evidence:
- Orders filter includes newer statuses such as `pending_confirmation`, `rejected_by_outlet`, `cancelled_by_customer`, and `failed_delivery` in [orders/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/orders/index.tsx:13).
- Mobile order status headline still maps old statuses `pending`, `cancelled`, and `failed` in [orders/show.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/orders/show.tsx:293).
- Reports status labels still use older labels like `pending`, `cancelled`, and `failed` in [reports/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/reports/index.tsx:8).

Impact: dashboards, reports, and detail pages may label the same operational state differently. This undermines trust during demos and real operations.

Recommendation: centralize order, delivery, restock, and distribution status labels in a shared status mapping library and use it across all Owner pages.

### Major 5: Shared UI foundation adoption is incomplete

Evidence:
- Shared components exist: `resources/js/components/ui/status-badge.tsx`, `bottom-sheet.tsx`, `page-header.tsx`, `section-card.tsx`, and `empty-state.tsx`.
- Owner pages often use role-specific components or raw markup: `rounded-lg border bg-white`, `rounded-2xl border`, custom badges, and local KPI components.
- Legacy `EmptyState` from `resources/js/components/empty-state.tsx` is imported in Owner pages such as [deliveries/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/deliveries/index.tsx:3), [restocks/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/restocks/index.tsx:3), and [stock-movements/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/stock-movements/index.tsx:3).

Impact: Owner feels related to Dombi, but implementation patterns drift. Maintenance cost rises as each role invents small variations.

Recommendation: use shared `PageHeader`, `SectionCard`, `StatusBadge`, `BottomSheet`, and action button primitives first. Role-specific components should compose those foundations.

### Major 6: Distribution detail page is underbuilt compared to restock detail

Evidence:
- Restock detail has structured cards, timeline, distribution summary, notes, and action handling in [restocks/show.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/restocks/show.tsx:40).
- Distribution detail is compressed into a single return line with minimal structure in [distributions/show.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/distributions/show.tsx:6).

Impact: Once owner enters the Distribution module directly, the experience drops from operational workflow to basic CRUD detail.

Recommendation: align Distribution detail with Restock detail: shipment status, outlet, sender, timestamps, item manifest, related restock, timeline, and clear Mark Shipped action.

## Minor Findings

### Minor 1: Language mix reduces operational polish

Evidence:
- Sidebar labels mix Indonesian and English: Outlet, Produk, Inventory, Orders, Deliveries, Restocks, Distribution, Audit Trail, Reports in [owner-layout.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/layouts/owner-layout.tsx:7).
- Delivery status labels are English in [deliveries/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/deliveries/index.tsx:11).
- Restock detail mixes Indonesian and English: `Distribution Status`, `Waiting Outlet Confirmation`, `Approve & Create Distribution`, and `Warehouse stock management belum aktif` in [restocks/show.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/restocks/show.tsx:104).

Recommendation: choose Indonesian operational labels for production use, with English only where it is a known domain term.

### Minor 2: Card radius and shadow usage are inconsistent

Evidence:
- Owner pages use `rounded-lg`, `rounded-xl`, `rounded-2xl`, `shadow-sm`, dashed cards, and raw white cards across modules.
- Restock detail uses `rounded-2xl` and `shadow-sm` in [restocks/show.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/restocks/show.tsx:43), while Orders desktop uses `rounded-lg` in [orders/show.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/orders/show.tsx:236).

Recommendation: standardize desktop card anatomy. For Owner desktop, use subtle borders and predictable radii; avoid decorative depth unless indicating overlays.

### Minor 3: Some text is too small for fast desktop scanning

Evidence:
- Inventory uses `text-[9px]` and `text-[10px]` for labels and metadata in [inventories/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/inventories/index.tsx:106), [inventories/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/inventories/index.tsx:148), and [inventories/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/inventories/index.tsx:170).
- Reports uses `text-[9px]` KPI labels in [reports/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/reports/index.tsx:74).
- Stock movements uses `text-[9px]` timestamps in [stock-movements/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/stock-movements/index.tsx:47).

Recommendation: keep metadata compact, but prefer 11-12px minimum for desktop operational scanning.

### Minor 4: Some action targets are below the shared touch target standard

Evidence:
- Product actions use `min-h-[36px]` in [products/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/products/index.tsx:45).
- Inventory edit buttons use `h-8 w-8` in [inventories/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/inventories/index.tsx:153).

Recommendation: desktop can be denser than mobile, but critical operational actions should still be easy to hit. Use at least 36-40px for secondary actions and 44px for primary/destructive actions.

### Minor 5: Empty states are not consistently actionable

Evidence:
- Products empty state is custom and has no primary action in [products/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/products/index.tsx:20).
- Deliveries and Restocks use legacy `EmptyState` without action buttons in [deliveries/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/deliveries/index.tsx:45) and [restocks/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/restocks/index.tsx:37).

Recommendation: use shared empty state with primary actions where applicable: Tambah Produk, Tambah Outlet, Lihat Orders, or Reset Filter.

## Table Review

Tables identified: no true desktop data tables were found in the audited Owner index pages. The system uses card rows and grouped cards for Orders, Deliveries, Restocks, Distributions, Products, Inventory, Reports, and Stock Movements.

Assessment:
- Orders: needs desktop table with order code, customer, outlet, fulfillment, total, status, created time, SLA/age, and action column.
- Deliveries: needs desktop table for normal list view; board can remain kanban for operational dispatch.
- Inventory: grouped outlet cards are useful, but a dense SKU table view or sortable inventory matrix would improve stock comparison.
- Restocks: request cards are acceptable for mobile; desktop should support table columns for request id, outlet, status, requested qty, approved qty, created time, and next action.
- Distributions: table view would help compare preparing/shipped/completed shipments and surface overdue confirmations.
- Reports: tables are not currently necessary, but the breakdown cards should become more desktop-dense and export/filter controls must be visible.
- Stock Movements: this module is audit-log-like and would benefit strongly from columns, sticky header, date range, type, outlet, product, before/after, reference, creator, and timestamp.

## Filter Review

Orders: best current desktop filter implementation. Inline search/status/outlet/date controls are visible in [orders/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/orders/index.tsx:119). Search only applies on blur, which is lower feedback than an explicit Apply button or debounced search.

Deliveries: filter exists but is tied to `headerRight` and `FilterSheet`, which is effectively mobile-first in [deliveries/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/deliveries/index.tsx:33).

Delivery Board: filter exists but is also in `headerRight` in [board.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/deliveries/board.tsx:49). Desktop board needs visible outlet/courier/date controls because dispatch decisions depend on them.

Inventory: no visible desktop filter/search in [inventories/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/inventories/index.tsx:62). Owner cannot quickly isolate low stock, critical, product, or outlet.

Reports: date filters are visible, but outlet filter and CSV export are in `headerRight` in [reports/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/reports/index.tsx:26). This is a major desktop issue.

Stock Movements: filter exists in `FilterSheet`, but not visible on desktop in [stock-movements/index.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/stock-movements/index.tsx:23).

## Dashboard Review

KPI visibility: acceptable, but not yet decision-grade. Core KPIs are visible in [dashboard.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/dashboard.tsx:204), but active orders, failed deliveries, pending restocks, and low stock need a clearer exception hierarchy.

Alert visibility: weak on desktop. Failed deliveries are shown, but low stock and pending restock alerts that exist on mobile are not shown as dedicated alert cards.

Delivery intelligence: strong foundation. Delivery health, SLA violations, oldest deliveries, failure reasons, and courier leaderboard are valuable.

Inventory intelligence: underrepresented. Dashboard has low stock KPI only, but not a list of most urgent outlets/SKUs on desktop.

Courier intelligence: present through leaderboard, but active courier capacity and unassigned pressure are more visible in Delivery Board than dashboard.

Noise/redundancy: low noise, but the desktop dashboard is currently too sparse for Owner decision-making.

## Shared UI Foundation Adoption

StatusBadge: partially adopted through role/domain-specific badges such as `OrderStatusChip`, `RestockStatusBadge`, and `DistributionStatusBadge`. Shared `ui/status-badge.tsx` is not the dominant abstraction.

BottomSheet: adopted for mobile operational actions like filters, assignment, inventory adjustment, and resolve delivery. Desktop needs visible toolbar/actions first, with sheets used for focused edits.

PageHeader: not consistently adopted. `OwnerPageShell` accepts header metadata but does not render desktop header.

SectionCard: underused. Many pages use local raw card markup instead of shared card foundations.

EmptyState: legacy and shared versions both exist. Owner mostly imports legacy `components/empty-state.tsx`.

## Design Drift Detection

Critical drift:
- Desktop Owner still inherits mobile-first interaction placement through `OwnerPageShell`.
- Desktop pages use card feeds where desktop decision tables would better fit Owner goals.

Major drift:
- Status labels and status vocabularies differ across Orders, Reports, and detail views.
- Detail page richness differs by module and viewport; restock is operationally mature, distribution is basic, order mobile is richer than order desktop.
- Filter systems vary by page.

Minor drift:
- Mixed English/Indonesian labels.
- Inconsistent radius/shadow/card anatomy.
- Emoji appears in empty states and export button, which is less aligned with operational desktop tone.

## Desktop Responsiveness Review

1280px:
- Sidebar consumes 240px in [owner-layout.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/layouts/owner-layout.tsx:30), leaving around 1040px before content padding. Delivery Board uses 5 columns at [board.tsx](/Users/aryaajisadda/Herd/dombi/resources/js/pages/owner/deliveries/board.tsx:125), which may feel cramped for item cards.

1440px:
- `max-w-6xl` works for many pages, but dashboard and reports underuse available width. The Owner workspace can support more operational context without becoming cluttered.

1920px:
- `max-w-6xl` creates substantial unused space. This is acceptable for readability in consumer flows, but Owner operational monitoring should use more of the workspace for alerts, tables, and side panels.

## Priority Fix List

1. Fix `OwnerPageShell` desktop header so `title`, `subtitle`, `backHref`, and `headerRight` are visible on desktop.
2. Promote desktop dashboard operational alerts: failed deliveries, low stock, pending restocks, urgent inventory, and recent stock movements.
3. Introduce desktop data tables for Orders, Deliveries list, Restocks, Distributions, Products, and Stock Movements while keeping cards for mobile.
4. Standardize desktop filter toolbars across Orders, Deliveries, Inventory, Reports, Restocks, Distributions, and Stock Movements.
5. Centralize status label/color mappings for order, delivery, restock, distribution, stock movement, and report statuses.
6. Align action placement: table action columns for list pages and a right-side action rail for detail pages.
7. Upgrade Distribution detail to match the operational quality of Restock detail.
8. Expand Owner desktop max width or provide a workspace layout variant for dashboard/reporting screens.
9. Replace local raw cards and legacy empty states with shared `PageHeader`, `SectionCard`, `StatusBadge`, and actionable `EmptyState` foundations.
10. Normalize language, typography sizes, card radius, and icon style across Owner pages.

## Recommended Desktop Architecture Direction

Owner desktop should use:
- Persistent left sidebar for module navigation.
- Desktop page header with title, subtitle, primary action, export, and filters.
- KPI row for top-level health.
- Exception-first alert row.
- Dense table/list workspace with sticky filters.
- Right-side operational detail/action panel where appropriate.
- Card grids only for dashboards, summaries, and board columns, not default index pages.

This keeps Owner aligned with Dombi's shared visual language while honoring the Owner role's actual desktop-first job: monitor, compare, decide, and act quickly.

