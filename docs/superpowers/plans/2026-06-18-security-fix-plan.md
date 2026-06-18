# Security Fix Implementation Plan - Customer/Guest Role

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all security vulnerabilities in customer/guest role

**Architecture:** Add rate limiting, fix data leaks, secure OTP flow, add ownership checks

**Tech Stack:** Laravel 13, PHP 8.3

---

## Issues to Fix

| ID | Severity | Issue | Est. |
|----|----------|-------|------|
| V-01 | CRITICAL | Phone recovery leaks all order data | 2d |
| V-02 | CRITICAL | OTP logged in plaintext | 0.5d |
| V-03 | HIGH | No rate limiting on OTP endpoints | 0.5d |
| V-04 | HIGH | Registration no rate limiting/OTP check | 1d |
| V-05 | HIGH | Recovery session grants all orders | 1d |
| V-06 | MEDIUM | Order cancellation ownership check | 0.5d |
| V-07 | MEDIUM | OTP not required for pickup | 0.5d |
| V-08 | MEDIUM | Customer lookup leaks address | 0.5d |
| V-09 | MEDIUM | Cart quantity no upper bound | 0.5d |

**Total: ~7 days**

---

### Task 1: Fix Phone Recovery Data Leak (V-01)

**Files:**
- Modify: `app/Services/GuestOrderRecoveryService.php`
- Modify: `app/Http/Controllers/Customer/GuestOrderRecoveryController.php`

- [ ] **Step 1: Read current implementation**

```bash
cat app/Services/GuestOrderRecoveryService.php
cat app/Http/Controllers/Customer/GuestOrderRecoveryController.php
```

- [ ] **Step 2: Fix GuestOrderRecoveryService::recover()**

Change the method to return minimal data when only phone is provided (no second factor):

```php
public function recover(string $phone, ?string $recoveryToken = null, ?string $orderCode = null): array
{
    $customer = Customer::where('phone', $phone)->first();

    if (!$customer) {
        return ['found' => false, 'message' => 'Nomor HP tidak terdaftar.'];
    }

    // Phone-only lookup: return minimal data
    if (!$recoveryToken && !$orderCode) {
        return [
            'found' => true,
            'message' => 'Nomor HP ditemukan. Masukkan kode pesanan atau token recovery untuk melihat detail.',
            'requires_verification' => true,
        ];
    }

    // With second factor: return order data
    $orders = $this->findOrdersWithVerification($customer, $recoveryToken, $orderCode);

    if ($orders->isEmpty()) {
        return ['found' => true, 'message' => 'Pesanan tidak ditemukan.', 'requires_verification' => true];
    }

    return [
        'found' => true,
        'requires_verification' => false,
        'active_orders' => $orders->where('status', '!=', 'completed')->values(),
        'recent_orders' => $orders->where('status', 'completed')->values(),
    ];
}
```

- [ ] **Step 3: Update controller to handle requires_verification**

```php
public function recover(Request $request): JsonResponse
{
    $validated = $request->validate([
        'phone' => ['required', 'string'],
        'recovery_token' => ['nullable', 'string'],
        'order_code' => ['nullable', 'string'],
    ]);

    $result = $this->recoveryService->recover(
        $validated['phone'],
        $validated['recovery_token'] ?? null,
        $validated['order_code'] ?? null
    );

    // Only set session if verification passed
    if ($result['found'] && !($result['requires_verification'] ?? false)) {
        $orderIds = collect($result['active_orders'])->pluck('id')
            ->merge(collect($result['recent_orders'])->pluck('id'))
            ->filter()->values()->all();

        session(['recovered_order_ids' => $orderIds, 'recovered_phone' => $validated['phone']]);
    }

    return response()->json($result);
}
```

- [ ] **Step 4: Update frontend to handle requires_verification**

In `resources/js/lib/order-recovery.ts` or similar:

```typescript
const result = await response.json();

if (result.found && result.requires_verification) {
    // Show message asking for order code or recovery token
    setMessage('Masukkan kode pesanan atau token recovery untuk melihat detail.');
} else if (result.found && !result.requires_verification) {
    // Show orders
    setOrders([...result.active_orders, ...result.recent_orders]);
}
```

- [ ] **Step 5: Test**

```bash
php artisan test --filter=GuestOrderRecovery
```

- [ ] **Step 6: Commit**

```bash
git add app/Services/GuestOrderRecoveryService.php app/Http/Controllers/Customer/GuestOrderRecoveryController.php
git commit -m "fix: phone-only recovery returns minimal data, requires second factor for order details"
```

---

### Task 2: Remove OTP Plaintext Logging (V-02)

**Files:**
- Modify: `app/Services/CheckoutOtpService.php`
- Modify: `app/Services/PhoneVerificationService.php`

- [ ] **Step 1: Read current implementation**

