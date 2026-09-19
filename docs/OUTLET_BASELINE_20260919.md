# Outlet baseline audit — 2026-09-19

Read-only inventory before the Outlet slice of the UI/UX alignment plan.
Counts come from `grep`-level scanning of the working tree at commit
`95b6e442`; re-run the same scan to compare.

Scope: `resources/js/pages/outlet/**` and `resources/js/components/outlet/**`.

Palette classes counted as `(bg|text|border|from|to|ring|divide|placeholder|shadow|outline)-(<family>)-<shade>`.

## Totals

| Metric | Count |
| --- | --- |
| Palette classes | **268** |
| Raw `<button>` elements | **64** |
| Files affected | 28 (17 pages, 11 components) |
| Outlet pages overall | 26 |

## Hotspots

| Palette | Buttons | File |
| ---: | ---: | --- |
| 64 | 6 | `components/outlet/assign-courier-sheet.tsx` |
| 34 | 1 | `pages/outlet/settlement.tsx` |
| 21 | 3 | `pages/outlet/orders/index.tsx` |
| 21 | 0 | `pages/outlet/dashboard.tsx` |
| 13 | 6 | `components/outlet/exchange-create-dialog.tsx` |
| 13 | 5 | `pages/outlet/orders/show.tsx` |
| 13 | 0 | `pages/outlet/settlement-show.tsx` |
| 11 | 4 | `pages/outlet/inventory.tsx` |
| 9 | 2 | `pages/outlet/exchanges/create.tsx` |
| 9 | 1 | `pages/outlet/my-couriers/index.tsx` |
| 7 | 1 | `pages/outlet/restocks/show.tsx` |
| 7 | 0 | `components/outlet/outlet-dashboard-skeleton.tsx` |
| 6 | 6 | `pages/outlet/returns/create.tsx` |
| 6 | 1 | `pages/outlet/reports/index.tsx` |
| 6 | 0 | `pages/outlet/scan.tsx` |
| 5 | 2 | `pages/outlet/restocks/create.tsx` |
| 5 | 1 | `pages/outlet/deliveries/show.tsx` |
| 4 | 2 | `components/outlet/offline-sale-dialog.tsx` |
| 3 | 4 | `pages/outlet/offline-sales/index.tsx` |
| 3 | 0 | `pages/outlet/offline-sales/show.tsx` |
| 3 | 1 | `components/outlet/navigation-sheet.tsx` |
| 2 | 7 | `components/outlet/return-create-dialog.tsx` |
| 2 | 0 | `pages/outlet/settlement-payments.tsx` |
| 1 | 4 | `components/outlet/restock-create-dialog.tsx` |
| 0 | 3 | `pages/outlet/order-reports/show.tsx` |
| 0 | 2 | `pages/outlet/deliveries/index.tsx` |
| 0 | 1 | `pages/outlet/exchanges/show.tsx` |
| 0 | 1 | `pages/outlet/analytics/index.tsx` |

## Palette families

`red=122` · `emerald=66` · `slate=39` · `amber=29` · `zinc=5` · `blue=4` · `orange=2` · `indigo=1`

Only five families carry 99% of the load, and they map almost mechanically onto
existing tokens: red → `danger*`, emerald → `primary*`/`success*`, slate/zinc →
`text*`/`surface*`/`border*`, amber → `warning*`. That keeps O.1 small: one
mapping table, applied everywhere, rather than per-screen decisions.

## Touch targets under 44px

Four candidates, all the same shape — a `h-10 w-10` icon button inside a create
dialog: `exchange-create-dialog`, `offline-sale-dialog`, `restock-create-dialog`,
`return-create-dialog`. They sit in files that need the `<Button>` migration
anyway (O.2), so the fix rides along.

## Proposed slices

| Slice | Scope | Palette | Buttons |
| --- | --- | ---: | ---: |
| **O.1** | Mapping table + shared dialog/card/badge pieces | — | — |
| **O.2** | `components/outlet` dialogs: assign-courier, exchange/restock/return create, offline-sale, navigation-sheet | 83 | 26 |
| **O.3** | Transactional pages: orders, deliveries, inventory, scan, exchanges, returns, restocks, offline-sales, my-couriers | ~100 | 30 |
| **O.4** | Money and reports: settlement, settlement-show, settlement-payments, dashboard, reports, order-reports, analytics | ~83 | 8 |

`assign-courier-sheet.tsx` alone is 64 palette classes — nearly a quarter of the
role — so O.2 starts there.

## Decisions still open before O.1

1. **Refresh boundary** — D5 makes Outlet a *refresh*, not consistency-only.
   Which surfaces may move (colour, radius, spacing, typography) and which may
   not (flow, wording, navigation structure)?
2. **Visual reference** — no Outlet frames exist (`docs/design-references/`
   holds `Customer` only). Follow `DESIGN.md` and the token set, or draw Outlet
   frames first the way Customer was done?
3. **Dialog component** — one shared dialog shell for the six outlet dialogs,
   or reuse what exists?
