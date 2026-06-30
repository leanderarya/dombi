# Midtrans Payment Gateway — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Midtrans payment gateway for QRIS, VA, and E-wallet payments in sandbox mode.

**Architecture:** Midtrans Snap.js for frontend payment popup, Laravel service for token creation and webhook handling, payment_transactions table for audit log.

**Tech Stack:** midtrans/midtrans PHP SDK, Snap.js, Laravel 11, React + Inertia.js

## Global Constraints

- Sandbox mode only (MIDTRANS_IS_PRODUCTION=false)
- Phase 1: QRIS + VA + E-wallet (no card)
- Guest can pay (no auth required for payment)
- All transactions logged in payment_transactions table
- Webhook signature verification required

---

### Task 1: Install Midtrans SDK & Config

**Files:**
- Modify: `composer.json`
- Create: `config/midtrans.php`
- Modify: `.env.example`

**Interfaces:**
- Produces: `config('midtrans.server_key')`, `config('midtrans.client_key')`

- [ ] **Step 1: Install Midtrans PHP SDK**

```bash
composer require midtrans/midtrans
```

- [ ] **Step 2: Create config/midtrans.php**

```php
<?php

return [
    'server_key' => env('MIDTRANS_SERVER_KEY'),
    'client_key' => env('MIDTRANS_CLIENT_KEY'),
    'is_production' => env('MIDTRANS_IS_PRODUCTION', false),
    'is_sanitized' => env('MIDTRANS_IS_SANITIZED', true),
    'is_3ds' => env('MIDTRANS_IS_3DS', true),
];
```

- [ ] **Step 3: Add to .env.example**

```
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=false
```

- [ ] **Step 4: Verify**

```bash
php artisan tinker --execute="echo config('midtrans.is_production') ? 'true' : 'false';"
```

Expected: `false`

- [ ] **Step 5: Commit**

```bash
git add composer.json composer.lock config/midtrans.php .env.example
git commit -m "feat: install Midtrans SDK and config"
```

---

### Task 2: Database Migrations

**Files:**
- Create: `database/migrations/xxx_create_payment_transactions_table.php`
- Create: `database/migrations/xxx_add_payment_fields_to_orders_table.php`

**Interfaces:**
- Produces: `payment_transactions` table, `orders.payment_status`, `orders.midtrans_order_id`, `orders.paid_at`

- [ ] **Step 1: Create payment_transactions migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->string('midtrans_order_id')->unique();
            $table->string('payment_method'); // qris, va_bca, va_bni, gopay, ovo, etc
            $table->decimal('amount', 12, 2);
            $table->enum('status', ['pending', 'paid', 'settled', 'expired', 'failed'])->default('pending');
            $table->json('raw_response')->nullable();
            $table->timestamps();

            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_transactions');
    }
};
```

- [ ] **Step 2: Add payment fields to orders migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->enum('payment_status', ['pending', 'paid', 'settled', 'expired', 'failed'])->nullable()->after('payment_method');
            $table->string('midtrans_order_id')->nullable()->unique()->after('payment_status');
            $table->timestamp('paid_at')->nullable()->after('midtrans_order_id');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['payment_status', 'midtrans_order_id', 'paid_at']);
        });
    }
};
```

- [ ] **Step 3: Run migrations**

```bash
php artisan migrate
```

- [ ] **Step 4: Commit**

```bash
git add database/migrations/
git commit -m "feat: payment_transactions table and order payment fields"
```

---

### Task 3: PaymentTransaction Model

**Files:**
- Create: `app/Models/PaymentTransaction.php`

**Interfaces:**
- Produces: `PaymentTransaction` model with fillable, casts, relationships

- [ ] **Step 1: Create model**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'raw_response' => 'array',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
```

- [ ] **Step 2: Add relationship to Order model**

Add to `app/Models/Order.php`:

```php
public function paymentTransactions(): HasMany
{
    return $this->hasMany(PaymentTransaction::class);
}
```

- [ ] **Step 3: Commit**

```bash
git add app/Models/PaymentTransaction.php app/Models/Order.php
git commit -m "feat: PaymentTransaction model and Order relationship"
```

---

### Task 4: MidtransService

**Files:**
- Create: `app/Services/MidtransService.php`

**Interfaces:**
- Produces: `MidtransService::createSnapToken(Order): string`
- Produces: `MidtransService::handleWebhook(array): void`

- [ ] **Step 1: Create service**

```php
<?php

namespace App\Services;

use App\Models\Order;
use App\Models\PaymentTransaction;
use App\Notifications\OrderConfirmedNotification;
use Illuminate\Support\Facades\Log;
use Midtrans\Config;
use Midtrans\Snap;

class MidtransService
{
    public function __construct()
    {
        Config::$serverKey = config('midtrans.server_key');
        Config::$isProduction = config('midtrans.is_production', false);
        Config::$isSanitized = config('midtrans.is_sanitized', true);
        Config::$is3ds = config('midtrans.is_3ds', true);
    }

