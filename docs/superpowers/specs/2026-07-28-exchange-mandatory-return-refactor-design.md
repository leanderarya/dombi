# Design: Exchange Mandatory Return-Based Refactor

## Objective
Exchange / Tukar harus strictly merepresentasikan pertukaran barang nyata: outlet return barang lama via ReturnRequest, pusat kirim barang baru via ExchangeRequest. Standalone exchange (tanpa return_request_id) dihapus.

## Core Business Rules
- `ExchangeRequest.return_request_id` **wajib** — milik outlet yang sama
- 1 ReturnRequest hanya boleh dipakai 1 ExchangeRequest
- Return handle pengurangan stok outlet (barang lama)
- Exchange handle pengiriman pusat → outlet (barang baru)
- Hanya Exchange yang catat settlement adjustment (`return_value - exchange_value`)
- Return linked ke Exchange **tidak** membuat settlement adjustment

## Decision: Value-Based Exchange
Exchange berbasis **nilai**, bukan kuantitas.
- `replacement_quantity` tidak dibatasi ≤ return quantity
- Settlement adjustment handle selisih `return_value - exchange_value`
- Yang wajib: `quantity` barang lama per variant di Exchange ≤ `quantity` item di Return (agregasi per variant)

## Status Guard
- **Create Exchange:** `return.status == received_at_center`
- **markShipped:** `return.status in [received_at_center, completed]`

## Data Model Changes

### Migration Strategy (safe deploy)
1. App-level validasi dulu (return_request_id required di service)
2. Cleanup legacy data via audit command
3. Tambah UNIQUE constraint (`return_request_id`) — allow multiple NULLs
4. Setelah tidak ada NULL, ubah jadi NOT NULL

### Legacy Exchange Audit
Kategorikan berdasarkan status:
- `submitted/approved/preparing`: bisa dibatalkan atau dimigrasi manual
- `shipped/received`: harus rekonsiliasi stok fisik
- `completed`: jangan diubah (sudah pengaruhi settlement)
- `rejected/cancelled`: dikecualikan dari cleanup
Jangan buat Return palsu untuk memenuhi FK.

## Service Layer Changes

### ExchangeService::createRequest
```php
wajib: return_request_id
validasi:
  - return exists
  - return.outlet_id === outlet.id
  - return.status === received_at_center
  - belum dipakai exchange lain (DB transaction + lockForUpdate + unique constraint)
  - agregasi item: SUM(items.quantity) per variant <= SUM(return.items.quantity) per variant
  
return_value = $return->total_value  // snapshot harga saat return dibuat
exchange_value = sum(items.replacementVariant.selling_price * replacement_quantity)
```

### ExchangeService::markShipped
```php
tambah guard:
  - returnRequest->status in [received_at_center, completed]
   
no change lain: deductCenterInventory + exchange_out movement sudah benar.
```

### ExchangeService::confirmReceived
No change — addToOutletInventory + exchange_in sudah benar.

### ExchangeService::completeExchange
No change — completeReturn(recordAdjustment: false) + recordExchangeAdjustment + syncAdjustments sudah benar.

### ReturnService
Tidak perlu perubahan. `recordReturnAdjustment` sudah dihapus (return consignment tidak affect settlement).
Return linked ke exchange sudah skip adjustment via `recordAdjustment: false` di completeExchange.

## Controller Changes

### Outlet ExchangeController::store
- Validasi return_request_id required
- Hapus validasi items.*.product_variant_id exists di product_variants (validasi dipindah ke service)

### getPendingReturns → getExchangeEligibleReturns
Filter:
- `outlet_id = current outlet`
- `status = received_at_center`
- `belum memiliki ExchangeRequest (whereDoesntHave)`
- `memiliki item valid`

Return approved tidak eligible.

## Frontend Changes

### pages/outlet/exchanges/create.tsx
- Hapus `pendingReturns` dropdown opsional → wajib pilih return dari list eligible returns
- Setelah pilih return, tampilkan daftar return items (read-only) sebagai sumber barang lama
- User input replacement variant + qty per return item
- Hapus opsi "Tanpa return"

### components/outlet/exchange-create-dialog.tsx
Sama: wajib pilih return, tampilkan return items, pilih replacement per item.

## Required Test Coverage

### Create Exchange
- must require return_request_id → throws
- reject invalid/mismatched return (outlet beda, status bukan received_at_center)
- reject reused return (unique constraint + service check)
- reject item qty melebihi return item (agregasi)
- no stock changes during create (assert stock unchanged)
- value-based: replacement qty > return qty allowed (settlement handles difference)

### markShipped
- fail if return not yet received_at_center
- fail if return status masih approved
- correct center_stock deduction
- no double deduction (idempotent)

### confirmReceived
- correct outlet stock increase
- idempotent

### completeExchange
- correct settlement adjustment (return_value - exchange_value)
- no duplicate adjustment
- return not double-counted in settlement

### Concurrency
- two simultaneous create requests for same return → one succeeds, one fails (unique constraint)
- simultaneous markShipped → lock prevents negative stock

### End-to-End
- full swap: return_out removes old stock → exchange_in adds new stock
- settlement delta = return_value - exchange_value
- return linked to exchange has zero settlement adjustment

## Files Changed

| File | Change |
|------|--------|
| `app/Services/ExchangeService.php` | createRequest validasi ketat, markShipped return guard |
| `app/Http/Controllers/Outlet/ExchangeController.php` | store validasi required, getExchangeEligibleReturns filter |
| `resources/js/pages/outlet/exchanges/create.tsx` | UI: wajib pilih return, tampilkan return items |
| `resources/js/components/outlet/exchange-create-dialog.tsx` | UI: sama |
| Migration baru | UNIQUE + NOT NULL (stepwise) |
| Artisan command | Audit orphan exchanges |
| `tests/Feature/ExchangeWorkflowHardeningTest.php` | Update |
| `tests/Feature/ReturnExchangeBlockingBugTest.php` | Update |
| `tests/Feature/InventoryConservationTest.php` | Update |
| `tests/Feature/ReturnExchangeOperationalHardeningTest.php` | Update |
| `tests/Feature/OwnerReturnExchangeVisibilityTest.php` | Update |

## Execution Order
1. Audit command
2. Tests (define expected behavior first)
3. Service refactor
4. Controller updates
5. Frontend UI
6. Run + fix all tests
7. Deploy app validation
8. Cleanup legacy data
9. DB constraints
10. Concurrency/E2E tests
