# Return & Exchange Page Merge

**Date:** 2026-06-28
**Status:** Draft
**Scope:** Owner role — merge Pengembalian + Penukaran into 1 page with 2 tabs

---

## Problem

Return and Exchange are closely related (exchange often follows return) but are separate pages with separate sidebar items. This increases sidebar clutter and makes the relationship between the two unclear.

## Design

### Page Structure

1 page: `/owner/returns` (reuse existing URL)

**2 tabs with segmented control:**
1. **Pengembalian** (Return) — default tab
2. **Penukaran** (Exchange)

### Tab 1: Pengembalian

- Status filter pills (ring style): Semua, Submitted, Approved, Received, Completed, Rejected
- Date range filter
- Compact cards (2-row pattern):
  - Row 1: Return ID + StatusBadge + total_value
  - Row 2: outlet · reason · items · date + [Setujui] [Tinjau]
- KPI sidebar: Return Tertunda, Nilai Return, Total Return

### Tab 2: Penukaran

- Status filter pills (ring style): Semua, Submitted, Approved, Preparing, Shipped, Received, Completed, Rejected
- Date range filter
- Compact cards (2-row pattern):
  - Row 1: Exchange ID + StatusBadge + exchange_value
  - Row 2: outlet · return ref · items · date + [Setujui] [Tinjau]
- KPI sidebar: Tukar Tertunda, Nilai Tukar, Total Tukar

### Backend

**Controller:** `ReturnController@index` — refactored to handle both tabs via `match($tab)`

**Routes:**
- `GET /owner/returns?tab=pengembalian` — return list (default)
- `GET /owner/returns?tab=penukaran` — exchange list
- Keep existing show/update routes for both

**Data:**
- Tab pengembalian: returns + KPIs
- Tab penukaran: exchanges + KPIs

### Sidebar

Remove "Penukaran" from sidebar. "Pengembalian" renamed to "Return & Tukar" or keep "Pengembalian" with subtitle.

### Files

**Modify:**
- `resources/js/pages/owner/returns/index.tsx` — rewrite with 2 tabs
- `app/Http/Controllers/Owner/ReturnController.php` — add tab dispatch
- `routes/web.php` — no changes needed (reuse `/owner/returns`)
- `resources/js/layouts/owner-layout.tsx` — remove exchange sidebar item

**Delete:**
- `resources/js/pages/owner/exchanges/index.tsx`
- `resources/js/pages/owner/exchanges/show.tsx`
- `app/Http/Controllers/Owner/ExchangeController.php` — keep show/update, delete index

### Success Criteria

1. Single page with 2 tabs (Pengembalian, Penukaran)
2. Both tabs show compact cards with KPI sidebar
3. No 404 errors
4. Sidebar has 1 item instead of 2
5. Existing show pages still work
