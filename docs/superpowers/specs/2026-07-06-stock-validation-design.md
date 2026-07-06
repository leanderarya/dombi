# Stock Validation & Communication Design

**Date:** 2026-07-06
**Status:** Draft
**Scope:** Cart validation, checkout validation, unified stock terminology

---

## 1. Problem Statement

Customer bisa menambahkan produk ke keranjang tanpa limit quantity berdasarkan stok tersedia. Saat checkout, error muncul sebagai "Terjadi kesalahan saat membuat pesanan" — tidak informatif, customer tidak tahu masalahnya stok.

**Root Cause:**
- Stok tidak divalidasi saat add-to-cart
- Stok hanya divalidasi saat submit order (terlambat)
- Error message generik, tidak spesifik ke stok
- Label & threshold stok tidak konsisten antar role

---

## 2. Goals

1. Customer tidak bisa menambah quantity melebihi stok tersedia
2. Checkout auto-adjust quantity jika stok berubah
3. Error message spesifik per item ("Stok [produk] tersisa X")
4. Label & threshold stok konsisten di semua role

---

## 3. Architecture — Data Flow

```
[Customer Add to Cart]
        │
        ▼
POST /customer/cart/add
→ Return available_stock, max_quantity
→ Frontend disable "+" saat qty >= max_quantity
        │
        ▼
[Cart Page]
→ Warning jika stok berkurang
→ Auto-adjust quantity
        │
        ▼
[Checkout Page Load]
        │
        ▼
GET /customer/checkout/validate-stock
→ Return items dengan stok real-time
→ Auto-adjust jika ada perubahan
→ Tampilkan warning banner
        │
        ▼
[Checkout Submit]
        │
        ▼
Backend validate (lockForUpdate)
→ Auto-adjust jika stok kurang
→ Return adjusted order untuk konfirmasi
→ Redirect ke payment setelah konfirmasi
```

---

## 4. Cart Level — Limit & Feedback

### 4.1 API Change: `POST /customer/cart/add`

**Response sukses:**
```json
{
  "success": true,
  "item": {
    "product_variant_id": 5,
    "quantity": 3,
    "available_stock": 7,
    "max_quantity": 7
  },
  "warning": null
}
```

**Response dengan auto-adjust:**
```json
{
  "success": true,
  "item": {
    "product_variant_id": 5,
    "quantity": 7,
    "available_stock": 7,
    "max_quantity": 7
  },
  "warning": "Jumlah dikurangi dari 10 ke 7 (stok tersisa 7)"
}
```

**Response stok habis:**
```json
{
  "success": false,
  "error": "Stok produk ini sudah habis",
  "item": {
    "product_variant_id": 5,
    "quantity": 0,
    "available_stock": 0,
    "max_quantity": 0
  }
}
```

### 4.2 UI Changes

| Komponen | Perubahan |
|----------|-----------|
| `size-selector-sheet.tsx` | Disable "+" saat `quantity >= max_quantity`, tampilkan "Maks: X" |
| `product-detail.tsx` | Sama — limit quantity stepper |
| `variant-list-item.tsx` | Badge "Sisa X" sudah ada, pastikan konsisten |
| `CartController::add()` | Return `available_stock` & `max_quantity` |

### 4.3 Cart Page States

**Trigger:** On page load — fetch stok terbaru saat customer buka halaman cart. Tidak ada polling.

| State | Behavior |
|-------|----------|
| Stok cukup | Normal, bisa ubah qty |
| Stok berkurang | Warning banner: "Stok [produk] tersisa X, jumlah disesuaikan" + auto-adjust qty |
| Stok habis | Item disabled, tombol "Hapus" |

---

## 5. Checkout — Validasi & Auto-Adjust

### 5.1 Endpoint Baru: `GET /customer/checkout/validate-stock`

**Response normal:**
```json
{
  "valid": true,
  "items": [
    {
      "product_variant_id": 5,
      "name": "Susu Kambing Original",
      "variant_name": "250ml",
      "requested_qty": 3,
      "available_stock": 7,
      "adjusted": false
    }
  ],
  "warnings": []
}
```

**Response dengan adjustment:**
```json
{
  "valid": false,
  "items": [
    {
      "product_variant_id": 5,
      "name": "Susu Kambing Original",
      "variant_name": "250ml",
      "requested_qty": 5,
      "available_stock": 3,
      "adjusted": true,
      "adjusted_qty": 3
    }
  ],
  "warnings": [
    "Susu Kambing Original 250ml: jumlah dikurangi dari 5 ke 3 (stok tersisa 3)"
  ]
}
```

### 5.2 Checkout Page Behavior

| Scenario | Behavior |
|----------|----------|
| Stok cukup semua | Normal, lanjut checkout |
| Ada yang berkurang | Banner kuning: "Beberapa stok berubah, jumlah disesuaikan otomatis" + list item |
| Ada yang habis | Banner merah: "[Produk] habis dan dihapus dari pesanan" + item dihapus |

### 5.3 Submit Flow

```
User klik "Bayar"
        │
        ▼
Frontend kirim order ke backend
        │
        ▼
Backend validate (lockForUpdate)
        │
        ├── Stok cukup → Buat order, redirect payment
        │
        └── Stok kurang → Auto-adjust
                │
                ▼
        Return JSON (bukan redirect):
        {
          "adjusted": true,
          "order": { ... },
          "warnings": ["Susu Original: 5 → 3"]
        }
                │
                ▼
        Frontend tampilkan konfirmasi modal
                │
                ▼
        User klik "Konfirmasi" → Redirect payment
```

