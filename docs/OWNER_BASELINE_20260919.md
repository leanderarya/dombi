# Owner baseline audit — 2026-09-19

Read-only inventory before the Owner slice of the UI/UX alignment plan. Counts
come from `grep`-level scanning of the working tree at commit `69087b0b`; re-run
the same scan to compare.

Scope: `resources/js/pages/owner/**` and `resources/js/components/owner/**` —
112 files. Owner imports 232 times from `components/ui`, so the primitives that
were moved onto tokens in `3be8582f` already carry much of its colour.

## Totals

| Metric | Count |
| --- | --- |
| Stock palette classes | **857** |
| Distinct classes | 111 |
| Files carrying palette | 79 (of 112) |
| Raw `<button>` elements | **111** |
| Touch targets under 44px | 4 (informational only — see below) |

Owner was estimated at 436 classes and 42 buttons earlier in the plan; the real
figure is about double that. The old number counted `pages/owner` only — the
`components/owner` directory, where more than half the work sits, was missed.

## Palette families

`emerald=274` · `slate=245` · `red=239` · `amber=155` · `blue=31` · `orange=11`
· `purple=10` · `indigo=8` · `zinc=4` · `violet=3`

Emerald is the largest family, which is the one decision Owner cannot inherit
directly: in Outlet it split cleanly per site into `primary` (selection, brand
actions) and `success` (money, availability). At 274 occurrences Owner will need
the same per-site reading, and `text-emerald-600` alone is 65 of them.

## Heaviest files

| Palette | Buttons | File |
| ---: | ---: | --- |
| 38 | 6 | `components/owner/outlet-products.tsx` |
| 38 | 1 | `pages/owner/dashboard.tsx` |
| 36 | 0 | `components/owner/resolve-delivery-sheet.tsx` |
| 35 | 2 | `components/owner/settlement-payment-modal.tsx` |
| 32 | 0 | `components/owner/order-status-chip.tsx` |
| 30 | 5 | `pages/owner/product-categories/product-form.tsx` |
| 29 | 4 | `components/owner/outlet-location-map.tsx` |
| 24 | 3 | `components/owner/tambah-produk-modal.tsx` |
| 24 | 3 | `components/owner/outlet-provisioning-summary.tsx` |
| 22 | 3 | `components/owner/restock-modal.tsx` |
| 21 | 4 | `components/owner/holiday-manager.tsx` |
| 20 | 0 | `pages/owner/inventories/index.tsx` |

## By area

| Area | Palette | Files | Buttons |
| --- | ---: | ---: | ---: |
| `components/owner` | **477** | 37 | **53** |
| `pages/owner/finance` | 55 | 5 | 3 |
| `pages/owner` (dashboard) | 46 | 2 | 3 |
| `pages/owner/product-categories` | 45 | 3 | 15 |
| `pages/owner/analytics` | 36 | 4 | 7 |
| `pages/owner/inventories` | 29 | 2 | 1 |
| `pages/owner/returns` | 29 | 3 | 7 |
| `pages/owner/restocks` | 28 | 2 | 0 |
| `pages/owner/pricing` | 22 | 5 | 4 |
| `pages/owner/couriers` | 21 | 3 | 2 |
| `pages/owner/deliveries` | 15 | 2 | 0 |
| `pages/owner/exchanges` | 13 | 2 | 0 |
| `pages/owner/product-families` | 12 | 3 | 9 |
| `pages/owner/outlets` | 8 | 2 | 5 |
| `pages/owner/courier-management`, `customers` | 6 each | 1 each | 0 |
| `pages/owner/delivery-tiers` | 5 | 1 | 1 |
| `pages/owner/orders` | 4 | 1 | 1 |

## Touch targets

Four candidates under 44px, and Owner is the one role the plan **exempts** from
the guarantee (D6). Recorded for completeness, not as work.

## Duplication this audit found

- **Three courier-assignment sheets.** `components/outlet/assign-courier-sheet.tsx`
  (64 palette classes, migrated in `f66f313d`), `components/owner/assign-courier-sheet.tsx`
  (for `pages/owner/orders`) and `components/operations/assign-courier-sheet.tsx`
  plus a `assign-courier-sheet-lifecycle` module (for `pages/outlet/deliveries`).
  One sheet, three copies, two consumers.
- **A fourth status component.** `components/owner/order-status-chip.tsx` (32
  classes) sits beside `ui/status-badge`, `ui/order-status-badge`,
  `ui/delivery-status-badge`, `ui/restock-status-badge` and
  `ui/stock-level-badge` — all of which now render from the token set.

## Proposed slices

`components/owner` first: 477 of the 857 classes and 53 of the 111 buttons, and
its heaviest files are the pieces the pages share, so one fix reaches many
screens — the same leverage the shared badge layer had in O.1.

| Slice | Scope | Palette | Buttons |
| --- | --- | ---: | ---: |
| **O5.1** | `components/owner`, shared pieces first (products, status chip, payment modal, delivery sheet, map, provisioning) | 477 | 53 |
| **O5.2** | `pages/owner/finance` + `pages/owner` dashboard | 101 | 6 |
| **O5.3** | product-categories, pricing, product-families | 79 | 28 |
| **O5.4** | analytics, inventories, returns, restocks | 122 | 15 |
| **O5.5** | couriers, courier-management, deliveries, exchanges, delivery-tiers, outlets, customers, orders | 78 | 9 |

## What carries over unchanged

The refresh boundary decided for Outlet — colour, typography and shared
components may move; flow, wording and navigation structure stay frozen — applies
to Owner too, and the O.1 mapping table covers it. Emerald is the only family
needing per-site reading rather than a rule.