```bash
cat app/Services/CheckoutOtpService.php
cat app/Services/PhoneVerificationService.php
```

- [ ] **Step 2: Wrap OTP logging with environment check**

In both files, change:

```php
// Before:
logger()->info('Checkout OTP generated', [
    'phone' => $phone,
    'code' => $code,
]);

// After:
if (app()->isLocal()) {
    logger()->info('Checkout OTP generated', [
        'phone' => $phone,
        'code' => $code,
    ]);
}
```

- [ ] **Step 3: Test**

```bash
php artisan test --filter=Otp
```

- [ ] **Step 4: Commit**

```bash
git add app/Services/CheckoutOtpService.php app/Services/PhoneVerificationService.php
git commit -m "fix: only log OTP in local environment, remove plaintext logging in production"
```

---

### Task 3: Add Rate Limiting to OTP Endpoints (V-03)

**Files:**
- Modify: `routes/web.php`

- [ ] **Step 1: Read current routes**

```bash
grep -n "send-otp\|verify-otp\|verify-phone" routes/web.php
```

- [ ] **Step 2: Add throttle middleware**

```php
// Checkout OTP
Route::post('/checkout/send-otp', [CheckoutController::class, 'sendOtp'])
    ->middleware('throttle:5,1') // 5 per minute
    ->name('checkout.send-otp');

Route::post('/checkout/verify-otp', [CheckoutController::class, 'verifyOtpSubmit'])
    ->middleware('throttle:10,1') // 10 per minute (allow retries)
    ->name('checkout.verify-otp.submit');

// Phone verification
Route::post('/verify-phone/send-otp', [PhoneVerificationController::class, 'sendOtp'])
    ->middleware('throttle:5,1')
    ->name('verify-phone.send-otp');

Route::post('/verify-phone/verify', [PhoneVerificationController::class, 'verify'])
    ->middleware('throttle:10,1')
    ->name('verify-phone.verify');
```

- [ ] **Step 3: Test**

```bash
php artisan test --filter=Checkout
```

- [ ] **Step 4: Commit**

```bash
git add routes/web.php
git commit -m "fix: add rate limiting to OTP send/verify endpoints"
```

---

### Task 4: Secure Account Registration (V-04)

**Files:**
- Modify: `app/Http/Controllers/Customer/AccountPromotionController.php`
- Modify: `routes/web.php`

- [ ] **Step 1: Read current implementation**

```bash
cat app/Http/Controllers/Customer/AccountPromotionController.php
```

- [ ] **Step 2: Add OTP verification check**

```php
public function register(Request $request): RedirectResponse
{
    $validated = $request->validate([
        'phone' => ['required', 'string'],
        'name' => ['required', 'string', 'max:255'],
        'password' => ['required', 'string', 'min:8'],
    ]);

    // Verify OTP was completed in this session
    $verifiedPhone = session('otp_verified_phone');
    if (!$verifiedPhone || $verifiedPhone !== $validated['phone']) {
        return back()->withErrors(['phone' => 'Silakan verifikasi nomor HP terlebih dahulu.']);
    }

    // Find or create customer
    $customer = Customer::where('phone', $validated['phone'])->first();

    if (!$customer) {
        return back()->withErrors(['phone' => 'Nomor HP tidak ditemukan.']);
    }

    if ($customer->is_registered) {
        return back()->withErrors(['phone' => 'Nomor HP sudah terdaftar.']);
    }

    // Create user and link to customer
    $user = User::create([
        'name' => $validated['name'],
        'phone' => $validated['phone'],
        'password' => Hash::make($validated['password']),
        'role' => 'customer',
    ]);

    $customer->update([
        'user_id' => $user->id,
        'is_registered' => true,
    ]);

    // Clear OTP session
    session()->forget(['otp_verified_phone', 'otp_phone', 'otp_attempts']);

    Auth::login($user);

    return redirect()->route('customer.home')->with('success', 'Akun berhasil dibuat!');
}
```

- [ ] **Step 3: Add rate limiting to route**

```php
Route::post('/customer/register', [AccountPromotionController::class, 'register'])
    ->middleware('throttle:3,1') // 3 per minute
    ->name('customer.register');
```

- [ ] **Step 4: Test**

```bash
php artisan test --filter=AccountPromotion
```

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Customer/AccountPromotionController.php routes/web.php
git commit -m "fix: require OTP verification before account registration, add rate limiting"
```

---

### Task 5: Limit Recovery Session Scope (V-05)

**Files:**
- Modify: `app/Http/Controllers/Customer/GuestOrderRecoveryController.php`

- [ ] **Step 1: Read current implementation**

```bash
cat app/Http/Controllers/Customer/GuestOrderRecoveryController.php
```

- [ ] **Step 2: Only store verified order IDs**

```php
// Before: Store ALL order IDs
$orderIds = collect($result['active_orders'])->pluck('id')
    ->merge(collect($result['recent_orders'])->pluck('id'))
    ->filter()->values()->all();

