# StoreLocationCard — Functional Outlet Selection

**Date:** 2026-07-04
**Status:** Approved (updated with review feedback)

## Problem

The `StoreLocationCard` on the products page is a static display showing hardcoded "Outlet Dombi". It doesn't reflect the customer's actual nearest outlet, doesn't allow changing the outlet, and doesn't filter the product list by outlet inventory.

## Goals

1. Show the customer's selected outlet (name, distance, stock status)
2. Allow tapping the card to change the selected outlet via a bottom sheet
3. Filter the product list by the selected outlet's inventory
4. Persist the selected outlet in localStorage across sessions
5. Share the outlet selection between products page and checkout page

## Approach: API-first with outlet scoping

Products page becomes client-side data-driven. Inertia SSR provides the shell; products are fetched via `GET /customer/products?outlet_id=X`. Selected outlet stored in localStorage + React context.

## Data Model

### Outlet store (localStorage)

New file: `resources/js/lib/outlet-store.ts`

- Key: `'dombi_selected_outlet'`
- Stores: `{ outletId: number } | null`
- Interface: `save(outletId)`, `clear()`, `getSnapshot()`
- Independent of `CustomerLocationStore` — outlet can be selected without GPS

### React context: OutletProvider

New file: `resources/js/contexts/outlet-context.tsx`

Provides:
- `selectedOutlet` — full outlet object (id, name, address, distance_km, stock_available)
- `setOutlet(outlet)` — update selection + persist to localStorage
- `outlets` — list of all available outlets
- `loading` — true while fetching outlet list

Fetches outlets from `GET /customer/outlets` on mount using customer location from `useCustomerLocation()`.

Default selection logic:
1. If localStorage has a saved outlet ID that exists in the API response → use it
2. If localStorage is empty or saved ID not found → auto-select first outlet (nearest by distance) and persist to localStorage
3. If API returns no outlets → `selectedOutlet` is null

## Backend API

### `GET /customer/outlets`

Route: inside customer middleware group

Query params: `latitude` (optional), `longitude` (optional)

Response:
```json
{
  "outlets": [
    { "id": 1, "name": "Dombi Sudirman", "address": "Jl. Sudirman No. 10", "distance_km": 1.2, "stock_available": true }
  ]
}
```

Logic:
- Return all active (non-archived) outlets
- If lat/lng provided: Haversine distance calculation, sort by distance, include `distance_km`
- If no lat/lng: sort by name, `distance_km: null`
- `stock_available`: true if outlet has any variant with stock > 0

Controller: `app/Http/Controllers/Customer/CustomerOutletController.php`

### `GET /customer/products`

Route: replace or extend existing products route

Query params: `outlet_id` (optional)

Response:
```json
{
  "families": [
    {
      "id": 1,
      "name": "Kopi Susu",
      "brand": "Dombi",
      "image_url": "...",
      "variants": [
        { "id": 1, "name": "Regular", "price": 25000, "sku": "KS-R", "available_stock": 5, "is_active": true }
      ]
    }
  ]
}
```

**Price logic:**
- `price` = `ProductVariant::priceForOutlet(outlet_id)` — uses outlet-specific override from `outlet_variant_prices` table, falls back to global `product_variants.selling_price`
- This ensures customers see the correct price for their selected outlet
- "Mulai dari Rp X" in the UI = lowest `price` across all variants of that family

**Stock logic:**
- `outlet_id` optional — if omitted, returns all active products (no stock filter)
- When `outlet_id` provided: join with `inventories` table, compute `available_stock` per variant for that outlet
- Variants with `available_stock === 0` included (shown as "Habis" badge)
- Order: families by `name`, variants by `name`

**Pagination (deferred):**
- V1 returns all families. If performance becomes an issue with 50+ families, add cursor-based pagination or lazy-load per section.

Controller: `app/Http/Controllers/Customer/CustomerProductApiController.php`

## UI Components

### StoreLocationCard (update existing)

File: `resources/js/components/customer/store-location-card.tsx`

- Reads from `useOutlet()` context
- Shows selected outlet name + distance + "Terdekat" badge
- Tapping opens `OutletSheet`
- Loading skeleton while outlets fetch
- Fallback: "Pilih outlet" if none selected

### OutletSheet (new)

File: `resources/js/components/customer/outlet-sheet.tsx`

Bottom sheet (same `<Sheet>` pattern as `LocationSheet`, `SizeSelectorSheet`):

1. Header: "Pilih Outlet" + close button
2. Outlet list — each row:
   - Outlet name (bold)
   - Address (1 line, truncated)
   - Distance (right-aligned, e.g. "1.2 km")
   - Stock badge (green "Tersedia" / amber "Terbatas")
   - Checkmark on selected outlet
3. Tap row → `setOutlet(outlet)` → sheet closes → product list refetches

**OutletSheet states:**
- **Loading:** Skeleton rows (3x shimmer) while outlets API is in-flight
- **Empty:** "Tidak ada outlet tersedia" message + retry button
- **Error:** "Gagal memuat outlet" + retry button

### Fulfillment toggle relationship

The `FulfillmentToggle` (Pick Up / Delivery) on the products page is **independent** of outlet selection in V1:

