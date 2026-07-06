# Doku Payment System — Specification

> Spesifikasi lengkap sistem pembayaran DOKU untuk Dombi. Dokumen ini adalah sumber kebenaran (source of truth) untuk semua behavior payment. Tidak boleh ada implementation yang melenceng dari spec ini.

---

## 1. Payment State Machine

### 1.1 Status Fields

Setiap order punya 3 status yang berhubungan dengan payment:

| Field | Tipe | Values | Keterangan |
|-------|------|--------|------------|
| `Order.status` | string | `pending_confirmation`, `confirmed`, `preparing`, `ready_for_pickup`, `picked_up`, `delivering`, `completed`, `cancelled_by_customer`, `cancelled_by_outlet`, `rejected_by_outlet`, `failed_delivery`, `expired` | Status order secara keseluruhan |
| `Order.payment_status` | string\|null | `null`, `pending`, `paid`, `failed`, `expired` | Status pembayaran |
| `PaymentTransaction.status` | string | `pending`, `paid`, `failed`, `expired` | Status transaksi DOKU |

### 1.2 State Transitions

```
payment_status:
  null → pending     (createPayment success)
  pending → paid     (webhook SUCCESS / syncStatusFromDoku SUCCESS)
  pending → failed   (webhook REJECTED/DENIED/CANCELLED / redirect sync)
  pending → expired  (webhook EXPIRED / scheduled command)
  failed → null      (pay() retry — cleanup old tx)
  expired → null     (pay() retry — cleanup old tx)

Order.status:
  pending_confirmation → confirmed    (markOrderPaid — payment success)
  pending_confirmation → expired      (expireOrder — timeout/scheduled)
  pending_confirmation → cancelled_by_customer  (cancelByCustomer)
  pending_confirmation → rejected_by_outlet     (rejectOrder)
```

### 1.3 Invariants (HARUS selalu true)

| # | Invariant | Enforcement |
|---|-----------|-------------|
| I1 | `payment_status = paid` → `status` harus `confirmed` atau lebih tinggi | `markOrderPaid()` atomic update |
| I2 | `payment_status = failed/expired` + `status = pending_confirmation` → stock HARUS di-release | `processPaymentStatusChange()` |
| I3 | Hanya SATU `PaymentTransaction` dengan status `pending` per order | `pay()` cleanup sebelum create baru |
| I4 | `payment_status` tidak boleh `null` kalau order sudah submit ke DOKU | `createPayment()` set `payment_status = pending` |
| I5 | `reserved_stock` harus 0 untuk order terminal (expired/cancelled/rejected/completed) | `expireOrder()`, `cancelByCustomer()`, `rejectOrder()` |

---

## 2. Payment Flows

### 2.1 Checkout Flow (Create Order + Payment)

```
Customer klik "Bayar" di checkout/payment.tsx
  → POST /customer/checkout/payment
  → CheckoutController::submit()
    1. Validate session data (cart, fulfillment, customer, location)
    2. Idempotency check (fingerprint hash, 60s TTL)
    3. Calculate subtotal, delivery fee, payment fee
    4. OrderService::createCheckoutOrder()
       → Order::create() → payment_status = null
       → InventoryService::reserveStock() → reserved_stock += qty
    5. DokuService::createPayment()
       → POST /checkout/v1/payment ke DOKU
       → PaymentTransaction::create() → status = pending
       → Order::update() → payment_status = pending, doku_order_id = invoice_number
       → Return payment URL
    6. Clear cart session (HANYA setelah payment URL berhasil)
    7. Return redirect ke DOKU payment page
```

**Error handling:**
- `DokuPaymentException` → `expireOrder()` (release stock) → redirect checkout dengan error
- Generic exception → `expireOrder()` → redirect checkout dengan error
- Cart TIDAK di-clear kalau DOKU API gagal

### 2.2 DOKU Payment — Success (3DS / Non-3DS)