    public function createSnapToken(Order $order): string
    {
        $midtransOrderId = 'DMB-' . $order->id . '-' . time();

        $params = [
            'transaction_details' => [
                'order_id' => $midtransOrderId,
                'gross_amount' => (int) $order->total,
            ],
            'customer_details' => [
                'first_name' => $order->customer_name,
                'phone' => $order->customer_phone,
            ],
            'item_details' => $order->items->map(fn ($item) => [
                'id' => $item->product_variant_id,
                'price' => (int) $item->price,
                'quantity' => $item->quantity,
                'name' => $item->product_name,
            ])->toArray(),
        ];

        $snapToken = Snap::getSnapToken($params);

        // Log transaction
        PaymentTransaction::create([
            'order_id' => $order->id,
            'midtrans_order_id' => $midtransOrderId,
            'payment_method' => $order->payment_method,
            'amount' => $order->total,
            'status' => 'pending',
        ]);

        // Update order
        $order->update([
            'midtrans_order_id' => $midtransOrderId,
            'payment_status' => 'pending',
        ]);

        return $snapToken;
    }

    public function handleWebhook(array $payload): void
    {
        $midtransOrderId = $payload['order_id'] ?? null;
        $transactionStatus = $payload['transaction_status'] ?? null;
        $fraudStatus = $payload['fraud_status'] ?? null;

        if (!$midtransOrderId) {
            Log::warning('Midtrans webhook: missing order_id');
            return;
        }

        $transaction = PaymentTransaction::where('midtrans_order_id', $midtransOrderId)->first();
        if (!$transaction) {
            Log::warning("Midtrans webhook: transaction not found for {$midtransOrderId}");
            return;
        }

        $status = $this->mapStatus($transactionStatus, $fraudStatus);

        $transaction->update([
            'status' => $status,
            'raw_response' => $payload,
        ]);

        $order = $transaction->order;
        if (!$order) return;

        $order->update(['payment_status' => $status]);

        if ($status === 'paid' && !$order->paid_at) {
            $order->update([
                'paid_at' => now(),
                'status' => Order::STATUS_CONFIRMED,
            ]);

            // Clear cache
            \Cache::forget("outlet:{$order->outlet_id}:pending_orders");
            \Cache::forget('owner:pending_counts');
            \Cache::forget('owner:order_stats');
        }

        if ($status === 'expired') {
            $order->update(['status' => Order::STATUS_EXPIRED]);
        }
    }

