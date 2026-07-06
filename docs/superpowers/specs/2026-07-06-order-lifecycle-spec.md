# Order Lifecycle Complete Spec

## 1. Overview

Documentasi LENGKAP semua kemungkinan route dari order creation sampai terminal state. Mencakup:

- 1 success route (happy path)
- 12 failure/exception routes
- 15+ edge cases
- Notification matrix per state
- Customer Credit System (baru)
- Gap analysis + prioritas

### Order Statuses

```
ACTIVE STATES:          TERMINAL STATES:
pending_confirmation    completed
confirmed               cancelled_by_customer
preparing               cancelled_by_outlet
ready_for_pickup        rejected_by_outlet
picked_up               failed_delivery
delivering              expired
```

### Payment Status (terpisah dari order status)

```
null → pending → paid
                 failed
                 expired
```

### Fulfillment Types

```
pickup, delivery_dombi, delivery_ojol
```

### Payment Methods

```
qris, credit_card
(TIDAK ADA COD — dihapus)
```

---

## 2. Happy Path (Success Route)

```
Customer          System            DOKU           Outlet         Courier
    │                │                │               │              │
    │  checkout      │                │               │              │
    ├───────────────►│                │               │              │
    │                │  create order  │               │              │
    │                │  reserve stock │               │              │
    │                │  pay via DOKU  │               │              │
    │                ├───────────────►│               │              │
    │                │  payment_url   │               │              │
    │                │◄───────────────┤               │              │
    │  redirect DOKU │                │               │              │
    │◄───────────────┤                │               │              │
    │                │                │               │              │
    │  pay (QRIS/CC) │                │               │              │
    ├────────────────────────────────►│               │              │
    │                │  webhook paid  │               │              │
    │                │◄───────────────┤               │              │
    │                │                │               │              │
    │                │  status: pending → confirmed   │              │
    │                │  (auto via DokuService)        │              │
    │                │                │               │              │
    │                │  notify: order.confirmed        │              │
    │                ├────────────────────────────────►│              │
    │  "Dikonfirmasi"│                │               │              │
    │◄───────────────┤                │               │              │
    │                │                │               │              │
    │                │                │    outlet tap "Mulai Persiapan"
    │                │  confirmed → preparing          │              │
    │                │◄────────────────────────────────┤              │
    │                │                │               │              │
    │                │                │    outlet tap "Siap Diambil"  │
    │                │  preparing → ready_for_pickup   │              │
    │                │◄────────────────────────────────┤              │
    │                │                │               │              │
    │   ┌────────────┴────────────────────────────────┐              │
    │   │ PICKUP PATH                │ DELIVERY PATH  │              │
    │   │                            │                │              │
    │   │ outlet scan QR             │ assign courier │              │
    │   │ OR tap "Serahkan"          │                │              │
    │   │                            │ waiting_pickup │              │
    │   │ ready → completed          ├───────────────────────────────►│
    │   │ (langsung selesai)         │                │              │
    │   │                            │ courier accept │              │
    │   │                            │ picked_up      │              │
    │   │                            │◄──────────────────────────────┤
    │   │                            │                │              │
    │   │                            │ start delivery │              │
    │   │                            │ delivering     │              │
    │   │                            │◄──────────────────────────────┤
    │   │                            │                │              │
    │   │                            │ complete       │              │
    │   │                            │ completed      │              │
    │   │                            │◄──────────────────────────────┤
    │   └────────────────────────────┘                │              │
    │                │                │               │              │
    │  "Selesai"     │                │               │              │
    │◄───────────────┤                │               │              │
    │                │                │               │              │
    │                │  stock deducted (OutletInventory)             │
    │                │  settlement recorded                          │
    │                │  PaymentTransaction → paid                    │
```

### Data Mutations Per Step