```
Customer di DOKU payment page → bayar → success
  → DOKU kirim webhook POST /payment/doku/notify
    → notify() verify HMAC signature
      → Signature verification: check headers (Request-Timestamp, Signature) first, then payload body
      → Format: SHA256(clientId:requestId:requestTimestamp:body:secretKey)
    → handleWebhook()
      → find PaymentTransaction by doku_order_id
      → mapStatus('SUCCESS') → 'paid'
      → update PaymentTransaction.status = 'paid'
      → processPaymentStatusChange(order, 'paid')
        → markOrderPaid()
          → Atomic: where payment_status != 'paid' → update paid_at, payment_status = paid
          → If updated == 0: return (already paid by concurrent request)
          → order.update status = confirmed, confirmed_at = now()
          → notifyOrderConfirmed() → customer notification
          → notifyOrderCreated() → outlet notification
          → Cache::forget()
  → DOKU redirect browser ke /payment/doku/redirect
    → redirect()
      → syncStatusFromDoku() with retry (3 attempts, 1.5s delay between retries)
      → If all attempts fail: fallback to status from query param (`?status=SUCCESS`)
      → redirect ke /customer/orders/confirm/{orderCode}
  → Confirm page tampil "Pembayaran Berhasil" + "Lihat Pesanan"
```

### 2.3 DOKU Payment — Failed (3DS Rejected / Bank Rejected)

```
Customer di DOKU → 3DS rejected / bank rejected
  → DOKU kirim webhook POST /payment/doku/notify
    → handleWebhook()
      → mapStatus('REJECTED') → 'failed'
      → update PaymentTransaction.status = 'failed'
      → processPaymentStatusChange(order, 'failed')
        → order.update payment_status = 'failed'
        → JANGAN expire order — biarkan status = pending_confirmation
        → Customer bisa retry
  → DOKU redirect browser ke /payment/doku/redirect
    → redirect()
      → syncStatusFromDoku() with retry (3 attempts, 1.5s delay)
      → If all attempts fail: fallback to status from query param (`?status=REJECTED`)
      → redirect ke /customer/orders/confirm/{orderCode}
  → Confirm page tampil "Pembayaran Gagal" + "Bayar Sekarang"
```

**PENTING:** Payment failed JANGAN expire order. Order tetap `pending_confirmation` supaya customer bisa retry. Order hanya expired kalau:
1. `confirmation_expires_at` timeout (scheduled command)
2. Customer cancel manual
3. Outlet reject

### 2.4 DOKU Payment — Expired (Timeout)

```
Customer di DOKU → tidak bayar dalam waktu yang ditentukan
  → DOKU kirim webhook POST /payment/doku/notify
    → handleWebhook()
      → mapStatus('EXPIRED') → 'expired'
      → update PaymentTransaction.status = 'expired'
      → processPaymentStatusChange(order, 'expired')
        → order.update payment_status = 'expired'
        → if status == pending_confirmation:
          → expireOrder()
            → releaseReservedStock() → reserved_stock -= qty
            → order.update status = EXPIRED
            → notifyOrderExpired()
  → Atau: scheduled command orders:expire-pending
    → expirePendingOrders()
      → where status = pending_confirmation AND confirmation_expires_at < now()
      → expireOrder() → release stock
```

### 2.5 Retry Payment (Setelah Failed)

```
Customer klik "Bayar Sekarang" di confirm page
  → form.submit() → POST /customer/orders/{id}/pay
  → OrderController::pay()
    1. Ownership check (logged-in / guest recovery / fresh order)
    2. Guard: terminal status (completed/cancelled/rejected/expired) → reject
    3. Guard: already paid → redirect confirm
    4. If payment_status = failed/expired:
       → syncStatusFromDoku() — recheck from DOKU
       → If still failed:
         → paymentTransactions()->delete() — cleanup old tx
         → order.update doku_order_id = null, payment_status = null
    5. Cleanup all old transactions
    6. DokuService::createPayment() — create fresh payment
    7. redirect()->away(paymentUrl) → browser ke DOKU
```

### 2.6 Retry Payment — Expired Order (Reject)

```
Customer klik "Bayar Sekarang" untuk order yang sudah expired
  → POST /customer/orders/{id}/pay
  → OrderController::pay()
    → Guard: status = expired → reject
    → Return error: "Pesanan sudah tidak aktif"
  → Customer harus restore-cart → checkout ulang → order baru
```

### 2.7 Webhook Lost / Not Received

