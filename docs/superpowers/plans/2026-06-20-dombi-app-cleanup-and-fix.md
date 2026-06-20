# Dombi App - Comprehensive Cleanup & Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical bugs, remove dead code, and address inconsistencies in the Dombi application

**Architecture:** Incremental fixes organized by priority - critical bugs first, then dead code cleanup, then improvements

**Tech Stack:** Laravel 13, React 19, Inertia.js, TypeScript, Tailwind CSS

---

## Current Status (2026-06-20)

| Metric | Value |
|--------|-------|
| **Tests** | 552 passing, 2,466 assertions |
| **Backend** | 38 models, 27 services |
| **Frontend** | 84+ components (42 customer, 42+ owner), 73+ pages |
| **Architecture** | Modular monolith (customer-app.tsx + internal-app.tsx) |
| **Deployment** | Hostinger shared hosting |

### Completed Phases
- ✅ Phase 1-4: Production readiness, settlement, returns, inventory
- ✅ Phase 5: Outlet features (sales reports, analytics)
- ✅ Phase 6: Owner analytics + report export
- ✅ Modular monolith split
- ✅ Security fixes
- ✅ Product management CRUD
- ✅ Outlet dashboard redesign
- ✅ Customer UX (search, cart confirmation, sonner toast)

### Pending Work
- 🔄 Phase 7: Courier routing optimization
- 🔄 Phase 8: UI/UX Polish
- 🔄 Phase 9: Hostinger deployment finalization
- 🔄 Landing page (separate project)

---

## Priority Summary

| Priority | Action | Count | Est. |
|----------|--------|-------|------|
| **Critical** | Fix CartController method name | 1 | 0.5h |
| **Critical** | Fix AccountPromotionController missing methods | 1 | 2h |
| **High** | Remove 27 unused frontend components | 27 files | 2h |
| **High** | Remove unused backend files | 2 files | 0.5h |
| **Medium** | Remove unused library files | 3 files | 0.5h |
| **Medium** | Populate HomeController with real data | 1 | 1h |
| **Low** | Consolidate duplicate dev routes | 1 | 0.5h |
| **Total** | | | **~7h (1 day)** |

---

## Task 1: Fix CartController Method Name (CRITICAL)

**Bug:** Route calls `updateQuantity` but controller has `setQuantity` method

**Files:**
- Modify: `routes/web.php:96`

- [ ] **Step 1: Read current route**

```bash
grep -n "cart/quantity" routes/web.php
```

Expected output:
```
96:        Route::post('/cart/quantity', [CartController::class, 'updateQuantity'])->name('cart.quantity');
```

- [ ] **Step 2: Fix route to use correct method name**

Edit `routes/web.php` line 96:

```php
// Before:
Route::post('/cart/quantity', [CartController::class, 'updateQuantity'])->name('cart.quantity');

// After:
Route::post('/cart/quantity', [CartController::class, 'setQuantity'])->name('cart.quantity');
```

- [ ] **Step 3: Verify route resolves**

```bash
php artisan route:list --name=cart.quantity
```

Expected: Route should show `CartController@setQuantity`

- [ ] **Step 4: Run tests**

```bash
php artisan test --filter=Cart
```

Expected: All cart tests pass

- [ ] **Step 5: Commit**

```bash
git add routes/web.php
git commit -m "fix: correct CartController method name from updateQuantity to setQuantity"
```

---

## Task 2: Fix AccountPromotionController Missing Methods (CRITICAL)

**Bug:** Routes call `sendOtp`, `verify`, `register` but controller only has `__invoke`

**Files:**
- Modify: `app/Http/Controllers/Customer/AccountPromotionController.php`

- [ ] **Step 1: Read current controller**

```bash
cat app/Http/Controllers/Customer/AccountPromotionController.php
```

Expected: Only `__invoke` method exists (76 lines)

- [ ] **Step 2: Add sendOtp method**

Edit `app/Http/Controllers/Customer/AccountPromotionController.php`:

