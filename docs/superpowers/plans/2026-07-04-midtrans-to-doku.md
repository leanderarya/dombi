# Midtrans → DOKU Payment Gateway Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Midtrans payment integration with DOKU (QRIS-only, hosted payment page).

**Architecture:** Full replacement. `DokuService` replaces `MidtransService`. Customer is redirected to DOKU hosted page for QRIS payment. Webhook handles status updates. Database columns renamed from `midtrans_order_id` to `doku_order_id`.

**Tech Stack:** Laravel 12, React 19, TypeScript, Inertia.js, DOKU API (sandbox)

## Global Constraints

- DOKU uses SHA256 signature: `SHA256(clientId + requestId + requestBody + apiKey)`
- DOKU sandbox base URL: `https://api-sandbox.doku.com`
- QRIS-only payment method (remove GoPay, ShopeePay, DANA)
- QRIS fee rate: 0.7% (keep existing rate)
- `midtrans_order_id` → `doku_order_id` via column rename (not add + drop)
- Idempotent webhook handling (skip if already `paid` or `refunded`)
- Hosted Payment Page (redirect, not embedded widget)
- DOKU payment URL expires after 30 minutes (same as Midtrans Snap)

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `config/doku.php` | DOKU configuration (client_id, api_key, sandbox flag) |
| `app/Services/DokuService.php` | Payment service (create, webhook, status, signature) |
| `app/Http/Controllers/DokuPaymentController.php` | Webhook + redirect endpoints |
| `database/migrations/xxxx_rename_midtrans_to_doku.php` | Column rename migration |
| `tests/Feature/DokuPaymentTest.php` | Unit tests |

### Modified files
| File | Change |
|------|--------|
| `routes/web.php` | Remove Midtrans route, add DOKU routes |
| `app/Models/Order.php` | `midtrans_order_id` → `doku_order_id` in `$fillable` |
| `app/Models/PaymentTransaction.php` | `midtrans_order_id` → `doku_order_id` in `$fillable` |
| `app/Http/Controllers/Customer/CheckoutController.php` | Use DokuService, return redirect |
| `app/Http/Controllers/Customer/OrderController.php` | Use DokuService, remove snap_token refs |
| `resources/js/pages/customer/orders/confirm.tsx` | Remove Snap.js, add redirect link |
| `.env.example` | Swap env vars |

### Deleted files
| File | Reason |
|------|--------|
| `app/Services/MidtransService.php` | Replaced by DokuService |
| `app/Http/Controllers/MidtransWebhookController.php` | Replaced by DokuPaymentController |
| `app/Console/Commands/MidtransSimulateWebhook.php` | Midtrans-specific |
| `config/midtrans.php` | Replaced by config/doku.php |

---

### Task 1: Config + Environment

**Files:**
- Create: `config/doku.php`
- Modify: `.env.example`

**Interfaces:**
- Produces: `config('doku.client_id')`, `config('doku.api_key')`, `config('doku.sandbox')`, `config('doku.base_url')`
- Used by: Task 3 (DokuService)

- [ ] **Step 1: Create config/doku.php**

```php
<?php

return [
    'client_id' => env('DOKU_CLIENT_ID'),
    'api_key' => env('DOKU_API_KEY'),
    'merchant_code' => env('DOKU_MERCHANT_CODE'),
    'sandbox' => env('DOKU_IS_SANDBOX', true),
    'base_url' => env('DOKU_IS_SANDBOX', true)
        ? 'https://api-sandbox.doku.com'
        : 'https://api.doku.com',
];
```

- [ ] **Step 2: Update .env.example**

Add at the end of `.env.example`:

```env
DOKU_CLIENT_ID=
DOKU_API_KEY=
DOKU_IS_SANDBOX=true
DOKU_MERCHANT_CODE=
```

- [ ] **Step 3: Commit**

```bash
git add config/doku.php .env.example
git commit -m "feat: add DOKU config and environment variables"
```