```
Webhook tidak sampai (DOKU server down, network issue, CSRF error)
  → Customer redirect balik ke /payment/doku/redirect
    → redirect()
      → syncStatusFromDoku() with retry 3 attempts, 1.5s delay between retries
      → Jika semua attempts gagal (404 session expired / network error):
        → Fallback: gunakan status dari query param (`?status=SUCCESS`)
        → Jika tidak ada query param: return current payment_status (stuck di pending)
  → Confirm page polling /payment-status setiap 5 detik
    → paymentStatus()
      → syncStatusFromDoku()
      → Jika DOKU API masih gagal: return current status
  → Scheduled command orders:expire-pending
    → Expire order yang sudah lewat confirmation_expires_at
    → release stock
```

### 2.8 Customer Close Browser Mid-Payment

```
Customer di DOKU page → close browser
  → Tidak ada webhook/redirect
  → Order tetap pending_confirmation
  → confirmation_expires_at timeout (15 menit)
  → Scheduled command expireOrder() → release stock
```

---

## 3. Concurrency & Safety

### 3.1 Race Condition: Webhook + Redirect

DOKU bisa kirim webhook DAN redirect browser secara bersamaan.

**Solution:** Atomic update di `markOrderPaid()`:

```php
$updated = Order::where('id', $order->id)
    ->where('payment_status', '!=', 'paid')
    ->update(['paid_at' => now(), 'payment_status' => 'paid']);

if ($updated === 0) return; // Already paid by concurrent request
```

### 3.2 Race Condition: Double Webhook

DOKU bisa retry webhook dengan `Request-Id` yang sama.

**Solution:** Idempotency cache di `DokuPaymentController::notify()`:

```php
$idempotencyKey = 'doku_webhook:' . $requestId;
if (Cache::has($idempotencyKey)) return 200 OK;
// ... process ...
Cache::put($idempotencyKey, true, 86400);
```

### 3.3 Race Condition: Double Retry

Customer bisa klik "Bayar Sekarang" berkali-kali.

**Solution:**
- Frontend: `setPayLoading(true)` disable tombol
- Backend: `pay()` cleanup semua old transaction sebelum create baru
- DOKU: `invoice_number` unik per order → DOKU reject duplicate

### 3.4 Stock Consistency

| Event | Stock Action |
|-------|-------------|
| Order created | `reserved_stock += qty` |
| Payment success | `reserved_stock` tetap (stock sudah di-reserve) |
| Payment failed | `reserved_stock` tetap (stock masih di-reserve, customer bisa retry) |
| Payment expired | `reserved_stock -= qty` (release) |
| Customer cancel | `reserved_stock -= qty` (release) |
| Outlet reject | `reserved_stock -= qty` (release) |
| Scheduled expire | `reserved_stock -= qty` (release) |

**Invariant:** `reserved_stock` harus 0 untuk order yang sudah terminal (expired/cancelled/rejected/completed).

**Drift handling:** Kalau `reserved_stock < quantity` (data inconsistency), set ke 0 + log warning.

---

## 4. Error Handling & Edge Cases

### 4.1 DOKU API Gagal (Create Payment)

```
DokuService::createPayment() throws DokuPaymentException
  → CheckoutController::submit() catch block:
    → expireOrder() → release stock
    → Cart TIDAK di-clear
    → Redirect checkout dengan error message
```

### 4.2 DOKU Webhook Tidak Sampai

```
Webhook tidak sampai → fallback: redirect sync + polling + scheduled command
```

### 4.3 DOKU Session Expired (404)

```
checkStatus() return 404 (session expired)
  → syncStatusFromDoku() return current payment_status tanpa perubahan
  → Log::info('DOKU status check: session may have expired')
  → Tidak ada action → biarkan scheduled command handle
```

### 4.4 Payment Status Stuck di Pending

```
payment_status = pending tapi order sudah lewat confirmation_expires_at
  → Scheduled command orders:expire-pending
    → where status = pending_confirmation AND confirmation_expires_at < now()
    → expireOrder() → release stock
    → payment_status = expired
```

### 4.5 Database Cleanup (Stuck Payments)

```
orders dengan payment_status = pending tapi sudah lewat confirmation_expires_at
  → Scheduled command handle
  → Atau manual: update payment_status = expired, expireOrder()
```

---

## 5. API Endpoints

### 5.1 Checkout

| Method | Path | Handler | Auth | Throttle |
|--------|------|---------|------|----------|
| POST | `/customer/checkout/payment` | `CheckoutController::submit` | guest.or.customer | payment-submit |