```php
<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\User;
use App\Services\CheckoutOtpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class AccountPromotionController extends Controller
{
    /**
     * Send OTP for phone verification.
     */
    public function sendOtp(Request $request, CheckoutOtpService $otpService): JsonResponse
    {
        $validated = $request->validate([
            'phone' => ['required', 'string', 'regex:/^62[0-9]{9,13}$/'],
        ]);

        $result = $otpService->sendOtp($validated['phone']);

        if ($result['success']) {
            return response()->json([
                'success' => true,
                'message' => 'Kode OTP telah dikirim.',
            ]);
        }

        return response()->json([
            'success' => false,
            'error' => $result['message'] ?? 'Gagal mengirim OTP.',
        ], 422);
    }

    /**
     * Verify OTP code.
     */
    public function verify(Request $request, CheckoutOtpService $otpService): JsonResponse
    {
        $validated = $request->validate([
            'phone' => ['required', 'string'],
            'code' => ['required', 'string', 'size:6'],
        ]);

        $result = $otpService->verifyOtp($validated['phone'], $validated['code']);

        if ($result) {
            session(['otp_verified_phone' => $validated['phone']]);
            return response()->json(['verified' => true]);
        }

        return response()->json([
            'verified' => false,
            'error' => 'Kode OTP tidak valid.',
        ], 422);
    }

    /**
     * Register an account for an OTP-verified guest customer.
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone' => ['required', 'string', 'regex:/^62[0-9]{9,13}$/'],
            'name' => ['required', 'string', 'min:3', 'max:255'],
            'password' => ['required', 'string', Password::min(8), 'confirmed'],
        ]);

        $verifiedPhone = session('otp_verified_phone');
        if (! $verifiedPhone || $verifiedPhone !== $validated['phone']) {
            return response()->json([
                'success' => false,
                'error' => 'Silakan verifikasi nomor HP terlebih dahulu.',
            ], 422);
        }

        $existingUser = User::where('phone', $validated['phone'])->first();
        if ($existingUser) {
            return response()->json([
                'success' => false,
                'error' => 'Nomor HP sudah terdaftar. Silakan login.',
            ], 422);
        }

        $customer = Customer::where('phone', $validated['phone'])
            ->where('is_registered', false)
            ->first();

        if (! $customer) {
            return response()->json([
                'success' => false,
                'error' => 'Customer tidak ditemukan atau sudah terdaftar.',
            ], 422);
        }

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['phone'].'@dombi.guest',
            'phone' => $validated['phone'],
            'password' => Hash::make($validated['password']),
            'role' => 'customer',
            'is_active' => true,
        ]);

        $customer->linkToUser($user);

        auth()->login($user);

        return response()->json([
            'success' => true,
            'redirect' => route('customer.orders.index'),
        ]);
    }
}
```

- [ ] **Step 3: Run tests**

```bash
php artisan test --filter=AccountPromotion
```

Expected: All account promotion tests pass

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/Customer/AccountPromotionController.php
git commit -m "feat: add sendOtp, verify, and register methods to AccountPromotionController"
```

---

## Task 3: Remove Unused Customer Components (15 files)

**Files to delete:**
- `resources/js/components/customer/account-menu-item.tsx`
- `resources/js/components/customer/address-card.tsx`
- `resources/js/components/customer/checkout-header.tsx`
- `resources/js/components/customer/courier-card.tsx`
- `resources/js/components/customer/delivery-address-card.tsx`
- `resources/js/components/customer/location-service-banner.tsx`
- `resources/js/components/customer/outlet-fulfillment-card.tsx`
- `resources/js/components/customer/payment-method-card.tsx`
- `resources/js/components/customer/product-card.tsx`
- `resources/js/components/customer/profile-card.tsx`
- `resources/js/components/customer/quantity-stepper.tsx`
- `resources/js/components/customer/service-tier-table.tsx`
- `resources/js/components/customer/status-timeline.tsx`
- `resources/js/components/customer/sticky-checkout-bar.tsx`
- `resources/js/components/customer/sticky-place-order-bar.tsx`

- [ ] **Step 1: Verify no imports exist**

```bash
for f in resources/js/components/customer/account-menu-item.tsx resources/js/components/customer/address-card.tsx resources/js/components/customer/checkout-header.tsx resources/js/components/customer/courier-card.tsx resources/js/components/customer/delivery-address-card.tsx resources/js/components/customer/location-service-banner.tsx resources/js/components/customer/outlet-fulfillment-card.tsx resources/js/components/customer/payment-method-card.tsx resources/js/components/customer/product-card.tsx resources/js/components/customer/profile-card.tsx resources/js/components/customer/quantity-stepper.tsx resources/js/components/customer/service-tier-table.tsx resources/js/components/customer/status-timeline.tsx resources/js/components/customer/sticky-checkout-bar.tsx resources/js/components/customer/sticky-place-order-bar.tsx; do
    name=$(basename "$f" .tsx)
    count=$(grep -r "from.*$name\|import.*$name" resources/js --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "^$f:" | wc -l)
    echo "$name: $count imports"