| Step | Order Fields Changed | Side Effects |
|------|---------------------|--------------|
| Create | status=pending_confirmation, ordered_at, confirmation_expires_at=now+outlet.timeout | Stock reserved, OrderStatusHistory. Outlet TIDAK di-notify sampai payment success. |
| Payment success | payment_status=paid, paid_at, status→confirmed, confirmed_at | Stock preserved, notifyCustomer, notifyOutlet |
| Outlet preparing | status=preparing, confirmed_by | — |
| Outlet ready | status=ready_for_pickup | — |
| Courier assign | — | Delivery created (waiting_pickup), notifyCustomer, notifyCourier |
| Courier pickup | — | Delivery→picked_up, order→picked_up, notifyCustomer |
| Courier start | — | Delivery→delivering, order→delivering, notifyCustomer |
| Courier complete | status=completed | Delivery→completed, stock deducted, settlement recorded, notifyCustomer, notifyOutlet |
| OR Outlet completePickup (pickup) | status=completed | Stock deducted, settlement recorded, notifyCustomer |

---

## 3. Payment Failure Routes

### 3a. DOKU API Error (No Payment URL)

```
Customer              System              DOKU
    │                    │                    │
    │ submit checkout    │                    │
    ├───────────────►│                    │
    │                    │ createOrder() OK   │
    │                    │ createPayment() ──►│
    │                    │                    │ timeout/500
    │                    │ ◄── error ─────────┤
    │                    │                    │
    │                    │ DokuPaymentException│
    │                    │ (logged, not thrown)│
    │                    │                    │
    │ ◄── redirect confirm page + error flash │
    │                    │                    │
    │ order created:     │                    │
    │ payment_status=null│                    │
    │ doku_order_id=null │                    │
    │ confirmation_expires_at = now + timeout │
```

**Fix needed:** Reset `confirmation_expires_at` saat DOKU API error, sama seperti failed/expired.

### 3b. Payment Rejected (Insufficient Funds, etc)

```
DOKU webhook: FAILED/REJECTED/DENIED/CANCELLED
  → payment_status = failed
  → confirmation_expires_at = now + outlet.confirmation_timeout_minutes (default 15m, reset)
  → order tetap pending_confirmation
  → customer bisa retry payment
```

### 3c. Payment Expired (DOKU Session Timeout)

```
DOKU webhook: EXPIRED
  → payment_status = expired
  → confirmation_expires_at = now + outlet.confirmation_timeout_minutes (default 15m, reset)
  → order tetap pending_confirmation
  → customer bisa retry payment
```

### 3d. Customer Abandons (Close Browser)

```
payment_status = pending/null
confirmation_expires_at = created + timeout
ExpireJob (every minute):
  WHERE confirmation_expires_at < now()
  → status = expired
  → stock released
  → notify customer
```

### 3e. Retry Payment (from Failed/Expired)

```
Customer tap "Bayar Ulang"
  → clean old PaymentTransaction
  → create new DOKU payment
  → new payment_status = pending
  → new confirmation_expires_at = now + timeout
  → if success: status → confirmed
  → if fail again: back to retry window
```

### Payment Failure Matrix

| Trigger | payment_status | order.status | confirmation_expires_at | Customer Action |
|---------|---------------|-------------|------------------------|-----------------|
| DOKU API error | null | pending_confirmation | reset = now + timeout | Retry from confirm page |
| DOKU FAILED/REJECTED | failed | pending_confirmation | reset = now + timeout | Retry from confirm page |
| DOKU EXPIRED | expired | pending_confirmation | reset = now + timeout | Retry from confirm page |
| Customer abandons | pending/null | pending_confirmation | created + timeout | ExpireJob → expired |
| Retry → success | paid | → confirmed | — | — |
| Retry → fail again | failed | pending_confirmation | reset again | Retry again |
| All retries exhausted + timeout | failed | → expired (ExpireJob) | — | Notify customer |

---

## 3b. Customer Cancel Flow

