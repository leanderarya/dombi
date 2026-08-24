# DOKU Payment Integration — Dombi

> Dokumen ini menjelaskan seluruh alur pembayaran DOKU: arsitektur, konfigurasi, alur, skenario, keamanan, dan testing/audit.

**Terakhir disinkronkan dengan kode:** 2026-08-05

---

## Daftar Isi

1. [Arsitektur & Komponen](#1-arsitektur--komponen)
2. [Konfigurasi](#2-konfigurasi)
3. [Alur Pembayaran Utama](#3-alur-pembayaran-utama)
4. [Semua Skenario Pembayaran](#4-semua-skenario-pembayaran)
5. [Status Mapping](#5-status-mapping)
6. [Keamanan](#6-keamanan)
7. [API Endpoints](#7-api-endpoints)
8. [Database Schema](#8-database-schema)
9. [Error Handling](#9-error-handling)
10. [Sandbox & Development Tools](#10-sandbox--development-tools)
11. [Testing / Audit Checklist](#11-testing--audit-checklist)

---

## 1. Arsitektur & Komponen

### File Structure

```
app/
├── Services/
│   └── DokuService.php              ← createPayment, handleWebhook, verifySignature, checkStatus, syncStatusFromDoku, mapStatus
│   ├── PaymentStatusService.php     ← PaymentStatus transition guard (atomic, terminal-aware)
│   └── RefundService.php            ← Auto-refund late payment, manual refund (Track B)
├── Http/Controllers/
│   ├── DokuPaymentController.php    ← Webhook (notify) + Redirect endpoints
│   └── Customer/
│       ├── CheckoutController.php   ← Checkout flow → createPayment
│       └── OrderController.php      ← Payment retry + status polling + refund destination
├── Models/
│   ├── Order.php                    ← doku_order_id, payment_status, payment_method, paid_at
│   └── PaymentTransaction.php       ← Transaction log: session_id, token_id, raw_response
│   └── PaymentWebhookLog.php        ← Audit log: setiap webhook/redirect masuk
├── Enums/
│   ├── PaymentStatus.php            ← pending, paid, failed, expired, settled, refund_*
│   └── PaymentMethod.php            ← qris, ewallet, transfer, credit_card (dana/gopay/shopeepay legacy)
├── Exceptions/
│   └── DokuPaymentException.php     ← Custom exception dengan user-friendly message
└── Console/Commands/
    ├── DokuMarkPaid.php             ← Sandbox: manual mark as paid
    └── ExpirePendingOrders.php      ← Auto-cancel order yang expired (scheduler)

config/
└── doku.php                         ← API credentials, sandbox/production URLs, payment methods, fee registry

routes/
└── web.php                          ← /payment/doku/notify, /payment/doku/redirect

tests/Feature/
├── DokuPaymentTest.php              ← create, webhook, signature, idempotency, status mapping
├── DokuPaymentAtomicTest.php        ← race condition webhook + redirect (double charge guard)
├── PaymentScenarioTest.php          ← status mapping, pay endpoint guards, card scenarios
├── PaymentFailureFlowTest.php       ← failure flows: status endpoint, restore cart
├── PaymentAuthorizationMutationTest.php ← ownership authorization semua mutation
├── PaymentFeeIntegrationTest.php    ← payment fee line item + fee threshold
├── PaymentReliabilityTest.php       ← retry, timeout, late payment
└── DokuMarkPaidCommandTest.php

database/migrations/
├── 2026_07_02_155808_create_payment_transactions_table.php
├── 2026_07_02_155808_add_payment_fields_to_orders_table.php
├── 2026_07_04_000001_rename_midtrans_to_doku.php
├── 2026_07_05_000001_add_session_id_token_id_to_payment_transactions.php
└── 2026_07_16_000040_create_payment_webhook_logs_table.php
```

### Komponen Utama

| Komponen | File | Tanggung Jawab |
|----------|------|----------------|
| **DokuService** | `app/Services/DokuService.php` | Semua interaksi dengan DOKU API |
| **DokuPaymentController** | `app/Http/Controllers/DokuPaymentController.php` | Webhook receiver + redirect handler + audit log |
| **PaymentStatusService** | `app/Services/PaymentStatusService.php` | Transisi payment status yang aman (terminal guard) |
| **CheckoutController** | `app/Http/Controllers/Customer/CheckoutController.php` | Checkout → create payment |
| **OrderController** | `app/Http/Controllers/Customer/OrderController.php` | Retry payment + status polling + refund destination |
| **DokuPaymentException** | `app/Exceptions/DokuPaymentException.php` | Error handling dengan user message |

---

## 2. Konfigurasi

### Environment Variables (`.env`)

```env
DOKU_CLIENT_ID=your-client-id
DOKU_API_KEY=your-secret-key
DOKU_IS_SANDBOX=true                          # true = sandbox, false = production
DOKU_PAYMENT_TIMEOUT=30                       # Menit sebelum payment expired
DOKU_AUTO_REDIRECT=true
DOKU_CURRENCY=IDR
DOKU_ENABLED_METHODS=qris,transfer,ewallet,credit_card
DOKU_CALLBACK_URL=                            # Optional override (default: route doku.notify)
DOKU_WEBHOOK_MAX_AGE_SECONDS=300              # Maks umur timestamp webhook (detik)
DOKU_FEE_THRESHOLD=500000                     # Subtotal tanpa delivery. Di bawah = Dombi tanggung, di atas = customer bayar
DOKU_FEE_QRIS=0.007                           # Fee rate per method
DOKU_FEE_TRANSFER=0.004
DOKU_FEE_EWALLET=0.015
DOKU_FEE_CC=0.029
```

### Config File (`config/doku.php`)

```php
return [
    'client_id' => env('DOKU_CLIENT_ID'),
    'api_key' => env('DOKU_API_KEY'),
    'sandbox' => env('DOKU_IS_SANDBOX', true),
    'base_url' => env('DOKU_IS_SANDBOX', true)
        ? 'https://api-sandbox.doku.com'
        : 'https://api.doku.com',

    'payment_timeout' => env('DOKU_PAYMENT_TIMEOUT', 30), // minutes
    'auto_redirect' => env('DOKU_AUTO_REDIRECT', true),
    'currency' => env('DOKU_CURRENCY', 'IDR'),

    'payment_methods' => env('DOKU_PAYMENT_METHODS', 'QRIS'), // deprecated, gunakan methods/enabled_methods
    'callback_url' => env('DOKU_CALLBACK_URL'),

    'webhook_max_age_seconds' => env('DOKU_WEBHOOK_MAX_AGE_SECONDS', 300),

    // Fee registry per method
    'methods' => [
        'qris'       => ['label' => 'QRIS',         'doku_type' => 'QRIS',       'channel' => null,    'fee_rate' => env('DOKU_FEE_QRIS', 0.007)],
        'transfer'   => ['label' => 'Transfer Bank', 'doku_type' => 'VA',         'channel' => 'BCA',    'fee_rate' => env('DOKU_FEE_TRANSFER', 0.004)],
        'ewallet'    => ['label' => 'E-Wallet',      'doku_type' => 'EWALLET',    'channel' => 'GOPAY',  'fee_rate' => env('DOKU_FEE_EWALLET', 0.015)],
        'credit_card'=> ['label' => 'Kartu Kredit',  'doku_type' => 'CREDIT_CARD','channel' => null,     'fee_rate' => env('DOKU_FEE_CC', 0.029)],
        // legacy aliases
        'gopay'     => ['label' => 'GoPay',      'doku_type' => 'EWALLET',    'channel' => 'GOPAY',     'fee_rate' => ...],
        'shopeepay' => ['label' => 'ShopeePay',  'doku_type' => 'EWALLET',    'channel' => 'SHOPEEPAY', 'fee_rate' => ...],
        'dana'      => ['label' => 'DANA',       'doku_type' => 'EWALLET',    'channel' => 'DANA',      'fee_rate' => ...],
    ],

    'enabled_methods' => explode(',', env('DOKU_ENABLED_METHODS', 'qris,transfer,ewallet,credit_card')),
];
```

### Payment Methods Aktif

| Dombi Method | Label | DOKU Type | Channel | Fee Rate Default |
|--------------|-------|-----------|---------|------------------|
| `qris` | QRIS | `QRIS` | — | 0.7% |
| `transfer` | Transfer Bank | `VA` | `BCA` | 0.4% |
| `ewallet` | E-Wallet | `EWALLET` | `GOPAY` | 1.5% |
| `credit_card` | Kartu Kredit | `CREDIT_CARD` | — | 2.9% |
| `gopay`/`shopeepay`/`dana` | *legacy alias* | `EWALLET` | sesuai provider | 1.5% |

### URL Endpoints

| Environment | Base URL |
|-------------|----------|
| Sandbox | `https://api-sandbox.doku.com` |
| Production | `https://api.doku.com` |

---

## 3. Alur Pembayaran Utama

### Flow Diagram

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Customer    │────▶│ CheckoutController│────▶│ DokuService │
│  (Browser)   │     │ ::submit()        │     │ ::createPayment()
└─────────────┘     └──────────────────┘     └──────┬──────┘
                                                     │
                                              POST /checkout/v1/payment
                                                     │
                                                     ▼
                                              ┌─────────────┐
                                              │  DOKU API   │
                                              │  (Hosted    │
                                              │   Payment   │
                                              │   Page)     │
                                              └──────┬──────┘
                                                     │
                                    ┌────────────────┼────────────────┐
                                    │                                 │
                                    ▼                                 ▼
                             ┌─────────────┐                  ┌─────────────┐
                             │   Webhook   │                  │  Redirect   │
                             │  (Server)   │                  │  (Browser)  │
                             │ /payment/   │                  │ /payment/   │
                             │ doku/notify │                  │ doku/redirect
                             └──────┬──────┘                  └──────┬──────┘
                                    │                                 │
                                    ▼                                 ▼
                             ┌─────────────┐                  ┌─────────────┐
                             │ verifySign  │                  │ syncStatus  │
                             │ handleWebhook│                 │ FromDoku()  │
                             └──────┬──────┘                  └──────┬──────┘
                                    │                                 │
                                    └────────────┬────────────────────┘
                                                 │
                                                 ▼
                                          ┌─────────────┐
                                          │  Order      │
                                          │  Updated    │
                                          │  (paid/     │
                                          │  failed/    │
                                          │  expired)   │
                                          └─────────────┘
```

### Langkah Detail

1. **Customer** menekan "Bayar" di halaman checkout
2. **CheckoutController::submit()** memanggil `DokuService::createPayment($order)`
3. **DokuService** mengirim POST ke `/checkout/v1/payment` dengan:
   - `order.invoice_number` = order_code
   - `order.amount` = `(int) $order->total` (total, bukan subtotal)
   - `order.line_items` = item-item pesanan **plus delivery fee** (`Ongkos Kirim`) dan **payment fee** (`Biaya Layanan`) sehingga jumlah line items = order total
   - `payment.payment_method_types` = dari enum `PaymentMethod::dokuType()` (QRIS / VA / EWALLET / CREDIT_CARD)
   - `customer` = nama, email, phone
4. **DOKU** mengembalikan `payment_url` (hosted payment page)
5. **Customer** di-redirect ke halaman DOKU untuk membayar
6. Setelah pembayaran:
   - **Webhook**: DOKU mengirim POST ke `/payment/doku/notify`
   - **Redirect**: Customer di-redirect ke `/payment/doku/redirect`
7. **Order** di-update statusnya (paid/failed/expired)

---

## 4. Semua Skenario Pembayaran

### 4.1 ✅ Pembayaran Berhasil (SUCCESS)

**Trigger**: DOKU mengirim `transaction.status = "SUCCESS"`

**Alur**:
```
DOKU Webhook → verifySignature → handleWebhook → mapStatus('SUCCESS') = 'paid'
→ processPaymentStatusChange → markOrderPaid
```

**Yang terjadi di `markOrderPaid()`**:
1. **Terminal guard**: jika order sudah `cancelled_by_customer` / `cancelled_by_outlet` / `rejected_by_outlet` / `expired` → `DB::transaction` + `lockForUpdate`, update ke `paid` via `PaymentStatusService`, lalu **auto-refund** via `RefundService::request(..., 'late_payment')` (late payment).
2. Jika order masih aktif → `PaymentStatusService::transition($order, Paid, ['paid_at' => now()])` — guard anti double-charge (skip jika sudah paid).
3. Jika order status = `pending_confirmation` → update ke `confirmed`, kirim notifikasi ke outlet (`notifyOrderCreated`).
4. Hapus cache: `outlet:{id}:pending_orders`, `owner:pending_counts`, `owner:order_stats`

**Data yang tersimpan**:
```sql
-- orders table
payment_status = 'paid'
paid_at = '2026-07-06 10:30:00'
status = 'confirmed'  -- jika sebelumnya pending_confirmation

-- payment_transactions table
status = 'paid'
raw_response = { ... webhook payload ... }
```

**Test**: `DokuPaymentTest::test_webhook_success_marks_paid`

---

### 4.2 ⏳ Pembayaran Pending (PENDING)

**Trigger**: DOKU mengirim `transaction.status = "PENDING"` atau belum ada webhook

**Alur**:
```
createPayment → order.payment_status = 'pending'
Customer di-redirect ke DOKU hosted page
Menunggu customer membayar (QRIS scan, dll)
```

**Yang terjadi**:
- Order tetap `payment_status = 'pending'`
- Customer bisa polling status via `/customer/orders/{id}/payment-status` (dibatasi throttle `60,1`)
- Frontend polling interval: 5 detik
- Jika timeout (30 menit default), DOKU mengirim EXPIRED

**Data yang tersimpan**:
```sql
-- orders table
payment_status = 'pending'
doku_order_id = 'INV-20260706-001'

-- payment_transactions table
status = 'pending'
session_id = 'sess-xxx'
token_id = 'tok-xxx'
```

---

### 4.3 ❌ Pembayaran Gagal (FAILED)

**Trigger**: DOKU mengirim `transaction.status = "FAILED"`

**Alur**:
```
DOKU Webhook → mapStatus('FAILED') = 'failed'
→ processPaymentStatusChange
→ order.payment_status = 'failed'
→ Reset confirmation_expires_at (fresh retry window)
```

**Yang terjadi**:
- Order tetap `status = 'pending_confirmation'` (tidak di-cancel)
- Customer bisa retry payment dari halaman confirm
- `confirmation_expires_at` di-reset ke `now() + 15 menit`

**Data yang tersimpan**:
```sql
-- orders table
payment_status = 'failed'
confirmation_expires_at = '2026-07-06 10:45:00'  -- fresh window

-- payment_transactions table
status = 'failed'
```

**Test**: `PaymentScenarioTest::test_payment_rejected_expires_order`

---

### 4.4 🚫 Pembayaran Ditolak (REJECTED / DENIED)

**Trigger**: DOKU mengirim `transaction.status = "REJECTED"` atau `"DENIED"`

**Alur**:
```
DOKU Webhook → mapStatus('REJECTED') = 'failed'
DOKU Webhook → mapStatus('DENIED') = 'failed'
→ Sama dengan FAILED flow
```

**Perbedaan REJECTED vs DENIED**:
| Status | Arti | Contoh |
|--------|------|--------|
| REJECTED | Ditolak oleh sistem DOKU | Fraud detection, limit exceeded |
| DENIED | Ditolak oleh bank/issuer | Card declined, insufficient funds |

Keduanya di-map ke `failed` di sistem Dombi.

**Card Test Scenarios** (DOKU sandbox):
| Nomor Kartu | Skenario | Expected |
|-------------|----------|----------|
| 4617006911111106 | 3DS Success | paid |
| 4617006911111114 | 3DS Rejected by DOKU | failed |
| 4617006911111122 | 3DS Rejected by Bank | failed |
| 4617006911111130 | Non 3DS Success | paid |
| 4617006911111213 | Non 3DS Rejected by DOKU | failed |
| 4617006911111221 | Non 3DS Rejected by Bank | failed |

**Test**: `PaymentScenarioTest::test_doku_card_scenario_*`

---

### 4.5 ⏰ Pembayaran Expired (EXPIRED)

**Trigger**: DOKU mengirim `transaction.status = "EXPIRED"` (timeout 30 menit)

**Alur**:
```
DOKU Webhook → mapStatus('EXPIRED') = 'expired'
→ processPaymentStatusChange
→ order.payment_status = 'expired'
→ Reset confirmation_expires_at
```

**Yang terjadi**:
- Sama seperti FAILED, tapi status = 'expired'
- Customer masih bisa retry dari halaman confirm
- Jika `ExpirePendingOrders` job berjalan, order bisa di-cancel otomatis

**Data yang tersimpan**:
```sql
-- orders table
payment_status = 'expired'
confirmation_expires_at = '2026-07-06 10:45:00'
```

---

### 4.6 🔄 Pembayaran Dibatalkan (CANCELLED)

**Trigger**: DOKU mengirim `transaction.status = "CANCELLED"`

**Alur**:
```
DOKU Webhook → mapStatus('CANCELLED') = 'failed'
→ Sama dengan FAILED flow
```

---

### 4.7 🔁 Retry Payment (Customer klik "Bayar Lagi")

**Alur di `OrderController::pay()`** (POST `/customer/orders/{order}/pay`, throttle `pay-token`):

```
Customer klik "Bayar Lagi"
→ auth: payment access + validate payment_method
→ Guard: order terminal? → redirect
→ Guard: order.payment_status == 'paid'? → redirect ke confirm
→ Guard: PaymentTransaction sudah hit max_payment_attempts (default 3)? → error

→ Jika payment_status == 'failed' atau 'expired':
  1. syncStatusFromDoku(order) — cek apakah sudah terbayar
  2. Jika paid → redirect ke confirm
  3. Jika masih gagal → hapus transaksi failed, reset payment_status = null

→ Cek transaksi pending yang ada:
  1. Jika ada → syncStatusFromDoku
  2. Jika sudah paid → redirect

→ Hapus semua transaksi lama (cegah duplikat doku_order_id), reset doku_order_id = null
→ createPayment(order) — buat payment baru
→ Redirect ke DOKU hosted page
```

**Test**: `PaymentScenarioTest::test_pay_endpoint_rejects_*`, `PaymentAuthorizationMutationTest`

---

### 4.8 📊 Status Polling (Frontend)

**Endpoint**: `GET /customer/orders/{id}/payment-status` (throttle `60,1`)

**Alur**:
```
Frontend polling setiap 5 detik
→ paymentStatus() di OrderController
→ authorizePaymentAccess
→ Jika ada doku_order_id, selalu sync dari DOKU API (handle webhook delay)
→ Return JSON: { payment_status, doku_order_id, paid_at }
```

**Response**:
```json
{
    "payment_status": "pending",
    "doku_order_id": "INV-20260706-001",
    "paid_at": null
}
```

**Polling interval**: 5 detik (5000ms)

**Kapan berhenti polling**:
- `payment_status` berubah dari `pending` ke `paid`/`failed`/`expired`
- Frontend redirect ke halaman yang sesuai

---

### 4.9 🔙 Redirect dari DOKU

**Endpoint**: `GET /payment/doku/redirect?invoice_number=XXX&status=SUCCESS`

**Alur**:
```
Customer selesai bayar di DOKU
→ DOKU redirect ke /payment/doku/redirect?invoice_number=XXX&status=SUCCESS
→ Log ke PaymentWebhookLog (source: redirect)
→ Cari order by order_code atau doku_order_id
→ Sync status dari DOKU API 3x (retry 1.5s per attempt)
→ Jika sync sukses → redirect ke /customer/orders/{code}/confirm
→ Jika semua gagal → redirect ke confirm dengan error "Status pembayaran belum dapat diverifikasi."
→ Jika order tidak ditemukan → redirect ke customer.home
```

**Fallback logic** (jika sync API gagal): semua attempt gagal → ke confirm page dengan pesan error, DOKU redirect query `status` tidak diproses langsung (status final tetap ditentukan oleh API sync + webhook), bukan fallback explode.

---

### 4.10 🔄 Restore Cart (Setelah Payment Gagal)

**Endpoint**: `GET /customer/orders/{id}/restore-cart`

**Alur**:
```
Customer di halaman confirm, payment_status = failed/expired
→ Klik "Bayar Lagi" atau "Kembali"
→ Jika "Bayar Lagi": POST ke /pay → retry payment
→ Jika "Kembali": GET /restore-cart → redirect ke checkout dengan cart di-restore
```

**Kapan digunakan**:
- Payment gagal/expired → customer ingin pesan ulang
- Order cancelled → customer ingin pesan ulang
- Cart session sudah hilang → restore dari order items

---

### 4.11 💳 E-Wallet & Transfer Bank

**E-Wallet** (`ewallet`, termasuk legacy `gopay`/`shopeepay`/`dana`):
```
PaymentMethod → dokuType() = 'EWALLET'
channel = sesuai config (GOPAY / SHOPEEPAY / DANA)
```

**Transfer Bank** (`transfer`):
```
PaymentMethod → dokuType() = 'VA'
channel = 'BCA'
```

Keduanya lewat flow DOKU hosted payment page; hanya `payment_method_types` + `channel` yang berbeda.

---

## 5. Status Mapping

### DOKU → Dombi

| DOKU Status | Dombi Status | Keterangan |
|-------------|--------------|------------|
| `SUCCESS` | `paid` | Pembayaran berhasil |
| `PENDING` | `pending` | Menunggu pembayaran |
| `FAILED` | `failed` | Gagal (sistem) |
| `REJECTED` | `failed` | Ditolak DOKU |
| `DENIED` | `failed` | Ditolak bank |
| `CANCELLED` | `failed` | Dibatalkan |
| `EXPIRED` | `expired` | Timeout |
| *(lainnya)* | `pending` | Default + warning log |

**Code**: `DokuService::mapStatus()` (berbasis `strtoupper` + `match`)

### DOKU → Dombi (via enum `PaymentMethod::dokuType()`)

| Dombi Method | DOKU Type |
|--------------|-----------|
| `qris` | `QRIS` |
| `transfer` | `VA` |
| `ewallet` / `gopay` / `shopeepay` / `dana` | `EWALLET` |
| `credit_card` | `CREDIT_CARD` |
| *(default)* | `QRIS` |

### Payment Status Enum (`PaymentStatus.php`)

Dombi payment status dikelola enum, bukan string bebas:

| Status | Terminal | Keterangan |
|--------|----------|------------|
| `pending` | ✗ | Menunggu pembayaran |
| `paid` | ✗ | Dibayar |
| `failed` | ✗ | Gagal (bisa retry) |
| `expired` | ✗ | Expired (bisa retry) |
| `settled` | ✓ | Settlement selesai |
| `refund_pending` / `refund_in_progress` / `refund_rejected` | ✓ | Status refund |
| `refunded` | ✓ | Refund berhasil |
| `refund_failed` | ✓ | Legacy, tidak diproduksi kode baru |

Catatan: Backend tidak pernah menghasilkan status `cancelled` — `CANCELLED` DOKU di-map ke `failed`. Tipe `cancelled` di frontend `PaymentStatus` (`confirm.tsx`) hanya defensive programming.

---

### Frontend Status Type

Frontend (`confirm.tsx`) mendefinisikan tipe `PaymentStatus`:
```typescript
type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled';
```

**Catatan**: Backend tidak pernah menghasilkan status `cancelled` — DOKU's `CANCELLED` di-map ke `failed`. Tipe `cancelled` ada di frontend sebagai defensive programming.

---

## 6. Keamanan

### 6.1 Signature Verification (HMAC-SHA256)

**Setiap webhook diverifikasi sebelum diproses.**

**Algoritma**:
```
1. Ambil dari header:
   - Client-Id
   - Request-Id
   - Request-Timestamp
   - Signature

2. Validasi Client-Id dengan hash_equals (harus match config)

3. Validasi timestamp fresh: maks umur config('doku.webhook_max_age_seconds', 300) detik

4. Hitung SHA256 digest dari raw body:
   digest = base64(sha256(rawBody))

5. Assemble string:
   assembled = "Client-Id:{clientId}\n"
             + "Request-Id:{requestId}\n"
             + "Request-Timestamp:{timestamp}\n"
             + "Request-Target:/payment/doku/notify\n"
             + "Digest:{digest}"

6. Hitung expected signature:
   expected = "HMACSHA256=" + base64(hmac_sha256(assembled, secretKey))

7. Bandingkan dengan constant-time comparison:
   hash_equals(expected, provided_signature)
```

**Code**: `DokuService::verifySignature()`

**Catatan**: `Request-Target` di-hardcode ke `/payment/doku/notify`. Jika endpoint webhook berubah, update juga di `verifySignature()`.

**Test**: `DokuPaymentTest::test_webhook_invalid_signature_rejected`

### 6.2 Idempotency

**Mencegah webhook yang sama diproses dua kali.**

**Mekanisme**:
```php
// Di DokuPaymentController::notify()
$idempotencyKey = 'doku_webhook:' . $requestId;

if (Cache::has($idempotencyKey)) {
    return response()->json(['message' => 'OK']); // Sudah diproses
}

$doku->handleWebhook($payload);
Cache::put($idempotencyKey, true, 86400); // 24h TTL
```

**DOKU mengirim Request-Id yang sama untuk retry.** Sistem mendeteksi dan skip.

Sejak handleWebhook juga skip jika `payment_status_enum->isTerminal()`, double protection di service layer.

**Test**: `DokuPaymentTest::test_webhook_idempotent`

### 6.3 Audit Log & GET Verification

- **PaymentWebhookLog**: setiap webhook `notify` dan redirect dictatat (`status`: received → processed / signature_invalid / error).
- **GET verification request**: DOKU mengirim GET untuk verifikasi endpoint → di-return `OK` tanpa diproses.

### 6.4 Atomic Update (Race Condition Protection)

**Mencegah double-charge dari webhook + redirect yang datang bersamaan.**

Perlindungan dua lapis:
1. **Service layer**: `markOrderPaid()` memakai `PaymentStatusService::transition()` yang menolak transisi dari status terminal / sudah paid (ganti dari raw UPDATE).
2. **Transaction guard untuk late payment**: jika order sudah terminal (cancelled/expired), update + auto-refund dibungkus `DB::transaction` + `lockForUpdate`.

**Test**: `DokuPaymentAtomicTest`

### 6.5 CSRF Exemption

Webhook endpoint di-exempt dari CSRF karena dipanggil oleh server DOKU:

```php
// bootstrap/app.php
->withMiddleware(function (Middleware $middleware) {
    $middleware->validateCsrfTokens(except: [
        'payment/doku/*',
    ]);
})
```

### 6.6 Request-Id di createPayment & checkStatus

```php
// createPayment
$requestId = 'DMB-' . $order->id . '-' . time() . '-' . bin2hex(random_bytes(4));
// checkStatus
$requestId = 'CHK-' . $order->id . '-' . time();
```

Format `DMB-{orderId}-{timestamp}-{random}` — unik per request.

---

## 7. API Endpoints

### 7.1 Public Endpoints (No Auth)

| Method | Path | Handler | Deskripsi |
|--------|------|---------|-----------|
| GET/POST | `/payment/doku/notify` | `DokuPaymentController@notify` | Webhook dari DOKU (GET = endpoint verification, return OK) |
| GET | `/payment/doku/redirect` | `DokuPaymentController@redirect` | Redirect setelah bayar |

### 7.2 Customer Endpoints (Auth + throttle)

| Method | Path | Handler | Deskripsi |
|--------|------|---------|-----------|
| POST | `/checkout/payment` | `CustomerCheckoutController@submit` | Buat order + payment, throttle `payment-submit` |
| POST | `/customer/orders/{order}/pay` | `OrderController@pay` | Retry payment, throttle `pay-token` |
| GET | `/customer/orders/{order}/payment-status` | `OrderController@paymentStatus` | Status polling, throttle `60,1` |
| GET | `/customer/orders/{order}/restore-cart` | `OrderController@restoreCart` | Restore cart setelah payment gagal |

### 7.3 DOKU API Endpoints (Dipanggil oleh DokuService)

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/checkout/v1/payment` | Create payment session |
| GET | `/checkout/v1/payment/{invoiceNumber}` | Check payment status |

---

## 8. Database Schema

### orders table (kolom terkait payment)

```sql
doku_order_id        VARCHAR      -- Invoice number di DOKU (= order_code)
payment_status       VARCHAR      -- pending/paid/failed/expired/settled/refund_*/
payment_method       VARCHAR      -- qris/transfer/ewallet/credit_card (+ legacy gopay/shopeepay/dana)
paid_at              TIMESTAMP    -- Waktu pembayaran berhasil
confirmation_expires_at TIMESTAMP -- Batas waktu retry payment (config order.payment_retry_window_minutes, default 15 menit)
```

### payment_transactions table

```sql
id                   BIGINT     -- Primary key
order_id             BIGINT     -- FK ke orders
doku_order_id        VARCHAR    -- Invoice number (unique)
payment_method       VARCHAR    -- qris/ewallet/transfer/credit_card
amount               DECIMAL    -- Jumlah pembayaran
status               VARCHAR    -- pending/paid/settled/expired/failed
session_id           VARCHAR    -- DOKU session ID (nullable)
token_id             VARCHAR    -- DOKU token ID (nullable)
raw_response         JSON       -- Full response dari DOKU
created_at           TIMESTAMP
updated_at           TIMESTAMP
```

### payment_webhook_logs table

```sql
id                   BIGINT     -- Primary key
source               VARCHAR    -- 'notify' atau 'redirect'
request_id           VARCHAR    -- Request-Id header (nullable)
invoice_number       VARCHAR    -- doku_order_id (nullable)
status               VARCHAR    -- received/processed/signature_invalid/error
signature_valid      BOOLEAN
payload              JSON       -- Raw payload / query string
error                TEXT       -- nullable
```

---

## 9. Error Handling

### DokuPaymentException

```php
throw new DokuPaymentException(
    message: 'DOKU payment creation failed',
    responseCode: $response->status(),  // HTTP status code
    errors: $response->json('error_messages', []),
    original: $response                 // Full HTTP response
);
```

**User message**: `DokuPaymentException::getUserMessage()` → join error messages atau fallback ke message.

### Error Scenarios

| Skenario | Response | Customer Experience |
|----------|----------|---------------------|
| DOKU API down | `DokuPaymentException` | Redirect ke confirm page + error message |
| Missing payment URL | `DokuPaymentException('Invalid DOKU response structure')` | Sama |
| Invalid webhook signature / client id / stale timestamp | `401 Invalid signature` | Webhook ditolak, order tidak berubah |
| Order not found (webhook) | Log warning, return OK | Webhook acknowledged tapi tidak diproses |
| Status sync gagal (redirect) | Redirect confirm + pesan error "belum dapat diverifikasi" | Order tidak berubah, bisa di-cek ulang |
| DOKU 404 saat checkStatus | Log warning, return null | Tidak diasumsikan expired, payment_status dipertahankan |

---

## 10. Sandbox & Development Tools

### Manual Mark as Paid

Untuk sandbox dimana DOKU tidak selalu mengirim webhook:

```bash
php artisan doku:mark-paid ORDER_CODE
```

**Yang dilakukan**:
1. Cari order by `order_code`
2. Update `payment_status = 'paid'`, `paid_at = now()`
3. Update `PaymentTransaction` status ke `paid`
4. Trigger `processPaymentStatusChange()` (notifikasi, status change)

### Sandbox URLs

| Fungsi | URL |
|--------|-----|
| API | `https://api-sandbox.doku.com` |
| Payment Page | Diberikan oleh response `payment.url` |

### DOKU Card Test Numbers (Sandbox)

| Nomor Kartu | Skenario | Expected |
|-------------|----------|----------|
| 4617006911111106 | 3DS Success | paid |
| 4617006911111114 | 3DS Rejected by DOKU | failed |
| 4617006911111122 | 3DS Rejected by Bank | failed |
| 4617006911111130 | Non 3DS Success | paid |
| 4617006911111213 | Non 3DS Rejected by DOKU | failed |
| 4617006911111221 | Non 3DS Rejected by Bank | failed |

---

## 11. Testing / Audit Checklist

### Task 11 Refund Canonicalization

- [x] Rejected destination resubmit removes undefined metadata writes and performs exactly one canonical `rejected` → `pending` obligation transition.
- [x] Finance `action_required` filters selected refund reason and non-synthetic payment attempt.
- [x] Refund payload proof, transfer reference, and note read selected canonical obligation; legacy fields remain fallback only without obligation.
- [x] Regression coverage in `RefundServiceTest`, `RefundPayloadPrivacyTest`, and refund workspace suite.

### Unit Tests (`DokuPaymentTest.php`)

- [ ] `test_create_payment_returns_url` — createPayment mengembalikan URL
- [ ] `test_webhook_success_marks_paid` — webhook SUCCESS → order paid
- [ ] `test_webhook_invalid_signature_rejected` — signature invalid → 401
- [ ] `test_webhook_idempotent` — webhook duplikat di-skip
- [ ] `test_status_mapping` — semua DOKU status ter-map dengan benar

### Atomic / Authorization Tests

- [ ] `DokuPaymentAtomicTest` — webhook + redirect race tidak double-charge
- [ ] `PaymentAuthorizationMutationTest` — semua mutation payment harus ter-otorisasi

### Integration Tests (`PaymentScenarioTest.php`)

- [ ] `test_map_status_*` — semua status mapping (SUCCESS, PENDING, FAILED, REJECTED, DENIED, CANCELLED, EXPIRED, UNKNOWN)
- [ ] `test_payment_rejected_expires_order` — REJECTED → failed
- [ ] `test_payment_success_marks_order_paid` — SUCCESS → paid
- [ ] `test_payment_cancelled_maps_to_failed` — CANCELLED → failed
- [ ] `test_payment_expired_maps_to_expired` — EXPIRED → expired
- [ ] `test_pay_endpoint_rejects_*` — tolak retry pada order paid / terminal / melebihi max attempts
- [ ] `test_payment_status_endpoint_returns_*` — polling endpoint works
- [ ] `test_restore_cart_redirects_to_checkout` — restore cart flow
- [ ] `test_doku_card_scenario_*` — 6 kartu test DOKU

### Failure Flow Tests (`PaymentFailureFlowTest.php`)

- [ ] `test_payment_status_endpoint_returns_current_status` — status endpoint
- [ ] `test_payment_status_syncs_from_doku` — sync dari DOKU API
- [ ] `test_restore_cart_redirects_to_checkout` — restore cart

### Payment Reliability (`PaymentReliabilityTest.php`)

- [ ] retry & timeout handling
- [ ] late payment (setelah cancel/expiry) → auto-refund

### Manual Audit Scenarios

| # | Skenario | Steps | Expected Result |
|---|----------|-------|-----------------|
| 1 | **QRIS Payment Success** | Checkout → Scan QRIS → Bayar | Order status = confirmed, payment_status = paid |
| 2 | **QRIS Payment Expired** | Checkout → Tidak bayar 30 menit | payment_status = expired, bisa retry |
| 3 | **Card 3DS Success** | Checkout → Card 4617006911111106 → 3DS | payment_status = paid |
| 4 | **Card 3DS Rejected** | Checkout → Card 4617006911111114 | payment_status = failed |
| 5 | **Retry Payment** | Bayar gagal → Klik "Bayar Lagi" | Payment baru dibuat, redirect ke DOKU |
| 6 | **Double Webhook** | Kirim webhook yang sama 2x | Hanya diproses sekali (idempotent) |
| 7 | **Webhook + Redirect** | Bayar → webhook + redirect datang bersamaan | Tidak double-charge (atomic update) |
| 8 | **Invalid Signature** | Kirim webhook dengan signature salah | 401, order tidak berubah |
| 9 | **E-Wallet / VA** | Checkout dengan ewallet/transfer | payment_url sesuai channel, status mapping benar |
| 10 | **Status Polling** | Bayar → polling /payment-status | Return status terbaru dari DOKU API |
| 11 | **Network Error** | DOKU API timeout saat createPayment | Error message, order tetap, bisa retry |
| 12 | **Order Not Found** | Webhook dengan invoice_number salah | Log warning, return OK |
| 13 | **Restore Cart** | Payment gagal → Klik "Kembali" | Cart di-restore, redirect ke checkout |
| 14 | **Late Payment** | Bayar setelah order expired/cancelled | Auto-refund (tidak di-charge double) |

### Command untuk Run Tests

```bash
# Semua payment tests
php artisan test --filter=DokuPaymentTest
php artisan test --filter=PaymentScenarioTest
php artisan test --filter=PaymentFailureFlowTest
php artisan test --filter=PaymentReliabilityTest
php artisan test --filter=DokuPaymentAtomicTest
php artisan test --filter=PaymentAuthorizationMutationTest
php artisan test --filter=PaymentFeeIntegrationTest

# Semua sekaligus
php artisan test --filter="Doku|Payment"
```

---

## Lampiran: Contoh Webhook Payload

### QRIS Success
```json
{
    "service": { "id": "VIRTUAL_ACCOUNT" },
    "acquirer": { "id": "DOKU" },
    "channel": { "id": "VIRTUAL_ACCOUNT_DOKU" },
    "transaction": {
        "status": "SUCCESS",
        "date": "2026-07-06T10:30:00Z",
        "original_request_id": "DMB-123-1720261800"
    },
    "order": {
        "invoice_number": "INV-20260706-001",
        "amount": 50000
    }
}
```

### Request Headers (Webhook)
```
Client-Id: your-client-id
Request-Id: DMB-123-1720261800
Request-Timestamp: 2026-07-06T10:30:00Z
Signature: HMACSHA256=base64...
Content-Type: application/json
```

---

*Dokumen ini disinkronkan dengan kode aktual di repository Dombi. Terakhir diperbarui: 5 Agustus 2026.*