### 5.4 Backend Changes

**File:** `OrderService.php` — `createCheckoutOrder()`

```php
// Existing: lockForUpdate + cek stok
// New: auto-adjust logic

$adjustments = [];
foreach ($items as $item) {
    $inventory = OutletInventory::where(...)
        ->lockForUpdate()
        ->first();
    
    $available = $inventory->current_stock - $inventory->reserved_stock;
    
    if ($available < $item['quantity']) {
        $adjustments[] = [
            'variant_id' => $item['product_variant_id'],
            'original_qty' => $item['quantity'],
            'adjusted_qty' => $available,
            'available_stock' => $available,
        ];
        $item['quantity'] = $available;
    }
}

if (!empty($adjustments)) {
    throw new StockAdjustedException($adjustments);
}
```

**New Exception:** `StockAdjustedException`

```php
class StockAdjustedException extends \Exception
{
    public array $adjustments;
    
    public function __construct(array $adjustments)
    {
        $this->adjustments = $adjustments;
        parent::__construct('Stock adjusted');
    }
}
```

**Controller handling:**

```php
// CheckoutController::submit()
try {
    $order = $orderService->createCheckoutOrder(...);
} catch (StockAdjustedException $e) {
    return response()->json([
        'adjusted' => true,
        'adjustments' => $e->adjustments,
        'warnings' => $this->formatWarnings($e->adjustments),
    ], 422);
}
```

---

## 6. Unified Stock Terminology

### 6.1 Current State (Inconsistent)

| Role | Label | Threshold |
|------|-------|-----------|
| Customer | "Stok Terbatas" / "Habis" | `<= 5` = low |
| Owner | "Menipis (X)" / "Habis" | `< minimum_stock` = low |
| Outlet | "Rendah" / "Kritis" | `< minimum_stock` = low |

### 6.2 Proposed Standard

| Status | Threshold | Label Customer | Label Owner/Outlet |
|--------|-----------|---------------|-------------------|
| `available` | `> minimum_stock` | — | "Sehat" |
| `low` | `1` sampai `<= minimum_stock` | "Stok Terbatas (X)" | "Stok Rendah (X)" |
| `out_of_stock` | `<= 0` | "Habis" | "Stok Habis" |

### 6.3 Changes

| File | Perubahan |
|------|-----------|
| `CustomerProductApiController.php` | Ubah threshold dari `<= 5` ke `<= minimum_stock` |
| `OutletProductController.php` | Sesuaikan label: "Menipis" → "Stok Rendah" |
| `stock-level-badge.tsx` | Tambah prop `showQuantity` untuk customer |
| `variant-list-item.tsx` | Tampilkan "(X)" saat low stock |
| `product-detail.tsx` | Sama |
| `outlet-products.tsx` | Sesuaikan label |
| `inventory.tsx` | Sudah benar, pastikan konsisten |

### 6.4 Helper Function

```typescript
// lib/stock.ts
export function getStockLabel(
  status: 'available' | 'low' | 'out_of_stock',
  availableStock?: number,
  showQuantity = false
): string {
  switch (status) {
    case 'out_of_stock':
      return 'Habis';
    case 'low':
      return showQuantity && availableStock !== undefined
        ? `Stok Terbatas (${availableStock})`
        : 'Stok Terbatas';
    default:
      return '';
  }
}
```

---

## 7. Files to Modify

### Backend (PHP)

| File | Change |
|------|--------|
| `app/Http/Controllers/Customer/CartController.php` | Return `available_stock`, `max_quantity` |
| `app/Http/Controllers/Customer/CheckoutController.php` | Add `validateStock()` method |
| `app/Http/Controllers/Customer/CustomerProductApiController.php` | Fix threshold |
| `app/Http/Controllers/Owner/OutletProductController.php` | Fix labels |
| `app/Services/OrderService.php` | Add auto-adjust logic |
| `app/Exceptions/StockAdjustedException.php` | New exception |

### Frontend (TypeScript)

| File | Change |
|------|--------|
| `resources/js/components/customer/size-selector-sheet.tsx` | Quantity limit |
| `resources/js/pages/customer/product-detail.tsx` | Quantity limit |
| `resources/js/components/customer/variant-list-item.tsx` | Show stock qty |
| `resources/js/pages/customer/checkout/payment.tsx` | Validate-stock on load |
| `resources/js/components/ui/stock-level-badge.tsx` | Unified labels |
| `resources/js/components/owner/outlet-products.tsx` | Fix labels |
| `resources/js/lib/stock.ts` | New helper |

### Tests

| Test | Coverage |
|------|----------|
| `CartControllerTest` | Add-to-cart with stock limits |
| `CheckoutControllerTest` | Validate-stock endpoint |
| `OrderServiceTest` | Auto-adjust logic |
| `StockValidationTest` | Edge cases (race condition) |

---

## 8. Success Criteria

1. ✅ Customer tidak bisa add quantity > stok tersedia
2. ✅ Checkout page load auto-adjust + warning
3. ✅ Checkout submit auto-adjust + konfirmasi modal
4. ✅ Error message spesifik per item
5. ✅ Label stok konsisten di semua role
6. ✅ Zero "Terjadi kesalahan" generic errors untuk stok

---

## 9. Out of Scope

- Real-time polling stok (overkill untuk volume ini)
- Reserved stock untuk customer (complex, tidak perlu sekarang)
- Low stock alerts ke customer (future feature)
- Multi-outlet stock transfer