```
Customer              System              Outlet
    │                    │                   │
    │ tap "Batalkan"     │                   │
    ├───────────────────►│                   │
    │                    │                   │
    │ pilih alasan       │                   │
    │ (wajib)            │                   │
    │                    │                   │
    │ validasi:          │                   │
    │ - status allowed?  │                   │
    │   (pending_conf,   │                   │
    │    confirmed,      │                   │
    │    preparing)      │                   │
    │ - NOT allowed:     │                   │
    │   ready_for_pickup │                   │
    │   picked_up        │                   │
    │   delivering       │                   │
    │                    │                   │
    │ status → cancelled_by_customer         │
    │ cancelled_at, cancelled_reason         │
    │ stock: released                         │
    │                    │                   │
    │ if payment_status=paid:                │
    │   refund ke Customer Credit            │
    │   credit_balance += order.total        │
    │                    │ notify ──────────►│
    │                    │ "Dibatalkan"      │
```

### Cancel Allowed From

| Status | Bisa cancel? | Reason |
|--------|-------------|--------|
| pending_confirmation | ✅ | Belum diproses |
| confirmed | ✅ | Sudah diterima outlet, belum mulai proses |
| preparing | ✅ | Sedang diproses, cancel = stock released + refund |
| ready_for_pickup | ❌ | Sudah siap, tidak bisa cancel sendiri |
| picked_up | ❌ | Sudah di kurir |
| delivering | ❌ | Sedang diantar |
| completed | ❌ | Sudah selesai |
| rejected_by_outlet | ❌ | Sudah ditolak |
| expired | ❌ | Sudah expired |
| cancelled_by_outlet | ❌ | Sudah dibatalkan outlet |
| failed_delivery | ❌ | Sudah gagal |

**Customer cancel alasan (wajib):**
- Berubah pikiran
- Salah pesan
- Tidak jadi
- Lainnya (opsional text)

---

## 4. Outlet Rejection & Cancel Routes

### 4a. Reject (from pending_confirmation)

```
outlet tap "Tolak"
  + pilih alasan + optional note
  → status = rejected_by_outlet
  → rejected_at, rejected_by, rejection_reason, rejection_note
  → payment_status tetap "paid" (jika sudah bayar)
  → stock released
  → refund ke Customer Credit (jika paid)
  → notify: customer + owner
```

### 4b. Cancel (from confirmed/preparing/ready_for_pickup)

```
outlet tap "Batalkan"
  + pilih alasan
  → status = cancelled_by_outlet
  → cancelled_at, cancelled_by
  → stock released
  → refund ke Customer Credit (jika paid)
  → notify: customer
```

### 4c. Cancel After Delivery Fail

```
Delivery failed → owner resolve "cancelled_and_released"
  → status = cancelled_by_outlet
  → stock released
  → refund ke Customer Credit (jika paid)
```

### Refund → Customer Credit

Semua route yang sudah bayar (payment_status=paid) → reject/cancel = refund ke saldo kredit customer. Tidak ada uang hangus.

---

## 5. Delivery Failure Routes

### 5a. Courier Reject Assignment

```
from waiting_pickup
  → delivery: rejected_by_courier
  → order: tetap ready_for_pickup
  → outlet assign kurir lain
  → MAX 3 attempts. Setelah 3x → owner resolve
```

### 5b. Delivery Failed

```
from delivering
  → delivery: failed
  → order: failed_delivery
  → failed_reason + failure_note
  → stock preserved
  → notify: customer + owner + outlet
```

### 5c. Resolution (by owner/outlet)

| Resolution | Order Status | Stock Effect | Payment Effect | Who can do? |
|------------|-------------|--------------|----------------|-------------|
| retry_delivery | → ready_for_pickup | Preserved | — | Owner, Outlet |
| returned_to_outlet | → preparing | Preserved | — | Owner, Outlet |
| cancelled_and_released | → cancelled_by_outlet | Released | Refund ke credit | Owner, Outlet |

### 5d. Return to Outlet Flow

```
courier: returnToOutlet()
  → delivery: returning_to_outlet
  → notify outlet "Konfirmasi penerimaan barang"
  → AUTO-CONFIRM setelah 24 jam jika outlet tidak konfirmasi

outlet: confirmReturn()
  → delivery: returned_to_outlet
  → owner pilih resolution
```

