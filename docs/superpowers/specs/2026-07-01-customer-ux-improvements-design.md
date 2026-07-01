# Customer UX Improvements — Dombi App

**Date:** 2026-07-01
**Scope:** Customer-facing pages (16 pages)
**Status:** Approved
**Principles:** The Design of Everyday Things (Norman), Steve Jobs Design Review

## Problem

Customer journey has UX gaps that cause confusion:
1. No explicit success feedback after placing an order
2. Order statuses are unclear — customers don't know what happens next
3. Pickup loading overlay is ambiguous
4. Home page has low-impact content occupying prime space
5. Product prices not visible until opening detail page
6. No time estimates for pickup/delivery during checkout

## Changes

### 1. Order Success Confirmation Page (NEW)

**File:** `resources/js/pages/customer/orders/confirm.tsx` (new)
**Route:** `GET /customer/orders/confirm/{order_code}`
**Controller:** `OrderController@confirm` (new method)

After successful checkout POST, redirect to this page instead of directly to order show.

**Page structure:**
- Animated checkmark (CSS scale+fade)
- "Pesanan Berhasil!" title
- Order code (large, monospace)
- Summary card: items count, total, fulfillment method, estimated time
- 2 CTAs: "Lacak Pesanan" → order show, "Kembali ke Beranda" → home
- Helper text: "Simpan kode pelacakan untuk cek pesanan nanti"

**Server data:** `order` object (code, items, total, fulfillment_type, estimated_time)

### 2. Order Status "What's Next" Section

**File:** `resources/js/pages/customer/orders/show.tsx`
**Component:** Inline section below StatusBadge

Add a card below the status badge that explains:
- What the current status means (plain language)
- What happens next
- Optional CTA (e.g., "Navigasi" for ready_for_pickup)

Status mapping:

| Status | Description | Next Step | CTA |
|---|---|---|---|
| `pending_confirmation` | "Menunggu outlet mengkonfirmasi pesanan Anda" | "Biasanya dikonfirmasi dalam beberapa menit" | — |
| `confirmed` | "Pesanan sudah dikonfirmasi oleh outlet" | "Outlet sedang menyiapkan pesanan Anda" | — |
| `preparing` | "Pesanan sedang disiapkan" | "Pesanan akan segera siap" | — |
| `ready_for_pickup` | "Pesanan sudah siap diambil!" | "Silakan ambil di outlet sebelum jam tutup" | Navigasi |
| `out_for_delivery` | "Kurir sedang dalam perjalanan" | "Pesanan akan diantar ke lokasi Anda" | — |
| `completed` | "Pesanan telah selesai" | "Terima kasih sudah pesan di Dombi!" | Pesan Lagi |
| `rejected_by_outlet` | "Outlet tidak dapat memproses pesanan" | "Silakan coba pesan dari outlet lain" | Pesan Lagi |
| `cancelled_by_customer` | "Pesanan telah Anda batalkan" | — | Pesan Lagi |
| `cancelled_by_outlet` | "Pesanan dibatalkan oleh outlet" | "Silakan coba pesan lagi" | Pesan Lagi |
| `failed_delivery` | "Pengiriman gagal" | "Silakan hubungi kami untuk bantuan" | Hubungi WA |
| `expired` | "Pesanan kadaluarsa" | "Outlet tidak konfirmasi dalam batas waktu" | Pesan Lagi |

### 3. Pickup Loading Overlay Improvement

**File:** `resources/js/pages/customer/home.tsx`

Changes to the loading overlay:
- Default state: add hint text "Pastikan GPS aktif untuk hasil terbaik" below main text
- Found state: add distance info if available, change "Mengarahkan..." to "Mengarahkan ke daftar produk..."
- Error state: add "Coba lagi" button alongside "Tutup"

### 4. Home Page Improvements

**File:** `resources/js/pages/customer/home.tsx`

**4a. Hero Carousel CTA:**
- Change CTA from text link (`text-white/80`) to button (`bg-white/20 backdrop-blur rounded-xl min-h-11 px-6`)
- Reduce carousel height: 320px → 260px

**4b. "Yang Menarik di Dombi" cards:**
- Card 2 "Outlet Terdekat": show actual nearest outlet name from GPS data (already available via `nearestOutlet` state)
- Card 3 "Riwayat Pesanan": change to "Pesanan Aktif" when `activeOrder` exists, link to specific order
- Card 4 "Kualitas Terjamin" (static): replace with "Butuh Bantuan?" → WhatsApp link

**4c. Remove standalone "Bantuan" section** (section 5 in current home.tsx) — functionality moved to card #4.

### 5. Product Pricing & Time Estimates

**5a. Price in product list:**

**File:** `resources/js/pages/customer/products.tsx` (renders `VariantListItem`)

Show lowest price below variant name in each product row. Data already available as `group.lowestPrice` in `FlavorGroup` — pass to `VariantListItem` as new prop `displayPrice`.

**Component:** `resources/js/components/customer/variant-list-item.tsx`
- Add `displayPrice?: number` prop
- Render "Mulai dari Rp{displayPrice}" below variant name

**5b. Time estimates in fulfillment cards:**

**File:** `resources/js/pages/customer/checkout/index.tsx` (inline `FulfillmentCard`)

Add estimate text to each fulfillment card:
- Pickup: "⏱ Siap dalam 15-30 menit"
- Delivery: "⏱ Diantar dalam 30-60 menit"

Static text — no server data needed.

## Files Modified

| File | Change |
|---|---|
| `resources/js/pages/customer/orders/confirm.tsx` | NEW — success confirmation page |
| `routes/web.php` | Add confirm route |
| `app/Http/Controllers/Customer/OrderController.php` | Add confirm method |
| `resources/js/pages/customer/orders/show.tsx` | Add "What's Next" section |
| `resources/js/pages/customer/home.tsx` | Hero CTA, cards, remove bantuan section, overlay improvements |
| `resources/js/pages/customer/products.tsx` | Pass lowestPrice to VariantListItem |
| `resources/js/components/customer/variant-list-item.tsx` | Add displayPrice prop |
| `resources/js/pages/customer/checkout/index.tsx` | Add time estimates to FulfillmentCard |

## Out of Scope

- Product images (currently emoji placeholder) — separate task
- Push notification improvements — separate task
- Customer address form UX — separate task
- Dark mode support — separate task