---

### Task 2: Database Migration — Rename Columns

**Files:**
- Create: `database/migrations/2026_07_04_000001_rename_midtrans_to_doku.php`
- Modify: `app/Models/Order.php:96`
- Modify: `app/Models/PaymentTransaction.php:12`

**Interfaces:**
- Produces: `orders.doku_order_id` and `payment_transactions.doku_order_id` columns
- Used by: All subsequent tasks

- [ ] **Step 1: Create migration**

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
            $table->renameColumn('midtrans_order_id', 'doku_order_id');
        });

        Schema::table('payment_transactions', function (Blueprint $table) {
            $table->renameColumn('midtrans_order_id', 'doku_order_id');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->renameColumn('doku_order_id', 'midtrans_order_id');
        });

        Schema::table('payment_transactions', function (Blueprint $table) {
            $table->renameColumn('doku_order_id', 'midtrans_order_id');
        });
    }
};
```

- [ ] **Step 2: Run migration**

Run: `php artisan migrate`
Expected: Migration ran successfully

- [ ] **Step 3: Update Order model**

In `app/Models/Order.php`, change line 96:
```php
// Before
'payment_status', 'midtrans_order_id', 'paid_at',

// After
'payment_status', 'doku_order_id', 'paid_at',
```

- [ ] **Step 4: Update PaymentTransaction model**

In `app/Models/PaymentTransaction.php`, change line 12:
```php
// Before
'midtrans_order_id',

// After
'doku_order_id',
```

- [ ] **Step 5: Commit**

```bash
git add database/migrations/ app/Models/Order.php app/Models/PaymentTransaction.php
git commit -m "feat: rename midtrans_order_id to doku_order_id"
```

---

### Task 3: DokuService — Core Payment Service

**Files:**
- Create: `app/Services/DokuService.php`

**Interfaces:**
- Consumes: `config('doku.*')`, `Order` model, `PaymentTransaction` model
- Produces:
  - `createPayment(Order $order): string` — returns DOKU payment URL
  - `handleWebhook(array $payload): void` — processes webhook
  - `verifySignature(array $payload): bool` — verifies SHA256 signature
  - `checkStatus(Order $order): ?array` — polls DOKU status
  - `mapStatus(string $dokuStatus): string` — maps to Dombi status
- Used by: Task 4 (DokuPaymentController), Task 6 (CheckoutController), Task 7 (OrderController)

- [ ] **Step 1: Create DokuService.php**

```php
<?php

namespace App\Services;