### 5e. Courier Reject Loop Prevention

```
Max 3 assign attempts per order.
Setelah 3x reject:
  → owner force resolve
  → options: cancel (refund) atau manual assign
```

---

## 6. Edge Cases — Checkout & Payment

| # | Edge Case | Current Status | Action Needed |
|---|-----------|---------------|---------------|
| 1 | Stock race condition | ✅ Handled (StockAdjustedException + retry) | — |
| 2 | Double-tap submit | ✅ Handled (idempotency cache 60s) | — |
| 3 | Guest vs registered phone | ✅ Handled (RegisteredPhoneException) | — |
| 4 | DOKU API error retry window | ⚠️ Partial | Reset confirmation_expires_at saat error |
| 5 | Webhook vs redirect race | ✅ Handled (atomic guard) | — |
| 6 | COD payment | ❌ Dihapus | Hapus semua COD logic |
| 7 | Browser close sebelum redirect | ✅ Handled (webhook tetap process) | — |
| 8 | Retry payment limit | ❌ Tidak ada | Tambah max 3 retry per order |

---

## 7. Edge Cases — Outlet Operations

| # | Edge Case | Current Status | Action Needed |
|---|-----------|---------------|---------------|
| 1 | Outlet timeout | ⚠️ Fixed 15m | `outlets.confirmation_timeout_minutes`, default 15m. ExpireJob + Order creation pakai field ini. |
| 2 | Outlet reject setelah paid | ❌ No refund | Customer Credit system |
| 3 | Outlet cancel setelah preparing | ❌ No cancel reason | Tambah alasan + confirmation dialog |
| 4 | Delivery retry loop | ❌ No limit | Max 3 attempts |
| 5 | Return stuck | ❌ No timeout | Auto-confirm 24h |
| 6 | Outlet closed/tutup | ❌ No check | Check operating hours saat checkout |

---

## 8. Edge Cases — Delivery & Post-Completion

| # | Edge Case | Current Status | Action Needed |
|---|-----------|---------------|---------------|
| 1 | Courier reject loop | ❌ No limit | Max 3 assign attempts |
| 2 | Return auto-confirm | ❌ No timeout | Auto-confirm 24h |
| 3 | Customer report window | ✅ Handled (7-day window) | — |
| 4 | Deactivated product | ⚠️ Partial | Tampilkan warning badge "Produk Tidak Aktif" di order detail outlet, tapi tetap proses (stok sudah reserved). Hanya warning, bukan block. |
| 5 | Settlement mismatch | ✅ Manual verification | — |
| 6 | Multiple orders same time | ✅ OK | — |
| 7 | Delivery fail → retry → fail lagi | ❌ No limit | Max 2-3 retry |

---

## 9. Customer Credit System (NEW)

### Data Model

```
customer_credits table:
  id, customer_id, order_id (nullable), amount (decimal),
  type (refund|manual_adjustment),
  notes, balance_after, created_at

customers table:
  + credit_balance (decimal, default 0)

orders table:
  + credit_applied (decimal, default 0) ← track berapa kredit yang dipakai
```

### Trigger Credit (Refund)

| Trigger | Amount | Source |
|---------|--------|--------|
| Outlet reject (paid order) | order.total | Automatic |
| Outlet cancel (paid order) | order.total | Automatic |
| Customer cancel (paid order) | order.total | Automatic |
| Delivery fail → cancel (paid order) | order.total | Automatic |
| Owner manual adjustment | custom | Manual |

### Use Credit (Checkout)

```
Checkout page:
  → tampilkan "Pakai Saldo Kredit (Rp X)" (jika credit_balance > 0)
  → checkbox/toggle — SELALU FULL USE, TIDAK PARTIAL

Jika credit_balance >= order.total:
  → credit_applied = order.total
  → payment_method = 'credit'
  → payment_status = 'paid'
  → order.total tetap (tidak dikurangi — settlement butuh angka asli)
  → customer->credit_balance -= order.total
  → order langsung confirmed (paid via credit)

Jika credit_balance < order.total:
  → credit_applied = credit_balance
  → sisa = order.total - credit_applied
  → bayar sisa via DOKU (sisa amount)
  → customer->credit_balance = 0
  → saat DOKU success: payment_status = 'paid'

Jika tidak pakai credit:
  → credit_applied = 0
  → bayar full via DOKU
```