// After: Only store specifically verified order IDs
$verifiedOrderIds = [];
if ($validated['recovery_token'] ?? null) {
    $order = Order::where('recovery_token', $validated['recovery_token'])->first();
    if ($order) {
        $verifiedOrderIds[] = $order->id;
    }
} elseif ($validated['order_code'] ?? null) {
    $order = Order::where('order_code', $validated['order_code'])->first();
    if ($order) {
        $verifiedOrderIds[] = $order->id;
    }
}

session([
    'recovered_order_ids' => $verifiedOrderIds,
    'recovered_phone' => $validated['phone'],
]);
```

- [ ] **Step 3: Test**

```bash
php artisan test --filter=GuestOrderRecovery
```

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/Customer/GuestOrderRecoveryController.php
git commit -m "fix: recovery session only stores verified order IDs, not all customer orders"
```

---

### Task 6: Add Order Cancellation Ownership Check (V-06)

**Files:**
- Modify: `app/Http/Controllers/Customer/OrderController.php`

- [ ] **Step 1: Read current implementation**

```bash
cat app/Http/Controllers/Customer/OrderController.php
```

- [ ] **Step 2: Add explicit ownership check**

```php
public function cancel(Order $order, CancelOrderRequest $request): RedirectResponse
{
    // Defense-in-depth: explicit ownership check
    $user = $request->user();
    if ($user->role === 'customer' && $order->customer_id !== $user->customer?->id) {
        abort(403);
    }

    $this->orderStatusService->cancelByCustomer($order, $request->validated('reason'));

    return redirect()->route('customer.orders.show', $order)
        ->with('success', 'Pesanan berhasil dibatalkan.');
}
```

- [ ] **Step 3: Test**

```bash
php artisan test --filter=OrderCancellation
```

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/Customer/OrderController.php
git commit -m "fix: add explicit ownership check to order cancellation endpoint"
```

---

### Task 7: Fix Customer Lookup Data Leak (V-08)

**Files:**
- Modify: `app/Http/Controllers/Customer/CheckoutController.php`

- [ ] **Step 1: Read current implementation**

```bash
grep -A 30 "function lookupCustomer" app/Http/Controllers/Customer/CheckoutController.php
```

- [ ] **Step 2: Remove address data from response**

```php
// Before:
return response()->json([
    'found' => (bool) $customer,
    'customer' => $customer ? [
        'name' => $customer->name,
        'phone_number' => $phone,
        'previous_address' => $customer->addresses->first(),
    ] : null,
]);

// After:
return response()->json([
    'found' => (bool) $customer,
    'customer' => $customer ? [
        'name' => $customer->name,
        'phone_number' => $phone,
    ] : null,
]);
```

- [ ] **Step 3: Test**

```bash
php artisan test --filter=Checkout
```

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/Customer/CheckoutController.php
git commit -m "fix: remove address data from customer lookup response"
```

---

### Task 8: Add Cart Quantity Upper Bound (V-09)

**Files:**
- Modify: `app/Http/Controllers/Customer/CartController.php`
- Modify: `app/Http/Controllers/Customer/CheckoutController.php`

- [ ] **Step 1: Read current implementation**

```bash
grep -n "min:1" app/Http/Controllers/Customer/CartController.php
grep -n "min:1" app/Http/Controllers/Customer/CheckoutController.php
```

- [ ] **Step 2: Add max validation**

```php
// CartController
'quantity' => ['required', 'integer', 'min:1', 'max:999'],

// CheckoutController
'quantity' => ['required', 'integer', 'min:1', 'max:999'],
```

- [ ] **Step 3: Test**

```bash
php artisan test --filter=Cart
```

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/Customer/CartController.php app/Http/Controllers/Customer/CheckoutController.php
git commit -m "fix: add max quantity validation (999) to cart and checkout"
```

---

## Verification

After completing all tasks:

1. Run full test suite: `php artisan test`
2. Run linter: `./vendor/bin/pint --test`
3. Build frontend: `npm run build`
4. Manual security testing

## Summary

| Task | Issue | Severity | Est. |
|------|-------|----------|------|
| 1. Phone recovery fix | V-01 | CRITICAL | 2d |
| 2. OTP logging fix | V-02 | CRITICAL | 0.5d |
| 3. OTP rate limiting | V-03 | HIGH | 0.5d |
| 4. Registration security | V-04 | HIGH | 1d |
| 5. Recovery session scope | V-05 | HIGH | 1d |
| 6. Cancellation ownership | V-06 | MEDIUM | 0.5d |
| 7. Customer lookup fix | V-08 | MEDIUM | 0.5d |
| 8. Cart quantity bound | V-09 | MEDIUM | 0.5d |
| **Total** | | | **~7d** |