- **Pick Up mode:** Shows all outlets in OutletSheet. Customer picks any outlet.
- **Delivery mode:** Future enhancement — filter OutletSheet to outlets where customer is within `delivery_radius_km`. For now, behavior is identical to Pick Up.

The toggle affects only the subtitle text ("Ambil di outlet tanpa antre" vs "Diantar ke alamat Anda") and the checkout flow. Outlet selection does not change based on fulfillment type.

### Products page changes

File: `resources/js/pages/customer/products.tsx`

- Remove `families` from Inertia props (products fetched via API)
- Remove Inertia controller data for families
- Add `useEffect` + `useState` for product data
- Fetch `GET /customer/products?outlet_id=X` when `selectedOutlet` changes
- AbortController to cancel in-flight requests on rapid outlet switch
- Show loading skeleton during fetch
- Wrap with `<OutletProvider>` (inside existing `<FavoritesProvider>`)

## Data Flow

```
Customer opens /customer/products
         │
         ▼
OutletProvider fetches GET /customer/outlets (uses lat/lng from localStorage)
         │
         ▼
StoreLocationCard shows selected outlet (from localStorage, default = nearest)
         │
         ▼
Products page fetches GET /customer/products?outlet_id=X
         │
         ▼
Product list renders with outlet-specific stock badges
         │
         ▼
Customer taps StoreLocationCard → OutletSheet opens
         │
         ▼
Customer picks different outlet → setOutlet() → localStorage updates
         │
         ▼
Products page useEffect fires → re-fetches with new outlet_id
         │
         ▼
Product list updates with new outlet's stock data
```

## Error Handling

- **Outlets API fails:** Show "Gagal memuat outlet" in card with retry button. Products fall back to server-side data.
- **Products API fails:** Error toast, keep previous data. Don't clear list.
- **Network offline:** Use cached localStorage outlet. Show "Mode offline" banner.
- **No outlets available:** Card shows "Tidak ada outlet tersedia". Product list hidden.
- **No location set:** Returns all outlets sorted by name (no distance). Card shows "Atur lokasi" prompt.
- **Selected outlet archived:** Auto-reset to nearest. Toast: "Outlet tidak tersedia, dialihkan ke [name]".

## Component Hierarchy

```
<FavoritesProvider>
  <OutletProvider>
    <Head title="Produk" />
    <CustomerLocationBootstrap />
    <div className="min-h-dvh bg-background">
      <div className="bg-primary">
        <ForeGreenHeader />
        <FulfillmentToggle />
      </div>
      <div className="rounded-t-[1.5rem] bg-white">
        <StoreLocationCard />
        <StickySearch />
        <FilterChips />
        <ProductCount />
        <FamilySections />
      </div>
    </div>
    <OutletSheet />
    <CustomerBottomNav />
  </OutletProvider>
</FavoritesProvider>
```

## Files

### New

| File | Purpose |
|------|---------|
| `resources/js/lib/outlet-store.ts` | localStorage store for selected outlet ID |
| `resources/js/contexts/outlet-context.tsx` | React context + provider |
| `resources/js/components/customer/outlet-sheet.tsx` | Bottom sheet outlet picker |
| `app/Http/Controllers/Customer/CustomerOutletController.php` | `GET /customer/outlets` API |
| `app/Http/Controllers/Customer/CustomerProductApiController.php` | `GET /customer/products` API |

### Modified

| File | Change |
|------|--------|
| `routes/web.php` | Add 2 new routes |
| `resources/js/components/customer/store-location-card.tsx` | Read from outlet context, make tappable |
| `resources/js/pages/customer/products.tsx` | API fetch, wrap with OutletProvider |
| `app/Http/Controllers/Customer/ProductController.php` | Remove families data from index (now via API) |

## Caching Strategy

- **Outlet list:** Fetched once on mount by `OutletProvider`, cached in React state. Re-fetch only on location change or manual retry.
- **Products per outlet:** Simple `Map<outletId, Response>` cache in products page state. When switching back to a previously-fetched outlet, use cached data. Clear cache on pull-to-refresh (future).
- **localStorage:** Selected outlet ID persists across sessions. No TTL — valid until outlet is archived.

## Location Permission Flow

When customer has no location set:
1. OutletSheet shows all outlets sorted by name (no distance)
2. StoreLocationCard shows "Atur lokasi" text + link to LocationSheet
3. After location is set → OutletProvider re-fetches with lat/lng → outlets now have distances → auto-select nearest

## Integration with Checkout

- `PickupOutletSelector` reads from same `OutletProvider` context
- Outlet selected on products page pre-selects on checkout
- Checkout can change independently (local state, synced back on confirm)

## Out of Scope (Future Considerations)

- **Delivery area filtering:** Filter outlets by `delivery_radius_km` when fulfillment = delivery
- **Real-time stock updates:** WebSocket or polling for live stock changes
- **Outlet operating hours display:** Show open/closed status in OutletSheet
- **Outlet holiday handling:** Hide or mark outlets that are on holiday
- **SEO for product pages:** If needed, SSR initial product data via Inertia and hydrate client-side
- **Pagination:** Cursor-based or lazy-load per section if family count exceeds 50
