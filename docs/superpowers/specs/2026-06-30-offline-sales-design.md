# Penjualan Offline — Design

## Problem

Outlet menjual produk langsung ke customer (via WhatsApp, walk-in) di luar aplikasi Dombi. Saat ini tidak ada cara untuk mencatat penjualan ini, sehingga:
- Stok outlet tidak akurat
- Pusat tidak tahu berapa produk yang terjual
- Tidak ada pencatatan keuangan untuk penjualan offline

## Solution

Tambah fitur "Penjualan Offline" di outlet app. Outlet input produk + jumlah terjual → stok berkurang + hutang ke pusat bertambah.

## Flow

```
Outlet buka "Penjualan Offline"
       │
       ▼
Pilih produk + input jumlah terjual
       │
       ▼
Sistem hitung: center_price × jumlah = total_hutang
       │
       ▼
Submit → 2 efek:
  1. Stok outlet berkurang
  2. Hutang outlet bertambah (ditambahkan ke settlement)
```

## Data Model

### OfflineSale (new)

```
- id
- outlet_id (FK)
- product_variant_id (FK)
- quantity (int)
- center_price (decimal) — harga beli pusat saat transaksi
- total_amount (decimal) — center_price × quantity
- notes (string, nullable)
- created_by (FK users)
- created_at, updated_at
```

### StockMovement (existing)

New type: `offline_sale`
- quantity: negative (stok berkurang)
- notes: "Penjualan offline: {jumlah} x {nama_produk}"

### Settlement impact

- `sales_amount` di settlement bertambah sebesar `total_amount`
- Owner bisa lihat breakdown di halaman keuangan

## Backend

### Controller: `Outlet\OfflineSaleController`

```php
class OfflineSaleController extends Controller
{
    // GET /outlet/offline-sales
    public function index(Request $request): Response

    // POST /outlet/offline-sales
    public function store(Request $request): RedirectResponse
}
```

### Store logic

```php
DB::transaction(function () use ($outlet, $validated) {
    $variant = ProductVariant::findOrFail($validated['variant_id']);
    $centerPrice = $variant->center_price;
    $totalAmount = $centerPrice * $validated['quantity'];

    // 1. Kurangi stok outlet
    $inventory = OutletInventory::where('outlet_id', $outlet->id)
        ->where('product_variant_id', $variant->id)
        ->firstOrFail();

    if ($inventory->current_stock < $validated['quantity']) {
        throw ValidationException::withMessages([
            'quantity' => 'Stok tidak mencukupi.',
        ]);
    }

    $before = $inventory->current_stock;
    $inventory->decrement('current_stock', $validated['quantity']);

    // 2. Catat penjualan offline
    OfflineSale::create([
        'outlet_id' => $outlet->id,
        'product_variant_id' => $variant->id,
        'quantity' => $validated['quantity'],
        'center_price' => $centerPrice,
        'total_amount' => $totalAmount,
        'notes' => $validated['notes'] ?? null,
        'created_by' => $user->id,
    ]);

    // 3. Catat stock movement
    StockMovement::create([
        'outlet_id' => $outlet->id,
        'product_id' => $variant->product_id,
        'product_variant_id' => $variant->id,
        'type' => 'offline_sale',
        'quantity' => -$validated['quantity'],
        'before_stock' => $before,
        'after_stock' => $before - $validated['quantity'],
        'notes' => "Penjualan offline: {$validated['quantity']}x {$variant->full_name}",
        'created_by' => $user->id,
    ]);
});
```

## UI

### Outlet: Penjualan Offline Page

**Route:** `/outlet/offline-sales`

**Header:** "Penjualan Offline" + tombol "Catat Penjualan"

**List:** Riwayat penjualan offline
- Row: nama produk · jumlah · total · tanggal

**Dialog: Pilih Produk**
- CustomSelect untuk pilih produk (dari inventaris outlet)
- Input jumlah (dengan stepper +/−)
- Catatan opsional
- Submit → POST /outlet/offline-sales

### Owner: Keuangan Integration

Di halaman keuangan outlet detail, tambah section "Penjualan Offline":
- Total penjualan offline periode ini
- List per transaksi (produk, jumlah, total, tanggal)

## Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `database/migrations/xxx_create_offline_sales_table.php` | Create | OfflineSale table |
| 2 | `app/Models/OfflineSale.php` | Create | OfflineSale model |
| 3 | `app/Http/Controllers/Outlet/OfflineSaleController.php` | Create | Outlet controller |
| 4 | `routes/web.php` | Modify | Add routes |
| 5 | `resources/js/pages/outlet/offline-sales/index.tsx` | Create | Outlet page |
| 6 | `resources/js/components/outlet/offline-sale-dialog.tsx` | Create | Create dialog |
| 7 | `resources/js/layouts/outlet-layout.tsx` | Modify | Add nav item |
| 8 | `app/Http/Controllers/Owner/FinanceSettlementController.php` | Modify | Add offline sales to settlement view |

## Success Criteria

1. Outlet bisa catat penjualan offline dari halaman terpisah
2. Stok outlet otomatis berkurang saat catat penjualan
3. Hutang outlet ke pusat otomatis bertambah
4. Stock movement tercatat dengan type `offline_sale`
5. Owner bisa lihat breakdown penjualan offline di keuangan
6. Validasi: tidak bisa jual lebih dari stok tersedia
