# Inventory-Restock Merge — Design Spec

**Date:** 2026-07-18
**Status:** Approved (alternative B)
**Branch:** main

## Context

Outlet punya 2 menu: Inventaris (`/outlet/inventory`) dan Restock (`/outlet/restocks`). Fungsi terkait: inventory = state sekarang (current, reserved, min, center), restock = flow yang ubah state (`requested→preparing→shipped→completed` → `restock_in` movement). User mau ringkas jadi 1 menu Inventaris yang tracking invent + tracking restock.

## Goal

- 1 menu: Inventaris
- Inventory list jadi main, restock status jadi contextual badge + history
- Reduce navigation, mobile-first

## Architecture & Routes

- Single route: `/outlet/inventory` — render integrated view
- Keep `/outlet/restocks` + `/outlet/restocks/create` but redirect to `/outlet/inventory` (backward compat, optional `?action=restock&variant_id=X`)
- Remove Restock item from `outlet/navigation-sheet.tsx`
- No new dependency, no new route

## Data Flow

**Controller:** `Outlet/InventoryController::__invoke`

Existing:
- `families`, `inventories`, `centerStocks`, `outlet`

Add:
- `$activeRequests = RestockRequest where outlet_id, status in [requested,preparing,shipped] with items.variant.family, latest 20`
- `$activeMap = []`:
  ```
  activeRequests = query orderByDesc created_at
  foreach activeRequests as req:
    foreach req.items as item:
      if variant_id not in map:
        activeMap[item.product_variant_id] = {
          id: req.id,
          status: req.status,
          requested_qty: item.requested_quantity,
          approved_qty: item.approved_quantity,
          created_at: req.created_at
        }
  ```
  Latest active per variant wins (created_at desc).
- `$recentRestocks = RestockRequest where outlet_id, latest 10 with items.variant`

Return props:
- `activeRestocks: activeMap`
- `recentRestocks`

Frontend:
- `InventoryRow` prop `activeRestock?: {id,status,qty}`
- `FamilyGroup` pass `centerStocks` + `activeRestocks`

## UI Components

**File Map:**
- Modify: `resources/js/pages/outlet/inventory.tsx` — main integrated
- Modify: `app/Http/Controllers/Outlet/InventoryController.php` — add activeMap + recent
- Modify: `resources/js/components/outlet/navigation-sheet.tsx` or outlet layout — remove Restock menu
- Modify: `resources/js/pages/outlet/restocks/index.tsx` — add redirect or keep as fallback
- (Optional) Create: `resources/js/components/outlet/variant-detail-sheet.tsx` — bottom sheet 80 lines

**Layout `inventory.tsx`:**

```
Header: title Inventaris + search
KPI: critical/low/healthy counts (existing)
FamilyGroup:
  InventoryRow:
    left: variant name + health badge
    right: center badge + active restock badge (RestockStatusBadge) + opname btn
  tap Row → BottomSheet VariantDetailSheet:
    - Stock detail: current, reserved, available, min, pusat
    - Riwayat restock variant: filter recentRestocks where variant_id, show 3 latest (status, qty, date)
    - Actions: Opname, Buat Restock (disabled if active exists or center 0)

Footer Section: Riwayat Restock (collapsible)
  - List 5 latest from recentRestocks
  - Each: id, status badge, tanggal, total qty, outlet
  - Expand: link to /outlet/restocks/{id} (show page keep)
```

Reuse:
- `RestockCreateDialog` (fixed)
- `OpnameSheet` / BottomSheet
- `RestockStatusBadge`, `StatusBadge`
- `EmptyState`

## Logic & Validations

- Opname: actual < reserved → throw ValidationException (already fixed C2)
- Restock create:
  - Frontend disable if `activeRestocks[variant_id]` exists → tooltip "Ada restock aktif: {status}"
  - Disable if `centerStocks[variant_id] <=0` → tooltip "Stok pusat kosong"
  - Backend: existing StoreRestockRequest validasi product_variant_id + requested_quantity min:1, optional add check center >0
- Shipped→Completed gap: already has `restock:check-stuck` command daily 08:30
- No race: RestockService uses lockForUpdate

## Testing & Acceptance

Manual:
- [ ] Inventory page tampil, center badge muncul
- [ ] Active restock badge muncul jika ada request active
- [ ] Tap row → sheet detail stock + riwayat variant 3 latest
- [ ] Buat restock dari low stock row → 302 success, badge amber muncul
- [ ] Coba buat restock lagi same variant while active → disabled
- [ ] Opname below reserved → 422 toast
- [ ] Section Riwayat Restock bawah tampil 5 latest
- [ ] Menu outlet cuma Inventaris, Restock hilang
- [ ] /outlet/restocks redirect ke inventory (or keep but not in nav)
- [ ] npm run build pass, tsc --noEmit pass (except pre-existing 6 errors)

## File Changes

| Action | File | Purpose |
|--------|------|---------|
| MODIFY | `app/Http/Controllers/Outlet/InventoryController.php` | Add activeRestocks + recentRestocks |
| MODIFY | `resources/js/pages/outlet/inventory.tsx` | Integrated layout + active badge + detail sheet |
| MODIFY | `resources/js/components/outlet/navigation-sheet.tsx` | Remove Restock menu item |
| MODIFY | `resources/js/pages/outlet/restocks/index.tsx` | Optional redirect |
| CREATE | `resources/js/components/outlet/variant-detail-sheet.tsx` | Detail sheet (optional) |

No backend migration, no new deps.
