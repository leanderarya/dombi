# Midtrans Payment Gateway Integration

## Problem

Customer checkout payment methods (COD, QRIS, Transfer, Card) are mock — no real payment processing. Need to integrate Midtrans payment gateway for real payments.

## Scope

- **Phase:** Sandbox only (development/testing)
- **Gateway:** Midtrans (official PHP SDK)
- **Methods:** QRIS + VA (BCA, BNI, Mandiri, BRI) + E-wallet (GoPay, OVO, Dana, ShopeePay)
- **Card:** Not in phase 1

## Architecture

### Payment Flow

```
Customer checkout → Select payment method → Create Snap token
       │
       ▼
Midtrans Snap popup (embedded)
       │
       ├── QRIS → Show QR → Customer scan → Auto-confirm
       ├── VA → Show VA number → Customer transfer → Webhook confirm
       └── E-wallet → Redirect to app → Customer pay → Webhook confirm
       │
       ▼
Webhook → Update order status → Notify customer
```

### Payment Statuses

```
pending → paid → settled
    │
    ├── expired (timeout)
    └── failed (gagal bayar)
```

### Order Integration

- Order tetap `pending_confirmation` sampai payment confirmed
- Setelah payment confirmed → order status naik ke `confirmed`
- Guest bisa bayar QRIS/VA/e-wallet (tidak perlu login)

### Status Mapping

| Midtrans Status | Payment Status | Order Action |
|-----------------|----------------|--------------|
| `capture` | `paid` | Auto-confirm |
| `settlement` | `settled` | No change |
| `pending` | `pending` | Wait |
| `expire` | `expired` | Cancel order |
| `deny` | `failed` | Notify customer |

## Backend

### Config: `config/midtrans.php`

```php
return [
    'server_key' => env('MIDTRANS_SERVER_KEY'),
    'client_key' => env('MIDTRANS_CLIENT_KEY'),
    'is_production' => env('MIDTRANS_IS_PRODUCTION', false),
    'is_sanitized' => env('MIDTRANS_IS_SANITIZED', true),
    'is_3ds' => env('MIDTRANS_IS_3DS', true),
];
```

### Service: `app/Services/MidtransService.php`

```php
class MidtransService
{
    // Create Snap token for order
    public function createSnapToken(Order $order): string

    // Handle webhook callback
    public function handleWebhook(array $payload): void

    // Map Midtrans status to internal status
    private function mapStatus(string $status): string
}
```

### Webhook: `app/Http/Controllers/MidtransWebhookController.php`

```php
class MidtransWebhookController extends Controller
{
    public function handle(Request $request): JsonResponse
    {
        // 1. Verify signature (SHA512)
        // 2. Find order by midtrans_order_id
        // 3. Update payment_transactions
        // 4. Update order payment_status
        // 5. If paid → auto-confirm order
        // 6. Notify customer
    }
}
```

### Model: `app/Models/PaymentTransaction.php`

```php
class PaymentTransaction extends Model
{
    protected $fillable = [
        'order_id',
        'midtrans_order_id',
        'payment_method',
        'amount',
        'status',
        'raw_response',
    ];
}
```

### Database

**payment_transactions table:**
```
- id
- order_id (FK)
- midtrans_order_id (string, unique)
- payment_method (string: qris, va_bca, va_bni, gopay, ovo, etc)
- amount (decimal)
- status (enum: pending, paid, settled, expired, failed)
- raw_response (json)
- created_at, updated_at
```

**orders table additions:**
```
- payment_status (enum: pending, paid, settled, expired, failed, null)
- midtrans_order_id (string, nullable, unique)
- paid_at (timestamp, nullable)
```

### Routes

```php
Route::post('/api/midtrans/webhook', [MidtransWebhookController::class, 'handle']);
```

## Frontend

### Payment Method Selector

**Tab structure:**
```
[QRIS] [Virtual Account] [E-wallet]
```

**Per tab:**
- QRIS: Single option, no sub-selection
- VA: Select bank (BCA, BNI, Mandiri, BRI)
- E-wallet: Select provider (GoPay, OVO, Dana, ShopeePay)

### Midtrans Snap Integration

**Script loading:**
```html
<!-- sandbox -->
<script src="https://app.sandbox.midtrans.com/snap/snap.js" data-client-key="..."></script>
```

**Snap popup:**
```typescript
window.snap.pay(snapToken, {
    onSuccess: (result) => {
        // Redirect to confirmation
    },
    onPending: (result) => {
        // Show pending message
    },
    onError: (result) => {
        // Show error
    },
    onClose: () => {
        // User closed without paying
    },
});
```

### Guest Support

- Guest bisa bayar QRIS/VA/e-wallet (tidak perlu login)
- Setelah bayar → redirect ke track page dengan recovery token
- Guest tetap tidak bisa COD (sudah diimplementasi)

## Files to Create/Modify

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `config/midtrans.php` | Create | Midtrans config |
| 2 | `.env.example` | Modify | Add MIDTRANS_* vars |
| 3 | `composer.json` | Modify | Add midtrans/midtrans SDK |
| 4 | `database/migrations/xxx_create_payment_transactions_table.php` | Create | Transaction log table |
| 5 | `database/migrations/xxx_add_payment_fields_to_orders_table.php` | Create | payment_status, midtrans_order_id, paid_at |
| 6 | `app/Models/PaymentTransaction.php` | Create | Transaction model |
| 7 | `app/Models/Order.php` | Modify | Add payment_status, midtrans_order_id, paid_at to fillable |
| 8 | `app/Services/MidtransService.php` | Create | Snap token, webhook handling |
| 9 | `app/Http/Controllers/MidtransWebhookController.php` | Create | Webhook endpoint |
| 10 | `routes/web.php` | Modify | Add webhook route |
| 11 | `resources/views/midtrans-snap.blade.php` | Create | Snap.js script tag |
| 12 | `resources/js/pages/customer/checkout/payment.tsx` | Modify | Midtrans Snap integration |
| 13 | `app/Http/Controllers/Customer/CheckoutController.php` | Modify | Create Snap token |

## Environment Variables

```
MIDTRANS_SERVER_KEY=SB-Mid-server-xxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxx
MIDTRANS_IS_PRODUCTION=false
```

## Security

- Webhook signature verification (SHA512)
- Server key never exposed to frontend
- Client key only for Snap.js
- All transactions logged in payment_transactions table

## Success Criteria

1. Customer bisa pilih QRIS/VA/e-wallet di checkout
2. Midtrans Snap popup muncul dengan opsi yang dipilih
3. Setelah bayar, order status auto-update ke paid
4. Webhook terima dan proses callback dari Midtrans
5. Guest bisa bayar tanpa login
6. Semua transaksi ter-log di database
