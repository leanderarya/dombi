# Midtrans → DOKU Payment Gateway Migration

**Date:** 2026-07-04
**Status:** Approved

## Problem

The app currently uses Midtrans for payment processing (QRIS, GoPay, ShopeePay, DANA). We need to migrate entirely to DOKU payment gateway with QRIS-only support.

## Goals

1. Replace Midtrans with DOKU for all payment processing
2. Support QRIS as the only payment method
3. Use DOKU Hosted Payment Page (redirect, not embedded)
4. Rename `midtrans_order_id` columns to `doku_order_id`
5. Remove all Midtrans code, config, and dependencies

## Approach

Full replacement. One `DokuService` replaces `MidtransService`. Customer is redirected to DOKU hosted page for payment.

### Data flow

```
Customer clicks "Bayar"
  → CheckoutController calls DokuService::createPayment(order)
  → DokuService calls DOKU API (POST /payment-url)
  → Returns payment URL
  → Customer redirected to DOKU hosted page
  → Customer scans QRIS
  → DOKU sends webhook to /payment/doku/notify
  → DokuService verifies signature + updates order
  → Customer redirected back to order confirmation page
```

## Backend Service

### DokuService (`app/Services/DokuService.php`)

Replaces `MidtransService` entirely.

| Method | Signature | Description |
|---|---|---|
| `createPayment` | `(Order $order): string` | Calls DOKU API, creates `PaymentTransaction`, returns payment URL |
| `handleWebhook` | `(array $payload): void` | Verifies signature, updates order status (idempotent) |
| `verifySignature` | `(array $payload): bool` | SHA256 signature verification per DOKU spec |
| `checkStatus` | `(Order $order): ?array` | Polls DOKU for transaction status (webhook fallback) |
| `mapStatus` | `(string $dokuStatus): string` | Maps DOKU status → Dombi payment_status |

### Payment status mapping

| DOKU Status | Dombi `payment_status` |
|---|---|
| SUCCESS | `paid` |
| PENDING | `pending` |
| FAILED | `failed` |
| EXPIRED | `expired` |

### Webhook signature verification

DOKU uses SHA256: `SHA256(clientId + requestId + requestBody + apiKey)`

### DokuPaymentController (`app/Http/Controllers/DokuPaymentController.php`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/payment/doku/notify` | POST | Webhook from DOKU |
| `/payment/doku/redirect` | GET | Callback after customer completes payment |

## Config

### `config/doku.php`

```php
return [
    'client_id' => env('DOKU_CLIENT_ID'),
    'api_key' => env('DOKU_API_KEY'),
    'merchant_code' => env('DOKU_MERCHANT_CODE'),
    'sandbox' => env('DOKU_IS_SANDBOX', true),
    'base_url' => env('DOKU_IS_SANDBOX', true)
        ? 'https://sandbox.doku.com'
        : 'https://api.doku.com',
];
```

### Environment variables

```env
# Remove
MIDTRANS_CLIENT_KEY=
MIDTRANS_SERVER_KEY=
MIDTRANS_IS_PRODUCTION=

# Add
DOKU_CLIENT_ID=
DOKU_API_KEY=
DOKU_IS_SANDBOX=true
DOKU_MERCHANT_CODE=
```

## Database Migration

Rename `midtrans_order_id` → `doku_order_id` in two tables.

```php
Schema::table('orders', function (Blueprint $table) {
    $table->renameColumn('midtrans_order_id', 'doku_order_id');
});

Schema::table('payment_transactions', function (Blueprint $table) {
    $table->renameColumn('midtrans_order_id', 'doku_order_id');
});
```

Model updates:
- `Order`: `midtrans_order_id` → `doku_order_id` in `$fillable`
- `PaymentTransaction`: `midtrans_order_id` → `doku_order_id` in `$fillable`

## Frontend Changes

### CheckoutController::submit()

Instead of returning Snap token via Inertia props, return `redirect()` to DOKU payment URL.

No Snap JS script needed — DOKU hosted page handles all payment UI.

### OrderController

- `syncStatusFromMidtrans()` → `syncStatusFromDoku()`
- All `midtrans_order_id` references → `doku_order_id`

### CheckoutController

- `createSnapToken()` → `createPayment()` via DokuService
- QRIS fee: keep 0.7% rate
- Return redirect to DOKU URL

## Routes

### Remove
```php
Route::post('/api/midtrans/webhook', [MidtransWebhookController::class, 'handle']);
```

### Add
```php
Route::post('/payment/doku/notify', [DokuPaymentController::class, 'notify']);
Route::get('/payment/doku/redirect', [DokuPaymentController::class, 'redirect']);
```

## Files

### Delete
| File | Reason |
|---|---|
| `app/Services/MidtransService.php` | Replaced by DokuService |
| `app/Http/Controllers/MidtransWebhookController.php` | Replaced by DokuPaymentController |
| `app/Console/Commands/MidtransSimulateWebhook.php` | Midtrans-specific |
| `config/midtrans.php` | Replaced by config/doku.php |

### Create
| File | Purpose |
|---|---|
| `app/Services/DokuService.php` | Payment service (create, webhook, status) |
| `app/Http/Controllers/DokuPaymentController.php` | Webhook + redirect endpoints |
| `config/doku.php` | DOKU configuration |
| `database/migrations/xxxx_rename_midtrans_to_doku.php` | Column rename migration |

### Modify
| File | Change |
|---|---|
| `routes/web.php` | Remove Midtrans route, add DOKU routes |
| `app/Models/Order.php` | `midtrans_order_id` → `doku_order_id` |
| `app/Models/PaymentTransaction.php` | `midtrans_order_id` → `doku_order_id` |
| `app/Http/Controllers/Customer/CheckoutController.php` | Use DokuService |
| `app/Http/Controllers/Customer/OrderController.php` | Use DokuService |
| `.env.example` | Swap env vars |

### Composer
- Remove `midtrans/midtrans-php` package

## Testing

### Unit tests (`tests/Feature/DokuPaymentTest.php`)

1. `test_create_payment` — mock DOKU API, verify payment URL generated, verify order updated
2. `test_webhook_success` — send signed payload, verify order status → `paid`
3. `test_webhook_invalid_signature` — unsigned payload → 401, order NOT updated
4. `test_webhook_idempotent` — send same notification twice, order unchanged on second call
5. `test_status_mapping` — verify all DOKU statuses map correctly

### Manual sandbox test

Full flow: checkout → DOKU page → scan QRIS → webhook → order completed

## Out of Scope

- Multiple payment methods (GoPay, DANA, VA, credit card)
- DOKU embedded widget integration
- Refund API integration
- Midtrans historical data migration (old orders keep their `doku_order_id` value)
