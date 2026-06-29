# Pricing Master Data Redesign

**Date:** 2026-06-27
**Status:** Draft
**Scope:** Owner role — Harga page (Pusat + Outlet + Riwayat tabs)

---

## Problem

The current "Pusat" tab is a navigation hub (outlet cards) that doesn't actually manage global prices. The "Outlet" tab does all the work but requires navigating through Pusat first. The mental model is broken: "Pusat" should manage center/global prices, not just link to outlet pricing.

## Current Architecture

- `ProductVariant.center_price` — HPP (cost price)
- `ProductVariant.selling_price` — Global default selling price
- `OutletVariantPrice.selling_price` — Per-outlet override (optional)
- When no override exists, outlet uses global `selling_price`

## Design

### Tab Structure

3 tabs with segmented control navigation:
1. **Pusat** — Kelola harga global (center_price + selling_price)
2. **Outlet** — Grid outlet → detail per-outlet pricing
3. **Riwayat** — Audit log perubahan harga

---

### Tab 1: Pusat — Kelola Harga Global

**Layout:** 2-column desktop (`lg:grid-cols-[1fr_320px]`)

**Left Column — Product List:**
- Search bar (cari produk by name, family, flavor, size)
- Margin filter dropdown: Semua / Margin Tinggi (>20rb) / Margin Rendah (<5rb) / Margin Negatif
- Sort buttons: Nama, HPP, Harga Jual, Margin
- Product cards (20/page pagination):
  - Product name + family name
  - `center_price` (HPP) — click "Ubah" → modal
  - `selling_price` (Harga Jual) — click "Ubah" → modal
  - `margin` = selling_price - center_price (auto-calculated, color-coded: green > 20k, yellow 5-20k, red < 5k, red+bold if negative)
- Empty state: "Belum ada produk aktif"

**Right Column — KPI Sidebar (desktop only, sticky):**
- Total Produk (active variant count)
- Rata-rata HPP (average center_price)
- Rata-rata Margin (average margin)
- Produk Margin Negatif (count, red highlight if > 0)

**Edit Modal:**
- Title: "Ubah Harga — {product_name}"
- Fields: HPP (center_price), Harga Jual (selling_price)
- Preview: margin = selling_price - center_price (live calculation)
- Warning if margin negative (non-blocking, shown as text)
- Warning if change affects outlets with overrides (show count, non-blocking)
- Save / Batal buttons (save always allowed, warnings are informational only)

**Backend:**
- `GET /owner/pricing?tab=pusat` — returns all active variants with center_price, selling_price, margin
- `PATCH /owner/pricing/variants/{variant}` — updates center_price and/or selling_price on ProductVariant
- Impact check: when updating center_price, warn if any outlet overrides would have negative margin

---

### Tab 2: Outlet — Grid → Detail

**View 1: Outlet Grid (default, no outlet_id param)**
- Grid layout: `sm:grid-cols-2 lg:grid-cols-3`
- Each card:
  - Outlet name
  - "X dari Y produk custom" (override count / total variants)
  - Badge: "Semua Standar" (green) or "Ada Custom" (blue)
- Empty state: "Belum ada outlet aktif"
- KPI sidebar: Total Outlet, Total Produk Override

**View 2: Outlet Detail (with outlet_id param)**
- Top bar:
  - Back arrow + outlet name
  - Dropdown to switch outlet (preserves search/filter state)
- Search + margin filter + sort (same as Pusat)
- Product cards:
  - Product name + family
  - "Harga Pusat" — read-only, shows global selling_price
  - "Harga Jual" — editable, shows outlet-specific price
  - "Margin" — auto-calculated
  - Badge: "Standar" (gray, no override) or "Custom" (blue, has override)
  - "Ubah" button → modal to edit selling_price
  - "Reset" button (only for Custom items) → removes override, reverts to global
- Bulk actions toolbar:
  - "Atur Massal" — adjust all prices by +/− amount
  - "Salin Dari" — copy prices from another outlet
- Pagination (20/page)

**Edit Modal (outlet-specific):**
- Title: "Ubah Harga Outlet — {product_name}"
- Shows: Harga Pusat (read-only)
- Field: Harga Jual (outlet override)
- Preview: margin
- Save creates/updates `OutletVariantPrice`
- Save / Batal

**Reset Confirmation:**
- "Reset {product_name} ke Harga Pusat?"
- "Harga akan mengikuti harga global ({global_price})"
- Konfirmasi / Batal