done
```

Expected: All show 0 imports

- [ ] **Step 2: Delete all unused components**

```bash
rm resources/js/components/customer/account-menu-item.tsx
rm resources/js/components/customer/address-card.tsx
rm resources/js/components/customer/checkout-header.tsx
rm resources/js/components/customer/courier-card.tsx
rm resources/js/components/customer/delivery-address-card.tsx
rm resources/js/components/customer/location-service-banner.tsx
rm resources/js/components/customer/outlet-fulfillment-card.tsx
rm resources/js/components/customer/payment-method-card.tsx
rm resources/js/components/customer/product-card.tsx
rm resources/js/components/customer/profile-card.tsx
rm resources/js/components/customer/quantity-stepper.tsx
rm resources/js/components/customer/service-tier-table.tsx
rm resources/js/components/customer/status-timeline.tsx
rm resources/js/components/customer/sticky-checkout-bar.tsx
rm resources/js/components/customer/sticky-place-order-bar.tsx
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove 15 unused customer components"
```

---

## Task 4: Remove Unused Owner Components (12 files)

**Files to delete:**
- `resources/js/components/owner/activity-feed-card.tsx`
- `resources/js/components/owner/courier-leaderboard-card.tsx`
- `resources/js/components/owner/delivery-health-score-card.tsx`
- `resources/js/components/owner/failure-reasons-card.tsx`
- `resources/js/components/owner/inventory-adjustment-sheet.tsx`
- `resources/js/components/owner/oldest-deliveries-card.tsx`
- `resources/js/components/owner/operational-alert-card.tsx`
- `resources/js/components/owner/outlet-health-card.tsx`
- `resources/js/components/owner/owner-order-card.tsx`
- `resources/js/components/owner/owner-outlet-card.tsx`
- `resources/js/components/owner/product-assignment.tsx`
- `resources/js/components/owner/sla-violations-card.tsx`

- [ ] **Step 1: Verify no imports exist**

```bash
for f in resources/js/components/owner/activity-feed-card.tsx resources/js/components/owner/courier-leaderboard-card.tsx resources/js/components/owner/delivery-health-score-card.tsx resources/js/components/owner/failure-reasons-card.tsx resources/js/components/owner/inventory-adjustment-sheet.tsx resources/js/components/owner/oldest-deliveries-card.tsx resources/js/components/owner/operational-alert-card.tsx resources/js/components/owner/outlet-health-card.tsx resources/js/components/owner/owner-order-card.tsx resources/js/components/owner/owner-outlet-card.tsx resources/js/components/owner/product-assignment.tsx resources/js/components/owner/sla-violations-card.tsx; do
    name=$(basename "$f" .tsx)
    count=$(grep -r "from.*$name\|import.*$name" resources/js --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "^$f:" | wc -l)
    echo "$name: $count imports"
done
```

Expected: All show 0 imports

- [ ] **Step 2: Delete all unused components**

```bash
rm resources/js/components/owner/activity-feed-card.tsx
rm resources/js/components/owner/courier-leaderboard-card.tsx
rm resources/js/components/owner/delivery-health-score-card.tsx
rm resources/js/components/owner/failure-reasons-card.tsx
rm resources/js/components/owner/inventory-adjustment-sheet.tsx
rm resources/js/components/owner/oldest-deliveries-card.tsx
rm resources/js/components/owner/operational-alert-card.tsx
rm resources/js/components/owner/outlet-health-card.tsx
rm resources/js/components/owner/owner-order-card.tsx
rm resources/js/components/owner/owner-outlet-card.tsx
rm resources/js/components/owner/product-assignment.tsx
rm resources/js/components/owner/sla-violations-card.tsx
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove 12 unused owner components"
```

---

## Task 5: Remove Unused Backend Files (2 files)

**Files to delete:**
- `app/Services/OrderTimelineService.php`
- `app/Models/SettlementPeriod.php`

- [ ] **Step 1: Verify no imports exist**

```bash
grep -r "OrderTimelineService" app --include="*.php" | grep -v "class OrderTimelineService"
grep -r "SettlementPeriod" app --include="*.php" | grep -v "class SettlementPeriod"
```

Expected: No output (no imports)

- [ ] **Step 2: Delete files**

```bash
rm app/Services/OrderTimelineService.php
rm app/Models/SettlementPeriod.php
```

- [ ] **Step 3: Run tests**

```bash
php artisan test
```

Expected: All 552 tests pass

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove unused OrderTimelineService and SettlementPeriod"
```