use App\Models\Order;
use App\Models\PaymentTransaction;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class DokuService
{
    private string $baseUrl;
    private string $clientId;
    private string $apiKey;

    public function __construct()
    {
        $this->baseUrl = config('doku.base_url');
        $this->clientId = config('doku.client_id');
        $this->apiKey = config('doku.api_key');
    }

    /**
     * Create a DOKU payment for an order.
     * Returns the DOKU hosted payment page URL.
     */
    public function createPayment(Order $order): string
    {
        $requestId = 'DMB-'.$order->id.'-'.time();
        $invoiceNumber = $order->order_code;
        $amount = (int) $order->total;

        $body = [
            'order' => [
                'invoice_number' => $invoiceNumber,
                'amount' => $amount,
            ],
            'payment' => [
                'payment_due_date' => now()->addMinutes(30)->format('Y-m-d H:i:s'),
                'payment_method' => 'QRIS',
            ],
            'customer' => [
                'name' => $order->customer_name,
                'email' => $order->customer_email ?? '',
                'phone' => $order->customer_phone ?? '',
            ],
        ];

        $response = Http::withHeaders($this->generateHeaders($requestId, json_encode($body)))
            ->timeout(30)
            ->post($this->baseUrl.'/v1/payment-url', $body);

        if (! $response->successful()) {
            Log::error('DOKU createPayment failed', [
                'order_id' => $order->id,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            throw new \Exception('DOKU payment creation failed: '.$response->body());
        }

        $data = $response->json();
        $paymentUrl = $data['payment']['url'] ?? null;
        $dokuOrderId = $data['order']['invoice_number'] ?? $invoiceNumber;

        if (! $paymentUrl) {
            throw new \Exception('DOKU response missing payment URL');
        }

        // Log transaction
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => $dokuOrderId,
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'pending',
            'raw_response' => $data,
        ]);

        // Update order
        $order->update([
            'doku_order_id' => $dokuOrderId,
            'payment_status' => 'pending',
        ]);

        return $paymentUrl;
    }

    /**
     * Handle DOKU webhook notification.
     */
    public function handleWebhook(array $payload): void
    {
        $invoiceNumber = $payload['order']['invoice_number'] ?? null;
        $paymentStatus = $payload['transaction']['status'] ?? null;

        if (! $invoiceNumber) {
            Log::warning('DOKU webhook: missing invoice_number');
            return;
        }

        $transaction = PaymentTransaction::where('doku_order_id', $invoiceNumber)->first();
        if (! $transaction) {
            Log::warning('DOKU webhook: transaction not found', ['invoice_number' => $invoiceNumber]);
            return;
        }

        $order = $transaction->order;
        if (! $order) {
            return;
        }

        // Idempotency: skip if already in terminal state
        if (in_array($order->payment_status, ['paid', 'refunded'], true)) {
            Log::info('DOKU webhook: order already in terminal state, skipping', [
                'order_id' => $order->id,
            ]);
            return;
        }

        $status = $this->mapStatus($paymentStatus);

        $transaction->update([
            'status' => $status,
            'raw_response' => $payload,
        ]);

        if ($status === 'paid') {
            $this->markOrderPaid($order);
        } elseif (in_array($status, ['failed', 'expired']) && $order->payment_status === 'pending') {
            $order->update(['payment_status' => $status]);
        }

        Log::info('DOKU webhook processed', [
            'order_id' => $order->id,
            'invoice_number' => $invoiceNumber,
            'doku_status' => $paymentStatus,
            'mapped_status' => $status,
        ]);
    }

    /**
     * Verify DOKU webhook signature.
     * SHA256(clientId + requestId + requestBody + apiKey)
     */
    public function verifySignature(array $payload, string $requestId, string $rawBody): bool
    {
        $signatureInput = $this->clientId.$requestId.$rawBody.$this->apiKey;
        $expected = hash('sha256', $signatureInput);
        $provided = $payload['signature'] ?? '';

        return hash_equals($expected, $provided);
    }

    /**
     * Check transaction status from DOKU API.
     */
    public function checkStatus(Order $order): ?array
    {
        if (empty($order->doku_order_id)) {
            return null;
        }

        $requestId = 'CHK-'.$order->id.'-'.time();

        try {
            $response = Http::withHeaders($this->generateHeaders($requestId, ''))
                ->timeout(10)
                ->get($this->baseUrl.'/v1/orders/'.$order->doku_order_id);

            if ($response->successful()) {
                return $response->json();
            }

            Log::warning('DOKU status check failed', [
                'order_id' => $order->id,
                'status_code' => $response->status(),
            ]);

            return null;
        } catch (\Exception $e) {
            Log::error('DOKU status check error', [
                'order_id' => $order->id,
                'error' => $e->getMessage(),
            ]);
            return null;
        }
    }

    /**
     * Sync order payment status from DOKU.
     */
    public function syncStatusFromDoku(Order $order): string
    {
        $dokuStatus = $this->checkStatus($order);

        if (! $dokuStatus) {
            return $order->payment_status;
        }

        $status = $this->mapStatus($dokuStatus['transaction']['status'] ?? 'PENDING');

        $transaction = PaymentTransaction::where('doku_order_id', $order->doku_order_id)->first();
        if ($transaction && $transaction->status !== $status) {
            $transaction->update([
                'status' => $status,
                'raw_response' => $dokuStatus,
            ]);
        }

        if ($status === 'paid' && $order->payment_status !== 'paid') {
            $this->markOrderPaid($order);
        } elseif (in_array($status, ['failed', 'expired']) && $order->payment_status === 'pending') {
            $order->update(['payment_status' => $status]);
        }

        return $status;
    }

    /**
     * Map DOKU payment status to Dombi status.
     */
    public function mapStatus(?string $dokuStatus): string
    {
        return match (strtoupper($dokuStatus ?? '')) {
            'SUCCESS' => 'paid',
            'PENDING' => 'pending',
            'FAILED' => 'failed',
            'EXPIRED' => 'expired',
            default => 'pending',
        };
    }

    /**
     * Mark order as paid and trigger side effects.
     */
    private function markOrderPaid(Order $order): void
    {
        if ($order->payment_status === 'paid') {
            return;
        }

        $order->update(['paid_at' => now(), 'payment_status' => 'paid']);

        if ($order->status === Order::STATUS_PENDING_CONFIRMATION) {
            $order->update(['status' => Order::STATUS_CONFIRMED, 'confirmed_at' => now()]);
            app(NotificationService::class)->notifyOrderConfirmed($order);
        }

        Cache::forget("outlet:{$order->outlet_id}:pending_orders");
        Cache::forget('owner:pending_counts');
        Cache::forget('owner:order_stats');
    }

    /**
     * Generate DOKU API headers with signature.
     */
    private function generateHeaders(string $requestId, string $body): array
    {
        $signature = hash('sha256', $this->clientId.$requestId.$body.$this->apiKey);

        return [
            'Client-Id' => $this->clientId,
            'Request-Id' => $requestId,
            'Signature' => $signature,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ];
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/Services/DokuService.php
git commit -m "feat: add DokuService payment service"
```

---

### Task 4: DokuPaymentController — Webhook + Redirect

**Files:**
- Create: `app/Http/Controllers/DokuPaymentController.php`
- Modify: `routes/web.php` (add routes)

**Interfaces:**
- Consumes: `DokuService` from Task 3
- Produces: `POST /payment/doku/notify`, `GET /payment/doku/redirect`
- Used by: DOKU sends webhooks to notify endpoint

- [ ] **Step 1: Create DokuPaymentController.php**

```php
<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Services\DokuService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class DokuPaymentController extends Controller
{
    public function notify(Request $request, DokuService $doku): JsonResponse
    {
        $rawBody = $request->getContent();
        $payload = json_decode($rawBody, true) ?? [];
        $requestId = $request->header('Request-Id', '');

        if (! $doku->verifySignature($payload, $requestId, $rawBody)) {
            Log::warning('DOKU webhook: invalid signature', ['request_id' => $requestId]);
            return response()->json(['message' => 'Invalid signature'], 401);
        }

        try {
            $doku->handleWebhook($payload);
        } catch (\Exception $e) {
            Log::error('DOKU webhook error', [
                'error' => $e->getMessage(),
                'payload' => $payload,
            ]);
            return response()->json(['message' => 'Internal error'], 500);
        }

        return response()->json(['message' => 'OK']);
    }

    public function redirect(Request $request): \Illuminate\Http\RedirectResponse
    {
        $invoiceNumber = $request->query('invoice_number') ?? $request->query('order_id');
        $status = $request->query('status');

        if ($invoiceNumber) {
            $order = Order::where('order_code', $invoiceNumber)->first()
                ?? Order::where('doku_order_id', $invoiceNumber)->first();

            if ($order) {
                return redirect()->route('customer.orders.confirm', [
                    'orderCode' => $order->order_code,
                ]);
            }
        }

        return redirect()->route('customer.home');
    }
}
```

- [ ] **Step 2: Add routes to web.php**

Remove the Midtrans webhook route (line 159):
```php
// DELETE: Route::post('/api/midtrans/webhook', [\App\Http\Controllers\MidtransWebhookController::class, 'handle']);
```

Add DOKU routes (outside customer middleware, accessible by DOKU servers):
```php
Route::post('/payment/doku/notify', [\App\Http\Controllers\DokuPaymentController::class, 'notify'])->name('doku.notify');
Route::get('/payment/doku/redirect', [\App\Http\Controllers\DokuPaymentController::class, 'redirect'])->name('doku.redirect');
```

- [ ] **Step 3: Verify routes**

Run: `php artisan route:list --name=doku`
Expected: Shows both DOKU routes

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/DokuPaymentController.php routes/web.php
git commit -m "feat: add DokuPaymentController with webhook and redirect endpoints"
```

---

### Task 5: CheckoutController — Use DokuService

**Files:**
- Modify: `app/Http/Controllers/Customer/CheckoutController.php`

**Interfaces:**
- Consumes: `DokuService::createPayment()` from Task 3
- Produces: Redirect to DOKU payment URL instead of Snap token

- [ ] **Step 1: Update submit method**

In `app/Http/Controllers/Customer/CheckoutController.php`, find the submit method (around line 482-496) and replace:

```php
// Before (lines 482-496)
$snapToken = null;
try {
    $snapToken = app(\App\Services\MidtransService::class)->createSnapToken($order);
} catch (\Exception $e) {
    \Illuminate\Support\Facades\Log::error('Failed to create Snap token at checkout', [
        'order_id' => $order->id,
        'error' => $e->getMessage(),
    ]);
}

return redirect()->route('customer.orders.confirm', [
    'orderCode' => $order->order_code,
])->with('snap_token', $snapToken);
```

Replace with:
```php
// After
try {
    $paymentUrl = app(\App\Services\DokuService::class)->createPayment($order);
    return redirect()->away($paymentUrl);
} catch (\Exception $e) {
    \Illuminate\Support\Facades\Log::error('Failed to create DOKU payment', [
        'order_id' => $order->id,
        'error' => $e->getMessage(),
    ]);
    return redirect()->route('customer.orders.confirm', [
        'orderCode' => $order->order_code,
    ])->with('error', 'Gagal membuat pembayaran. Silakan coba lagi.');
}
```

- [ ] **Step 2: Update payment method options**

In the same file, find the `getPaymentOptions()` method (around line 367-370). Replace:
```php
// Before
['value' => 'qris', 'label' => 'QRIS', 'fee_rate' => 0.007, 'description' => 'Scan QR untuk membayar'],
['value' => 'gopay', 'label' => 'GoPay', 'fee_rate' => 0.015, 'description' => 'Bayar dengan GoPay'],
['value' => 'shopeepay', 'label' => 'ShopeePay', 'fee_rate' => 0.015, 'description' => 'Bayar dengan ShopeePay'],
['value' => 'dana', 'label' => 'DANA', 'fee_rate' => 0.015, 'description' => 'Bayar dengan DANA'],
```

Replace with:
```php
// After (QRIS only)
['value' => 'qris', 'label' => 'QRIS', 'fee_rate' => 0.007, 'description' => 'Scan QR untuk membayar'],
```

- [ ] **Step 3: Update PAYMENT_METHODS constant**

Find line 29:
```php
// Before
private const PAYMENT_METHODS = ['qris', 'gopay', 'shopeepay', 'dana'];
```

Replace with:
```php
// After
private const PAYMENT_METHODS = ['qris'];
```

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/Customer/CheckoutController.php
git commit -m "feat: CheckoutController uses DokuService, QRIS-only"
```

---

### Task 6: OrderController — Use DokuService

**Files:**
- Modify: `app/Http/Controllers/Customer/OrderController.php`

**Interfaces:**
- Consumes: `DokuService::syncStatusFromDoku()` from Task 3
- Produces: Updated `paymentStatus()` method, removed snap_token refs

- [ ] **Step 1: Update imports**

At the top of `app/Http/Controllers/Customer/OrderController.php`, change:
```php
// Before
use App\Services\MidtransService;

// After
use App\Services\DokuService;
```

- [ ] **Step 2: Update paymentStatus method**

Find the `paymentStatus()` method (around line 227-263). Replace the Midtrans sync block:
```php
// Before (lines 235-246)
if ($order->payment_status === 'pending' && $order->midtrans_order_id) {
    try {
        $midtrans = app(MidtransService::class);
        $midtrans->syncStatusFromMidtrans($order);
        $order->refresh();
    } catch (\Exception $e) {
        Log::warning('Payment status sync failed', [
            'order_id' => $order->id,
            'error' => $e->getMessage(),
        ]);
    }
}
```

Replace with:
```php
// After
if ($order->payment_status === 'pending' && $order->doku_order_id) {
    try {
        $doku = app(DokuService::class);
        $doku->syncStatusFromDoku($order);
        $order->refresh();
    } catch (\Exception $e) {
        Log::warning('Payment status sync failed', [
            'order_id' => $order->id,
            'error' => $e->getMessage(),
        ]);
    }
}
```

- [ ] **Step 3: Remove snap_token from response**

In the same method, remove the Snap token logic (lines 249-255):
```php
// DELETE: $snapToken = null;
// DELETE: if ($order->payment_status === 'pending') {
// DELETE:     $pendingTx = $order->paymentTransactions()...
// DELETE:     $snapToken = $pendingTx?->raw_response?->snap_token ?? null;
// DELETE: }
```

Update the response to remove `snap_token`:
```php
// Before
return response()->json([
    'payment_status' => $order->payment_status,
    'snap_token' => $snapToken,
    'midtrans_order_id' => $order->midtrans_order_id,
    'paid_at' => $order->paid_at?->toISOString(),
]);

// After
return response()->json([
    'payment_status' => $order->payment_status,
    'doku_order_id' => $order->doku_order_id,
    'paid_at' => $order->paid_at?->toISOString(),
]);
```

- [ ] **Step 4: Update pay method**

Find the `pay()` method (around line 189-221). Replace Midtrans references:
```php
// Before
$midtrans = app(MidtransService::class);
// ... uses snap_token, midtrans_order_id

// After
$doku = app(DokuService::class);
// ... returns payment URL via redirect
```

The `pay()` method should now redirect to DOKU instead of returning a Snap token:
```php
public function pay(Order $order): \Illuminate\Http\RedirectResponse|\Illuminate\Http\JsonResponse
{
    // ... existing auth/COD checks ...

    try {
        $doku = app(DokuService::class);

        // Check for existing pending transaction
        $pendingTx = $order->paymentTransactions()
            ->where('status', 'pending')
            ->first();

        if ($pendingTx && $order->doku_order_id) {
            // Already has a pending payment — sync status
            $doku->syncStatusFromDoku($order);
            $order->refresh();

            if ($order->payment_status === 'paid') {
                return redirect()->route('customer.orders.confirm', [
                    'orderCode' => $order->order_code,
                ]);
            }
        }

        $paymentUrl = $doku->createPayment($order);
        return redirect()->away($paymentUrl);
    } catch (\Exception $e) {
        Log::error('Failed to create DOKU payment', [
            'order_id' => $order->id,
            'error' => $e->getMessage(),
        ]);

        return response()->json([
            'error' => 'Gagal membuat pembayaran. Silakan coba lagi.',
        ], 500);
    }
}
```

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Customer/OrderController.php
git commit -m "feat: OrderController uses DokuService, remove Snap references"
```

---

### Task 7: Frontend — Remove Snap.js from confirm.tsx

**Files:**
- Modify: `resources/js/pages/customer/orders/confirm.tsx`

**Interfaces:**
- Consumes: `paymentStatus` polling (keep), `doku_order_id` (new prop)
- Produces: Simplified confirm page without Snap.js

- [ ] **Step 1: Remove Snap.js imports and types**

Remove from the top of `confirm.tsx`:
```typescript
// DELETE: interface SnapWindow extends Window { snap?: { pay: ... } }
// DELETE: declare const window: SnapWindow;
// DELETE: const SNAP_JS_URL = import.meta.env.VITE_MIDTRANS_IS_PRODUCTION ...
```

- [ ] **Step 2: Remove Snap state and effects**

Remove these state variables:
```typescript
// DELETE: const [snapLoaded, setSnapLoaded] = useState(false);
// DELETE: const [snapOpened, setSnapOpened] = useState(false);
// DELETE: const snapAttempted = useRef(false);
```

Remove the Snap.js loading effect (lines 34-54):
```typescript
// DELETE: useEffect(() => { ... load snap script ... }, [snapToken, order.payment_status]);
```

Remove the auto-open Snap effect (lines 56-68):
```typescript
// DELETE: useEffect(() => { ... auto open snap ... }, [snapLoaded, snapToken]);
```

Remove the `openSnap` callback (lines 136-155):
```typescript
// DELETE: const openSnap = useCallback(() => { ... window.snap.pay ... }, [snapToken]);
```

- [ ] **Step 3: Remove snapToken prop usage**

Remove:
```typescript
// DELETE: const snapToken = props.snap_token ?? flash?.snap_token ?? null;
```

- [ ] **Step 4: Add "continue to payment" button for pending orders**

Add a button that navigates to the pay endpoint:
```tsx
{paymentStatus === 'pending' && order.doku_order_id && (
    <button
        onClick={() => router.visit(`/customer/orders/${order.id}/pay`)}
        className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white active:opacity-80"
    >
        Lanjutkan Pembayaran
    </button>
)}
```

- [ ] **Step 5: Keep payment status polling**

The existing polling effect (lines 70-111) should remain — it polls `/customer/orders/${order.id}/payment-status` which will be updated by the DOKU webhook.

- [ ] **Step 6: Commit**

```bash
git add resources/js/pages/customer/orders/confirm.tsx
git commit -m "feat: remove Snap.js from confirm page, add continue payment button"
```

---

### Task 8: Cleanup — Remove Midtrans

**Files:**
- Delete: `app/Services/MidtransService.php`
- Delete: `app/Http/Controllers/MidtransWebhookController.php`
- Delete: `app/Console/Commands/MidtransSimulateWebhook.php`
- Delete: `config/midtrans.php`

**Interfaces:**
- None — pure cleanup

- [ ] **Step 1: Remove Midtrans files**

```bash
rm app/Services/MidtransService.php
rm app/Http/Controllers/MidtransWebhookController.php
rm app/Console/Commands/MidtransSimulateWebhook.php
rm config/midtrans.php
```

- [ ] **Step 2: Remove Midtrans composer package**

```bash
composer remove midtrans/midtrans-php
```

- [ ] **Step 3: Verify no remaining Midtrans references**

```bash
grep -rn "Midtrans\|midtrans\|MIDTRANS" app/ config/ routes/ resources/js/ --include="*.php" --include="*.tsx" --include="*.ts" 2>/dev/null
```

Expected: No output (all references removed)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove all Midtrans code, config, and dependencies"
```

---

### Task 9: Tests — DokuService

**Files:**
- Create: `tests/Feature/DokuPaymentTest.php`

**Interfaces:**
- Tests `DokuService` from Task 3

- [ ] **Step 1: Create test file**

```php
<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\PaymentTransaction;
use App\Services\DokuService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class DokuPaymentTest extends TestCase
{
    use RefreshDatabase;

    private DokuService $doku;

    protected function setUp(): void
    {
        parent::setUp();
        config(['doku.client_id' => 'test-client', 'doku.api_key' => 'test-key', 'doku.base_url' => 'https://api-sandbox.doku.com']);
        $this->doku = app(DokuService::class);
    }

    public function test_create_payment_returns_url(): void
    {
        $order = Order::factory()->create([
            'total' => 50000,
            'order_code' => 'INV-001',
            'customer_name' => 'Test Customer',
            'payment_status' => 'pending',
        ]);

        Http::fake([
            '*/v1/payment-url' => Http::response([
                'order' => ['invoice_number' => 'INV-001'],
                'payment' => ['url' => 'https://sandbox.doku.com/pay/abc123'],
            ], 200),
        ]);

        $url = $this->doku->createPayment($order);

        $this->assertEquals('https://sandbox.doku.com/pay/abc123', $url);
        $this->assertEquals('INV-001', $order->fresh()->doku_order_id);
        $this->assertEquals('pending', $order->fresh()->payment_status);
        $this->assertDatabaseHas('payment_transactions', [
            'order_id' => $order->id,
            'doku_order_id' => 'INV-001',
            'status' => 'pending',
        ]);
    }

    public function test_webhook_success_marks_paid(): void
    {
        $order = Order::factory()->create(['payment_status' => 'pending']);
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => 'INV-001',
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'pending',
        ]);

        $payload = [
            'order' => ['invoice_number' => 'INV-001'],
            'transaction' => ['status' => 'SUCCESS'],
        ];

        $this->doku->handleWebhook($payload);

        $this->assertEquals('paid', $order->fresh()->payment_status);
        $this->assertNotNull($order->fresh()->paid_at);
    }

    public function test_webhook_invalid_signature_rejected(): void
    {
        $response = $this->postJson('/payment/doku/notify', [
            'order' => ['invoice_number' => 'INV-001'],
            'transaction' => ['status' => 'SUCCESS'],
            'signature' => 'invalid',
        ], [
            'Request-Id' => 'test-123',
        ]);

        $response->assertStatus(401);
    }

    public function test_webhook_idempotent(): void
    {
        $order = Order::factory()->create(['payment_status' => 'paid']);
        PaymentTransaction::create([
            'order_id' => $order->id,
            'doku_order_id' => 'INV-001',
            'payment_method' => 'qris',
            'amount' => $order->total,
            'status' => 'paid',
        ]);

        $payload = [
            'order' => ['invoice_number' => 'INV-001'],
            'transaction' => ['status' => 'SUCCESS'],
        ];

        $this->doku->handleWebhook($payload);

        // Should remain paid, not double-process
        $this->assertEquals('paid', $order->fresh()->payment_status);
    }

    public function test_status_mapping(): void
    {
        $this->assertEquals('paid', $this->doku->mapStatus('SUCCESS'));
        $this->assertEquals('pending', $this->doku->mapStatus('PENDING'));
        $this->assertEquals('failed', $this->doku->mapStatus('FAILED'));
        $this->assertEquals('expired', $this->doku->mapStatus('EXPIRED'));
        $this->assertEquals('pending', $this->doku->mapStatus('UNKNOWN'));
    }
}
```

- [ ] **Step 2: Run tests**

Run: `php artisan test tests/Feature/DokuPaymentTest.php -v`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add tests/Feature/DokuPaymentTest.php
git commit -m "test: add DokuService payment tests"
```

---

### Task 10: Final Verification

- [ ] **Step 1: Verify no Midtrans references remain**

Run: `grep -rn "Midtrans\|midtrans\|MIDTRANS\|snap_token\|snap\.js" app/ config/ routes/ resources/js/ tests/ --include="*.php" --include="*.tsx" --include="*.ts" 2>/dev/null`
Expected: No output

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -v "pre-existing"`
Expected: No new errors

- [ ] **Step 3: Run full test suite**

Run: `php artisan test`
Expected: All tests pass

- [ ] **Step 4: Verify routes**

Run: `php artisan route:list --name=doku`
Expected: Shows `doku.notify` and `doku.redirect`

Run: `php artisan route:list --name=midtrans`
Expected: No output (route removed)

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: Midtrans to DOKU migration complete"
```