### 5.2 Order Payment

| Method | Path | Handler | Auth | Throttle |
|--------|------|---------|------|----------|
| POST | `/customer/orders/{order}/pay` | `OrderController::pay` | in-controller | pay-token |
| GET | `/customer/orders/{order}/payment-status` | `OrderController::paymentStatus` | in-controller | 60,1 |
| GET | `/customer/orders/confirm/{orderCode}` | `OrderController::confirm` | guest.or.customer | none |
| GET | `/customer/orders/{order}/restore-cart` | `OrderController::restoreCart` | customer.or.recovered | none |

### 5.3 DOKU Callbacks

| Method | Path | Handler | Auth | CSRF |
|--------|------|---------|------|------|
| GET/POST | `/payment/doku/notify` | `DokuPaymentController::notify` | HMAC signature | exempt |
| GET/POST | `/payment/doku/redirect` | `DokuPaymentController::redirect` | none | exempt |

---

## 6. Testing Requirements

### 6.1 Unit Tests

| Test | Assertion |
|------|-----------|
| `mapStatus('SUCCESS')` → `'paid'` | ✅ |
| `mapStatus('REJECTED')` → `'failed'` | ✅ |
| `mapStatus('EXPIRED')` → `'expired'` | ✅ |
| `mapStatus(null)` → `'pending'` + warning log | ✅ |
| `mapStatus('UNKNOWN')` → `'pending'` + warning log | ✅ |

### 6.2 Integration Tests

| Test | Assertion |
|------|-----------|
| Payment success → `payment_status = paid`, `status = confirmed` | ✅ |
| Payment failed → `payment_status = failed`, `status = pending_confirmation` | ✅ |
| Payment expired → `payment_status = expired`, `status = expired` | ✅ |
| Retry after failed → cleanup old tx, create new payment | ✅ |
| Retry after expired → reject (403) | ✅ |
| Concurrent webhook + redirect → no double notification | ✅ |
| Double webhook (same Request-Id) → idempotent | ✅ |
| Stock reserved on order creation | ✅ |
| Stock released on payment failed | ❌ (stock tetap, customer bisa retry) |
| Stock released on payment expired | ✅ |
| Stock released on customer cancel | ✅ |
| Stock released on scheduled expire | ✅ |

### 6.3 End-to-End Scenarios

| Scenario | Steps | Expected |
|----------|-------|----------|
| 3DS success | Create → DOKU → 3DS → success → webhook | paid, confirmed, stock reserved |
| 3DS reject DOKU | Create → DOKU → 3DS → reject → webhook | failed, pending_confirmation, stock reserved |
| 3DS reject bank | Create → DOKU → 3DS → bank reject → webhook | failed, pending_confirmation, stock reserved |
| Non-3DS success | Create → DOKU → success → webhook | paid, confirmed, stock reserved |
| Non-3DS reject | Create → DOKU → reject → webhook | failed, pending_confirmation, stock reserved |
| Payment timeout | Create → DOKU → timeout → webhook | expired, expired, stock released |
| Retry after failed | Failed → "Bayar Sekarang" → DOKU → success | paid, confirmed, stock reserved |
| Retry after expired | Expired → "Bayar Sekarang" → reject | Error: "Pesanan sudah tidak aktif" |
| Webhook lost | Create → DOKU → success → webhook lost → redirect sync | paid, confirmed |
| Browser close | Create → DOKU → close → scheduled expire | expired, stock released |

---

## 7. Key Files

| File | Responsibility |
|------|---------------|
| `app/Services/DokuService.php` | Core DOKU integration: createPayment, handleWebhook, syncStatusFromDoku, markOrderPaid, processPaymentStatusChange, verifySignature, mapStatus |
| `app/Http/Controllers/Customer/CheckoutController.php` | Checkout flow: submit() creates order + payment |
| `app/Http/Controllers/Customer/OrderController.php` | pay(), paymentStatus(), confirm(), restoreCart() |
| `app/Http/Controllers/DokuPaymentController.php` | notify() webhook (GET+POST), redirect() callback with retry |
| `app/Services/OrderStatusService.php` | expireOrder() with stock release |
| `app/Services/InventoryService.php` | reserveStock(), releaseReservedStock() |
| `app/Console/Commands/DokuMarkPaid.php` | Sandbox-only: manually mark order as paid |
| `config/doku.php` | DOKU config including callback_url from env |
| `bootstrap/app.php` | CSRF exceptions for DOKU webhook |
| `routes/web.php` | All payment routes |