**Backend:**
- `GET /owner/pricing?tab=outlet` — returns outlet grid data
- `GET /owner/pricing?tab=outlet&outlet_id=X` — returns outlet detail with prices
- `PATCH /owner/pricing/outlets/{outlet}/variants/{variant}` — update outlet price (existing)
- `DELETE /owner/pricing/outlets/{outlet}/variants/{variant}` — NEW: reset to global (delete override)
- `POST /owner/pricing/outlets/{outlet}/bulk-update` — bulk adjust (existing)
- `POST /owner/pricing/outlets/{outlet}/copy` — copy from outlet (existing)

---

### Tab 3: Riwayat — Audit Log

**Layout:** Single column
- Filter pills (ghost underline style): Semua, Harga Pusat, Harga Outlet, Bulk Update, Salin
- Log cards:
  - Product name + action badge (color-coded)
  - Outlet name (if applicable)
  - Old price → New price (with strikethrough on old)
  - Changed by + timestamp
- Pagination

**Backend:**
- `GET /owner/pricing?tab=riwayat` — returns paginated audit logs
- Filter by `action` type

---

## Data Flow Summary

```
Edit center_price in Pusat
  → UPDATE product_variants.center_price
  → Affects margin calculation everywhere
  → Warn if outlet overrides would have negative margin

Edit selling_price in Pusat (global)
  → UPDATE product_variants.selling_price
  → Affects all outlets WITHOUT override
  → Outlets with override are NOT affected

Edit selling_price in Outlet
  → INSERT/UPDATE outlet_variant_prices.selling_price
  → Only affects this outlet
  → "Custom" badge appears

Reset outlet price
  → DELETE outlet_variant_prices record
  → Outlet reverts to global selling_price
  → "Standar" badge appears
```

---

## Routes

| Method | Path | Action | Description |
|--------|------|--------|-------------|
| GET | `/owner/pricing` | `PricingController@index` | Main page (tab-aware) |
| PATCH | `/owner/pricing/variants/{variant}` | `PricingController@updateGlobal` | Update center_price / selling_price |
| GET | `/owner/pricing/variants/{variant}/impact` | `PricingController@getImpact` | Impact preview for price change |
| PATCH | `/owner/pricing/outlets/{outlet}/variants/{variant}` | `PricingController@updateOutlet` | Update outlet price |
| DELETE | `/owner/pricing/outlets/{outlet}/variants/{variant}` | `PricingController@resetOutlet` | Reset to global |
| POST | `/owner/pricing/outlets/{outlet}/bulk-update` | `PricingController@bulkUpdate` | Bulk adjust |
| POST | `/owner/pricing/outlets/{outlet}/copy` | `PricingController@copy` | Copy from outlet |

---

## Files to Modify

**Backend:**
- `app/Http/Controllers/Owner/PricingController.php` — refactor index, add updateGlobal, resetOutlet, impact
- `app/Services/PricingService.php` — add resetToGlobal(), update updatePrice()
- `routes/web.php` — add PATCH /variants/{variant}, DELETE /outlets/{outlet}/variants/{variant}

**Frontend:**
- `resources/js/pages/owner/pricing/index.tsx` — full rewrite of all 3 tabs
- `resources/js/components/owner/center-price-edit-modal.tsx` — update for dual-field edit (center_price + selling_price)
- `resources/js/components/owner/pricing-edit-modal.tsx` — keep for outlet-specific edit

**Delete:**
- `resources/js/pages/owner/pricing/outlet.tsx` — already deleted (show redirects to merged page)

---

## UI Design Tokens

Consistent with existing owner pages:
- Primary tabs: Segmented control (`bg-surface-muted` container, `bg-white shadow-sm` active)
- Secondary filters: Ghost underline (`border-b-2 border-primary`)
- Cards: `rounded-xl border border-border bg-white`
- Status badges: `StatusBadge` component
- KPI cards: `OwnerKpiCard` component
- Buttons: `Button` component with variant/size props

---

## Success Criteria

1. Owner can edit center_price and selling_price globally from Pusat tab
2. Owner can view outlet grid, click to see per-outlet pricing
3. Non-overridden products show "Standar" badge, overridden show "Custom"
4. Owner can reset outlet price to global with one click
5. All pricing changes are logged in Riwayat tab
6. No 404 errors when navigating between tabs
7. Responsive design works on desktop and tablet