---

## Task 6: Remove Unused Library Files (3 files)

**Files to delete:**
- `resources/js/lib/confirm-logout.ts`
- `resources/js/lib/design-tokens.ts`
- `resources/js/lib/utils.ts`

- [ ] **Step 1: Verify no imports exist**

```bash
grep -r "from.*confirm-logout\|import.*confirm-logout" resources/js --include="*.tsx" --include="*.ts"
grep -r "from.*design-tokens\|import.*design-tokens" resources/js --include="*.tsx" --include="*.ts"
grep -r "from.*lib/utils\|from.*@/lib/utils" resources/js --include="*.tsx" --include="*.ts"
```

Expected: No output (no imports)

- [ ] **Step 2: Delete files**

```bash
rm resources/js/lib/confirm-logout.ts
rm resources/js/lib/design-tokens.ts
rm resources/js/lib/utils.ts
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove unused library files (confirm-logout, design-tokens, utils)"
```

---

## Task 7: Populate HomeController with Real Data

**Files:**
- Modify: `app/Http/Controllers/Customer/HomeController.php`

- [ ] **Step 1: Read current controller**

```bash
cat app/Http/Controllers/Customer/HomeController.php
```

Expected: Returns empty `activeOrders` and null `lastOrder`

- [ ] **Step 2: Add real active orders data**

Edit `app/Http/Controllers/Customer/HomeController.php`:

```php
<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();
        $activeOrders = collect();
        $lastOrder = null;

        if ($user && $user->customer) {
            $customerId = $user->customer->id;

            // Get active orders (not completed/cancelled)
            $activeOrders = Order::where('customer_id', $customerId)
                ->whereIn('status', ['pending_confirmation', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery'])
                ->with(['outlet:id,name', 'delivery'])
                ->latest()
                ->limit(5)
                ->get();

            // Get last completed order for "repeat order" feature
            $lastOrder = Order::where('customer_id', $customerId)
                ->where('status', 'completed')
                ->with(['outlet:id,name', 'items.variant.family'])
                ->latest()
                ->first();
        }

        return Inertia::render('customer/home', [
            'customerName' => $user?->customer?->name ?? $user?->name ?? null,
            'activeOrders' => $activeOrders,
            'lastOrder' => $lastOrder,
        ]);
    }

    public function setFulfillmentDraft(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'fulfillment_type' => ['required', Rule::in(['pickup', 'delivery_dombi'])],
        ]);

        $request->session()->put('checkout.fulfillment', [
            'fulfillment_type' => $validated['fulfillment_type'],
        ]);

        return redirect()->route('customer.products.index');
    }
}
```

- [ ] **Step 3: Run tests**

```bash
php artisan test --filter=CustomerHome
```

Expected: All customer home tests pass

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/Customer/HomeController.php
git commit -m "feat: populate HomeController with real active orders and last order data"
```

---

## Verification

After completing all tasks:

1. Run full test suite: `php artisan test`
2. Build frontend: `npm run build`
3. Run linter: `./vendor/bin/pint --test`
4. Verify no broken imports or routes
5. Test critical flows manually:
   - Customer browse → checkout → order
   - Owner dashboard → manage outlets
   - Courier deliveries

## Summary

| Task | Description | Est. |
|------|-------------|------|
| 1 | Fix CartController method name | 0.5h |
| 2 | Fix AccountPromotionController | 2h |
| 3 | Remove 15 unused customer components | 1h |
| 4 | Remove 12 unused owner components | 1h |
| 5 | Remove unused backend files | 0.5h |
| 6 | Remove unused library files | 0.5h |
| 7 | Populate HomeController with real data | 1h |
| **Total** | | **~6.5h (1 day)** |