---

## 8. Known Issues & Fixes

| # | Issue | Status | Fix |
|---|-------|--------|-----|
| 1 | CSRF block DOKU webhook | ✅ Fixed | Added `payment/doku/notify` to CSRF exceptions |
| 2 | `callback_url_result` ke Inertia page | ✅ Fixed | Changed to `route('doku.notify')` |
| 3 | `callback_url` salah (tanpa prefix) | ✅ Fixed | Changed to `route('doku.redirect')` |
| 4 | Redirect route hanya GET | ✅ Fixed | `Route::match(['get','post'])` |
| 5 | Race condition `markOrderPaid` | ✅ Fixed | Atomic `where()->update()` |
| 6 | Code duplication webhook+sync | ✅ Fixed | Extract `processPaymentStatusChange()` |
| 7 | Amount mismatch (subtotal vs total) | ✅ Fixed | `(int) $order->subtotal` |
| 8 | Hardcoded `qris` di transaction | ✅ Fixed | `$order->payment_method` |
| 9 | Null deref `buildCustomerInfo` | ✅ Fixed | `$customer?->name` |
| 10 | `handlePay` fetch CORS block | ✅ Fixed | Form submission |
| 11 | `replaceState` poison Referer | ✅ Fixed | `pushState` + `popstate` |
| 12 | Duplicate `doku_order_id` on retry | ✅ Fixed | Cleanup old transactions |
| 13 | Guest 403 `paymentStatus` | ✅ Fixed | Add guest ownership check |
| 14 | `paymentStatus` init salah | ✅ Fixed | Init from actual status |
| 15 | Cart clear sebelum DOKU API | ✅ Fixed | Move after success |
| 16 | Unknown status silent `pending` | ✅ Fixed | Log warning |
| 17 | Database stuck pending | ✅ Fixed | Manual cleanup |
| 18 | Payment failed langsung expire order | ✅ Fixed | `processPaymentStatusChange()`: failed/expired keeps `pending_confirmation`, allows retry |
| 19 | Notify route hanya POST | ✅ Fixed | `Route::match(['get', 'post'])` — DOKU sandbox sends GET |
| 20 | Signature verification body only | ✅ Fixed | Check headers (Request-Timestamp, Signature) first, then body fallback |
| 21 | `callback_url_result` hardcoded | ✅ Fixed | Use `config('doku.callback_url')` with fallback to `route()` |
| 22 | Redirect sync fails immediately | ✅ Fixed | Retry 3 attempts with 1.5s delay, fallback to query param status |

---

## 9. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DOKU_CLIENT_ID` | ✅ | — | DOKU client ID |
| `DOKU_API_KEY` | ✅ | — | DOKU API secret key |
| `DOKU_IS_SANDBOX` | ❌ | `true` | Set `false` for production |
| `DOKU_CALLBACK_URL` | ❌ | `APP_URL/payment/doku/notify` | Override webhook URL (use ngrok for sandbox) |
| `APP_URL` | ✅ | — | Must match production domain for webhook to work |

**Production checklist:**
- `APP_URL` = production domain (HTTPS required)
- `DOKU_IS_SANDBOX=false`
- `DOKU_CLIENT_ID` = production client ID
- `DOKU_API_KEY` = production API key
- Remove `DOKU_CALLBACK_URL` from `.env` (falls back to `APP_URL/payment/doku/notify`)

---

## 10. Sandbox Limitations

DOKU sandbox has significant limitations for testing:

| Feature | Sandbox Support | Workaround |
|---------|----------------|------------|
| Webhook POST | ❌ Does not send | Use redirect sync + fallback |
| Status check API | ❌ Returns 404 | Use `doku:mark-paid` command |
| Payment flow | ✅ Works | — |
| Email confirmation | ✅ Works | — |

**Sandbox testing workflow:**
1. Create order via checkout
2. Complete payment on DOKU sandbox
3. Redirect handler attempts sync (will fail with 404)
4. Uses fallback status from query param
5. If still pending: `php artisan doku:mark-paid {order_code}`

**Production:** Webhook works normally, no workarounds needed.