    private function mapStatus(?string $transactionStatus, ?string $fraudStatus): string
    {
        return match ($transactionStatus) {
            'capture' => $fraudStatus === 'accept' ? 'paid' : 'failed',
            'settlement' => 'settled',
            'pending' => 'pending',
            'expire' => 'expired',
            'cancel' => 'failed',
            'deny' => 'failed',
            default => 'pending',
        };
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/Services/MidtransService.php
git commit -m "feat: MidtransService — Snap token creation and webhook handling"
```

---

### Task 5: Webhook Controller & Route

**Files:**
- Create: `app/Http/Controllers/MidtransWebhookController.php`
- Modify: `routes/web.php`

**Interfaces:**
- Produces: `POST /api/midtrans/webhook` endpoint

- [ ] **Step 1: Create webhook controller**

```php
<?php

namespace App\Http\Controllers;

use App\Services\MidtransService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class MidtransWebhookController extends Controller
{
    public function handle(Request $request, MidtransService $midtrans): JsonResponse
    {
        try {
            $payload = $request->all();

            // Verify signature
            $serverKey = config('midtrans.server_key');
            $orderId = $payload['order_id'] ?? '';
            $statusCode = $payload['status_code'] ?? '';
            $grossAmount = $payload['gross_amount'] ?? '';
            $signatureKey = $payload['signature_key'] ?? '';

            $expectedSignature = hash('sha512', $orderId . $statusCode . $grossAmount . $serverKey);

            if ($signatureKey !== $expectedSignature) {
                Log::warning('Midtrans webhook: invalid signature', ['order_id' => $orderId]);
                return response()->json(['message' => 'Invalid signature'], 403);
            }

            $midtrans->handleWebhook($payload);

            return response()->json(['message' => 'OK']);
        } catch (\Exception $e) {
            Log::error('Midtrans webhook error: ' . $e->getMessage());
            return response()->json(['message' => 'Error'], 500);
        }
    }
}
```

- [ ] **Step 2: Add route**

Add to `routes/web.php` (outside middleware groups):

```php
Route::post('/api/midtrans/webhook', [\App\Http\Controllers\MidtransWebhookController::class, 'handle']);
```

- [ ] **Step 3: Verify route exists**

```bash
php artisan route:list --path=api/midtrans
```

Expected: `POST api/midtrans/webhook`

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/MidtransWebhookController.php routes/web.php
git commit -m "feat: Midtrans webhook controller with signature verification"
```

---

### Task 6: Update Checkout Controller

**Files:**
- Modify: `app/Http/Controllers/Customer/CheckoutController.php`

**Interfaces:**
- Modifies: `submit()` method to create Snap token for non-COD payments

- [ ] **Step 1: Update submit method**

Find the `submit()` method and add Snap token creation after order creation:

```php
use App\Services\MidtransService;

// In submit() method, after order is created:
if ($validated['payment_method'] !== 'cod') {
    $snapToken = app(MidtransService::class)->createSnapToken($order);

    return redirect()->route('customer.checkout.payment', [
        'order' => $order->id,
        'token' => $order->recovery_token,
    ])->with('snap_token', $snapToken);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/Http/Controllers/Customer/CheckoutController.php
git commit -m "feat: create Snap token for non-COD payments"
```

---

### Task 7: Frontend — Snap.js Integration

**Files:**
- Create: `resources/views/midtrans-snap.blade.php`
- Modify: `resources/views/app.blade.php`
- Modify: `resources/js/pages/customer/checkout/payment.tsx`

**Interfaces:**
- Produces: `window.snap.pay(token, callbacks)` function

- [ ] **Step 1: Create midtrans-snap.blade.php**

```html
@unless(config('midtrans.is_production'))
    <script src="https://app.sandbox.midtrans.com/snap/snap.js"
            data-client-key="{{ config('midtrans.client_key') }}"></script>
@else
    <script src="https://app.midtrans.com/snap/snap.js"
            data-client-key="{{ config('midtrans.client_key') }}"></script>
@endunless
```

- [ ] **Step 2: Include in app.blade.php**

Add before `</head>`:

```html
@include('midtrans-snap')
```

- [ ] **Step 3: Update payment.tsx**

Add Snap.js types and pay function:

```typescript
declare global {
    interface Window {
        snap: {
            pay: (token: string, callbacks: {
                onSuccess?: (result: any) => void;
                onPending?: (result: any) => void;
                onError?: (result: any) => void;
                onClose?: () => void;
            }) => void;
        };
    }
}

// In submit function, after form.post succeeds:
if (snapToken && window.snap) {
    window.snap.pay(snapToken, {
        onSuccess: (result) => {
            router.visit(`/customer/orders/${result.order_id}`);
        },
        onPending: (result) => {
            router.visit(`/customer/orders/${result.order_id}`);
        },
        onError: (result) => {
            setSubmitError('Pembayaran gagal. Silakan coba lagi.');
        },
    });
}
```

- [ ] **Step 4: Commit**

```bash
git add resources/views/midtrans-snap.blade.php resources/views/app.blade.php resources/js/pages/customer/checkout/payment.tsx
git commit -m "feat: Midtrans Snap.js integration in checkout"
```

---

### Task 8: Update Payment Options

**Files:**
- Modify: `app/Http/Controllers/Customer/CheckoutController.php`

**Interfaces:**
- Updates: payment_options array with Midtrans methods

- [ ] **Step 1: Update payment options**

Replace hardcoded options with Midtrans methods:

```php
$paymentOptions = [
    ['value' => 'qris', 'label' => 'QRIS', 'fee_rate' => 0.007, 'icon' => 'qris'],
    ['value' => 'va_bca', 'label' => 'BCA Virtual Account', 'fee_rate' => 0, 'icon' => 'bank'],
    ['value' => 'va_bni', 'label' => 'BNI Virtual Account', 'fee_rate' => 0, 'icon' => 'bank'],
    ['value' => 'va_mandiri', 'label' => 'Mandiri Virtual Account', 'fee_rate' => 0, 'icon' => 'bank'],
    ['value' => 'va_bri', 'label' => 'BRI Virtual Account', 'fee_rate' => 0, 'icon' => 'bank'],
    ['value' => 'gopay', 'label' => 'GoPay', 'fee_rate' => 0, 'icon' => 'ewallet'],
    ['value' => 'ovo', 'label' => 'OVO', 'fee_rate' => 0, 'icon' => 'ewallet'],
    ['value' => 'dana', 'label' => 'DANA', 'fee_rate' => 0, 'icon' => 'ewallet'],
    ['value' => 'shopeepay', 'label' => 'ShopeePay', 'fee_rate' => 0, 'icon' => 'ewallet'],
];
```

- [ ] **Step 2: Commit**

```bash
git add app/Http/Controllers/Customer/CheckoutController.php
git commit -m "feat: Midtrans payment options (QRIS, VA, E-wallet)"
```

---

## Verification

1. `php artisan migrate` — tables created
2. `php artisan route:list --path=api/midtrans` — webhook route exists
3. Open checkout → select QRIS → Snap popup appears
4. Complete test payment → order status updates
5. Check `payment_transactions` table → transaction logged