### Credit Transaction Flow

```
REFUND:
  1. order rejected/cancelled (payment_status=paid)
  2. CustomerCredit::create(amount=order.total, type='refund')
  3. customer->credit_balance += order.total
  4. notify customer "Saldo kredit ditambahkan Rp X"

USE (credit >= total):
  1. checkout: customer pilih "Pakai Saldo"
  2. credit_applied = order.total
  3. CustomerCredit::create(amount=-credit_applied, type='used')
  4. customer->credit_balance -= credit_applied
  5. order: payment_method='credit', payment_status='paid'
  6. status = confirmed langsung

USE (credit < total):
  1. checkout: customer pilih "Pakai Saldo"
  2. credit_applied = credit_balance
  3. sisa = order.total - credit_applied
  4. CustomerCredit::create(amount=-credit_applied, type='used')
  5. customer->credit_balance = 0
  6. DOKU createPayment(amount=sisa)
  7. saat DOKU success: payment_status='paid'
```

---

## 10. Notification Matrix

| Step | Notification | Recipients |
|------|-------------|------------|
| Payment success | order.created (first notification to outlet) | Outlet |
| Payment success | order.confirmed | Customer |
| Outlet confirms | order.confirmed | Customer |
| Outlet rejects | order.rejected | Customer, Owner |
| Order expires | order.expired | Customer |
| Customer cancels | order.cancelled | Outlet |
| Courier assigned | delivery.courier_assigned | Customer, Courier, Outlet |
| Courier rejects assignment | delivery.courier_rejected_assignment | Owner, Outlet |
| Courier picks up | delivery.picked_up | Customer |
| Courier delivering | delivery.out_for_delivery | Customer |
| Delivery completed | delivery.completed | Customer, Outlet |
| Delivery failed | delivery.failed | Customer, Owner, Outlet |
| Return to outlet | delivery.returned_to_outlet | Outlet, Owner |
| Return pending confirmation | system.returned_delivery_pending | Outlet |
| Credit added | credit.refund_added | Customer |

---

## 11. Gap Summary & Prioritas

| # | Gap | Impact | Priority |
|---|-----|--------|----------|
| 1 | **Customer Credit System** | Uang hilang saat reject/cancel | P0 — Kritis |
| 2 | **DOKU API error retry window** | Order expire tanpa chance retry | P1 |
| 3 | **Outlet timeout configurable** | Beberapa outlet butuh waktu lebih | P1 |
| 4 | **Hapus COD** | Simplifikasi flow | P1 |
| 5 | **Delivery retry limit** | Infinite loop possible | P1 |
| 6 | **Courier assign attempt limit** | Infinite reject loop | P1 |
| 7 | **Max retry payment limit** | Customer bisa retry infinite | P1 |
| 8 | **Return auto-confirm timeout** | Barang stuck returning | P2 |
| 9 | **Cancel reason di confirmed/preparing** | Tidak ada alasan | P2 |
| 10 | **Outlet closed check** | Order masuk ke outlet tutup | P2 |

---

## 12. Implementation Order

```
Phase 1 (P0 — Kritis):
  1. Customer Credit System (model, migration, service, checkout integration)

Phase 2 (P1 — Important):
  2. DOKU API error retry window fix
  3. Outlet timeout configurable (migration + DashboardController)
  4. Hapus COD (remove all COD references)
  5. Delivery retry limit (max 3)
  6. Courier assign attempt limit (max 3)
  7. Max retry payment limit (max 3)

Phase 3 (P2 — Nice to have):
  8. Return auto-confirm (24h timeout)
  9. Cancel reason dialog
  10. Outlet closed check
```
