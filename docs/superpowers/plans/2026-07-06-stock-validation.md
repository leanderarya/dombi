# Stock Validation & Communication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement stock validation at cart and checkout levels, with unified terminology across all roles.

**Architecture:** Backend validates stock on add-to-cart and checkout submit, returns specific error messages. Frontend limits quantity inputs and shows real-time stock status. Auto-adjustment with user confirmation for checkout.

**Tech Stack:** Laravel 13, React 19, Inertia.js, TypeScript, MySQL 8.0+

## Global Constraints

- All stock calculations use `available_stock = current_stock - reserved_stock`
- Threshold for "low stock": `available_stock <= minimum_stock`
- All API responses include `available_stock` and `max_quantity`
- Error messages in Indonesian, specific per item
- No real-time polling — validate on page load only

---

### Task 1: Create StockAdjustedException

**Files:**
- Create: `app/Exceptions/StockAdjustedException.php`
- Test: `tests/Unit/Exceptions/StockAdjustedExceptionTest.php`

**Interfaces:**
- Produces: `StockAdjustedException` with `$adjustments` array

- [ ] **Step 1: Write the failing test**

```php
<?php

namespace Tests\Unit\Exceptions;

use App\Exceptions\StockAdjustedException;
use Tests\TestCase;

class StockAdjustedExceptionTest extends TestCase
{
    public function test_exception_stores_adjustments(): void
    {
        $adjustments = [
            [
                'variant_id' => 5,
                'original_qty' => 10,
                'adjusted_qty' => 3,
                'available_stock' => 3,
            ],
        ];

        $exception = new StockAdjustedException($adjustments);

        $this->assertEquals($adjustments, $exception->adjustments);
        $this->assertEquals('Stock adjusted', $exception->getMessage());
    }

    public function test_exception_with_empty_adjustments(): void
    {
        $exception = new StockAdjustedException([]);

        $this->assertEquals([], $exception->adjustments);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Unit/Exceptions/StockAdjustedExceptionTest.php`
Expected: FAIL with "Class StockAdjustedException not found"

- [ ] **Step 3: Write minimal implementation**

```php
<?php

namespace App\Exceptions;

use Exception;

class StockAdjustedException extends Exception
{
    public array $adjustments;

    public function __construct(array $adjustments)
    {
        $this->adjustments = $adjustments;
        parent::__construct('Stock adjusted');
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Unit/Exceptions/StockAdjustedExceptionTest.php`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/Exceptions/StockAdjustedException.php tests/Unit/Exceptions/StockAdjustedExceptionTest.php
git commit -m "feat: add StockAdjustedException for stock validation"
```

---

### Task 2: Update CartController to Return Stock Info

**Files:**
- Modify: `app/Http/Controllers/Customer/CartController.php`
- Test: `tests/Feature/Customer/CartControllerTest.php`

**Interfaces:**
- Consumes: `OutletInventory` model
- Produces: `available_stock`, `max_quantity` in response

- [ ] **Step 1: Write the failing test**

```php
<?php

namespace Tests\Feature\Customer;

use App\Models\Customer;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CartControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_add_to_cart_returns_stock_info(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $outlet = Outlet::factory()->create();
        $variant = ProductVariant::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 3,
            'minimum_stock' => 2,
        ]);

        $response = $this->actingAs($user)
            ->postJson('/customer/cart/add', [
                'product_variant_id' => $variant->id,
                'quantity' => 5,
            ]);

        $response->assertOk()
            ->assertJsonStructure([
                'success',
                'item' => ['product_variant_id', 'quantity', 'available_stock', 'max_quantity'],
                'warning',
            ])
            ->assertJson([
                'success' => true,
                'item' => [
                    'product_variant_id' => $variant->id,
                    'quantity' => 5,
                    'available_stock' => 7,
                    'max_quantity' => 7,
                ],
                'warning' => null,
            ]);
    }

    public function test_add_to_cart_auto_adjusts_when_exceeds_stock(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $outlet = Outlet::factory()->create();
        $variant = ProductVariant::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 5,
            'minimum_stock' => 2,
        ]);

        $response = $this->actingAs($user)
            ->postJson('/customer/cart/add', [
                'product_variant_id' => $variant->id,
                'quantity' => 10,
            ]);

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'item' => [
                    'quantity' => 5,
                    'available_stock' => 5,
                    'max_quantity' => 5,
                ],
                'warning' => 'Jumlah dikurangi dari 10 ke 5 (stok tersisa 5)',
            ]);
    }

    public function test_add_to_cart_fails_when_out_of_stock(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $outlet = Outlet::factory()->create();
        $variant = ProductVariant::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 10,
            'minimum_stock' => 2,
        ]);

        $response = $this->actingAs($user)
            ->postJson('/customer/cart/add', [
                'product_variant_id' => $variant->id,
                'quantity' => 1,
            ]);

        $response->assertOk()
            ->assertJson([
                'success' => false,
                'error' => 'Stok produk ini sudah habis',
                'item' => [
                    'available_stock' => 0,
                    'max_quantity' => 0,
                ],
            ]);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Customer/CartControllerTest.php`
Expected: FAIL with old response structure

- [ ] **Step 3: Update CartController**

```php
<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\OutletInventory;
use App\Models\ProductVariant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CartController extends Controller
{
    public function add(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'quantity' => ['required', 'integer', 'min:1'],
        ]);

        $variant = ProductVariant::findOrFail($validated['product_variant_id']);
        $quantity = $validated['quantity'];

        // Get available stock from outlet inventory
        $inventory = OutletInventory::where('product_variant_id', $variant->id)
            ->where('is_active', true)
            ->first();

        $availableStock = $inventory
            ? max(0, (int) $inventory->current_stock - (int) $inventory->reserved_stock)
            : 0;

        $maxQuantity = $availableStock;

        // Check if out of stock
        if ($availableStock <= 0) {
            return response()->json([
                'success' => false,
                'error' => 'Stok produk ini sudah habis',
                'item' => [
                    'product_variant_id' => $variant->id,
                    'quantity' => 0,
                    'available_stock' => 0,
                    'max_quantity' => 0,
                ],
            ]);
        }

        // Auto-adjust if exceeds available stock
        $originalQuantity = $quantity;
        if ($quantity > $availableStock) {
            $quantity = $availableStock;
        }

        // Store in session cart
        $cart = $request->session()->get('cart', []);
        $existingKey = collect($cart)->search(fn ($item) => $item['product_variant_id'] === $variant->id);

        if ($existingKey !== false) {
            $cart[$existingKey]['quantity'] = $quantity;
        } else {
            $cart[] = [
                'product_variant_id' => $variant->id,
                'quantity' => $quantity,
            ];
        }

        $request->session()->put('cart', $cart);

        $warning = null;
        if ($originalQuantity > $availableStock) {
            $warning = "Jumlah dikurangi dari {$originalQuantity} ke {$availableStock} (stok tersisa {$availableStock})";
        }

        return response()->json([
            'success' => true,
            'item' => [
                'product_variant_id' => $variant->id,
                'quantity' => $quantity,
                'available_stock' => $availableStock,
                'max_quantity' => $maxQuantity,
            ],
            'warning' => $warning,
        ]);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/Customer/CartControllerTest.php`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Customer/CartController.php tests/Feature/Customer/CartControllerTest.php
git commit -m "feat: CartController returns available_stock and max_quantity"
```

---

### Task 3: Add validate-stock Endpoint to CheckoutController

**Files:**
- Modify: `app/Http/Controllers/Customer/CheckoutController.php`
- Test: `tests/Feature/Customer/CheckoutControllerTest.php`

**Interfaces:**
- Consumes: Session cart, `OutletInventory` model
- Produces: `validateStock()` method returning items with stock info

- [ ] **Step 1: Write the failing test**

```php
<?php

namespace Tests\Feature\Customer;

use App\Models\Customer;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CheckoutControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_validate_stock_returns_items_with_stock_info(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $outlet = Outlet::factory()->create();
        $variant = ProductVariant::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 3,
            'minimum_stock' => 2,
        ]);

        // Set cart in session
        $this->actingAs($user)
            ->withSession(['cart' => [
                ['product_variant_id' => $variant->id, 'quantity' => 5],
            ]])
            ->getJson('/customer/checkout/validate-stock')
            ->assertOk()
            ->assertJson([
                'valid' => true,
                'items' => [
                    [
                        'product_variant_id' => $variant->id,
                        'requested_qty' => 5,
                        'available_stock' => 7,
                        'adjusted' => false,
                    ],
                ],
                'warnings' => [],
            ]);
    }

    public function test_validate_stock_detects_stock_reduction(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $outlet = Outlet::factory()->create();
        $variant = ProductVariant::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 8,
            'minimum_stock' => 2,
        ]);

        $this->actingAs($user)
            ->withSession(['cart' => [
                ['product_variant_id' => $variant->id, 'quantity' => 5],
            ]])
            ->getJson('/customer/checkout/validate-stock')
            ->assertOk()
            ->assertJson([
                'valid' => false,
                'items' => [
                    [
                        'product_variant_id' => $variant->id,
                        'requested_qty' => 5,
                        'available_stock' => 2,
                        'adjusted' => true,
                        'adjusted_qty' => 2,
                        'removed' => false,
                    ],
                ],
            ])
            ->assertJsonStructure(['warnings']);
    }

    public function test_validate_stock_detects_out_of_stock(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $outlet = Outlet::factory()->create();
        $variant = ProductVariant::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 10,
            'minimum_stock' => 2,
        ]);

        $this->actingAs($user)
            ->withSession(['cart' => [
                ['product_variant_id' => $variant->id, 'quantity' => 5],
            ]])
            ->getJson('/customer/checkout/validate-stock')
            ->assertOk()
            ->assertJson([
                'valid' => false,
                'items' => [
                    [
                        'product_variant_id' => $variant->id,
                        'requested_qty' => 5,
                        'available_stock' => 0,
                        'adjusted' => true,
                        'adjusted_qty' => 0,
                        'removed' => true,
                    ],
                ],
            ]);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Customer/CheckoutControllerTest.php`
Expected: FAIL with route not found

- [ ] **Step 3: Add route and method**

Add to `routes/web.php` in customer group:
```php
Route::get('/customer/checkout/validate-stock', [CheckoutController::class, 'validateStock'])
    ->name('customer.checkout.validate-stock');
```

Add method to `CheckoutController.php`:
```php
public function validateStock(Request $request): JsonResponse
{
    $cart = $request->session()->get('cart', []);

    if (empty($cart)) {
        return response()->json([
            'valid' => true,
            'items' => [],
            'warnings' => [],
        ]);
    }

    $variantIds = collect($cart)->pluck('product_variant_id')->filter()->map(fn ($id) => (int) $id)->all();
    $variants = ProductVariant::whereIn('id', $variantIds)
        ->where('is_active', true)
        ->with('family')
        ->get()
        ->keyBy('id');

    $items = [];
    $warnings = [];
    $valid = true;

    foreach ($cart as $cartItem) {
        $variantId = (int) $cartItem['product_variant_id'];
        $requestedQty = (int) $cartItem['quantity'];
        $variant = $variants->get($variantId);

        if (!$variant) {
            continue;
        }

        $inventory = OutletInventory::where('product_variant_id', $variantId)
            ->where('is_active', true)
            ->first();

        $availableStock = $inventory
            ? max(0, (int) $inventory->current_stock - (int) $inventory->reserved_stock)
            : 0;

        $adjusted = false;
        $adjustedQty = $requestedQty;
        $removed = false;

        if ($availableStock <= 0) {
            $adjusted = true;
            $adjustedQty = 0;
            $removed = true;
            $valid = false;
            $warnings[] = "{$variant->family->name} {$variant->name}: stok habis, item dihapus dari pesanan";
        } elseif ($availableStock < $requestedQty) {
            $adjusted = true;
            $adjustedQty = $availableStock;
            $valid = false;
            $warnings[] = "{$variant->family->name} {$variant->name}: jumlah dikurangi dari {$requestedQty} ke {$availableStock} (stok tersisa {$availableStock})";
        }

        $items[] = [
            'product_variant_id' => $variantId,
            'name' => $variant->family->name ?? $variant->name,
            'variant_name' => $variant->name,
            'requested_qty' => $requestedQty,
            'available_stock' => $availableStock,
            'adjusted' => $adjusted,
            'adjusted_qty' => $adjustedQty,
            'removed' => $removed,
        ];
    }

    return response()->json([
        'valid' => $valid,
        'items' => $items,
        'warnings' => $warnings,
    ]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/Customer/CheckoutControllerTest.php`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Customer/CheckoutController.php routes/web.php tests/Feature/Customer/CheckoutControllerTest.php
git commit -m "feat: add validate-stock endpoint to CheckoutController"
```

---

### Task 4: Add Auto-Adjust Logic to OrderService

**Files:**
- Modify: `app/Services/OrderService.php`
- Test: `tests/Feature/Services/OrderServiceTest.php`

**Interfaces:**
- Consumes: `StockAdjustedException`
- Produces: Auto-adjust logic in `createCheckoutOrder()`

- [ ] **Step 1: Write the failing test**

```php
<?php

namespace Tests\Feature\Services;

use App\Exceptions\StockAdjustedException;
use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\ProductVariant;
use App\Models\User;
use App\Services\OrderService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_create_order_throws_exception_when_stock_insufficient(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $outlet = Outlet::factory()->create();
        $variant = ProductVariant::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 8,
            'minimum_stock' => 2,
        ]);

        $orderService = app(OrderService::class);

        $this->expectException(StockAdjustedException::class);

        try {
            $orderService->createCheckoutOrder($user, [
                'items' => [
                    ['product_variant_id' => $variant->id, 'quantity' => 5],
                ],
                'fulfillment_type' => 'pickup',
                'selected_outlet_id' => $outlet->id,
                'customer_name' => 'Test Customer',
                'phone_number' => '6281234567890',
                'payment_method' => 'qris',
            ]);
        } catch (StockAdjustedException $e) {
            $this->assertCount(1, $e->adjustments);
            $this->assertEquals($variant->id, $e->adjustments[0]['variant_id']);
            $this->assertEquals(5, $e->adjustments[0]['original_qty']);
            $this->assertEquals(2, $e->adjustments[0]['adjusted_qty']);
            $this->assertEquals(2, $e->adjustments[0]['available_stock']);
            throw $e;
        }
    }

    public function test_create_order_succeeds_when_stock_sufficient(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $outlet = Outlet::factory()->create();
        $variant = ProductVariant::factory()->create();

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 3,
            'minimum_stock' => 2,
        ]);

        $orderService = app(OrderService::class);

        $order = $orderService->createCheckoutOrder($user, [
            'items' => [
                ['product_variant_id' => $variant->id, 'quantity' => 5],
            ],
            'fulfillment_type' => 'pickup',
            'selected_outlet_id' => $outlet->id,
            'customer_name' => 'Test Customer',
            'phone_number' => '6281234567890',
            'payment_method' => 'qris',
        ]);

        $this->assertInstanceOf(Order::class, $order);
        $this->assertEquals($outlet->id, $order->outlet_id);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Services/OrderServiceTest.php`
Expected: FAIL with old behavior (no auto-adjust)

- [ ] **Step 3: Update OrderService**

Find the stock validation section in `createCheckoutOrder()` and add auto-adjust logic:

```php
// After loading items and before creating order
$adjustments = [];
foreach ($items as $index => $item) {
    $variantId = $item['product_variant_id'];
    $requestedQty = $item['quantity'];

    $inventory = OutletInventory::where('product_variant_id', $variantId)
        ->where('outlet_id', $outletId)
        ->lockForUpdate()
        ->first();

    if (!$inventory) {
        continue;
    }

    $availableStock = max(0, (int) $inventory->current_stock - (int) $inventory->reserved_stock);

    if ($availableStock <= 0) {
        $adjustments[] = [
            'variant_id' => $variantId,
            'original_qty' => $requestedQty,
            'adjusted_qty' => 0,
            'available_stock' => 0,
        ];
        // Mark for removal
        unset($items[$index]);
    } elseif ($availableStock < $requestedQty) {
        $adjustments[] = [
            'variant_id' => $variantId,
            'original_qty' => $requestedQty,
            'adjusted_qty' => $availableStock,
            'available_stock' => $availableStock,
        ];
        $items[$index]['quantity'] = $availableStock;
    }
}

if (!empty($adjustments)) {
    throw new StockAdjustedException($adjustments);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/Services/OrderServiceTest.php`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/Services/OrderService.php tests/Feature/Services/OrderServiceTest.php
git commit -m "feat: add auto-adjust logic to OrderService for stock validation"
```

---

### Task 5: Handle StockAdjustedException in CheckoutController

**Files:**
- Modify: `app/Http/Controllers/Customer/CheckoutController.php`
- Test: Update `tests/Feature/Customer/CheckoutControllerTest.php`

**Interfaces:**
- Consumes: `StockAdjustedException`
- Produces: JSON response with adjustments and warnings

- [ ] **Step 1: Write the failing test**

```php
public function test_submit_returns_422_with_adjustments_when_stock_insufficient(): void
{
    $user = User::factory()->create(['role' => 'customer']);
    $customer = Customer::factory()->create(['user_id' => $user->id]);
    $outlet = Outlet::factory()->create();
    $variant = ProductVariant::factory()->create();

    OutletInventory::factory()->create([
        'outlet_id' => $outlet->id,
        'product_variant_id' => $variant->id,
        'current_stock' => 10,
        'reserved_stock' => 8,
        'minimum_stock' => 2,
    ]);

    $this->actingAs($user)
        ->withSession([
            'cart' => [['product_variant_id' => $variant->id, 'quantity' => 5]],
            'checkout.fulfillment' => ['fulfillment_type' => 'pickup', 'selected_outlet_id' => $outlet->id],
            'checkout.customer' => ['customer_name' => 'Test', 'phone_number' => '6281234567890'],
        ])
        ->postJson('/customer/checkout/submit', ['payment_method' => 'qris'])
        ->assertStatus(422)
        ->assertJson([
            'adjusted' => true,
            'warnings' => [
                'Susu Kambing Original 250ml: jumlah dikurangi dari 5 ke 2 (stok tersisa 2)',
            ],
        ])
        ->assertJsonStructure(['adjustments', 'warnings']);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Customer/CheckoutControllerTest.php --filter=test_submit_returns_422`
Expected: FAIL with old error handling

- [ ] **Step 3: Update CheckoutController::submit()**

```php
public function submit(Request $request, OrderService $orderService, ...): RedirectResponse|JsonResponse
{
    // ... existing validation ...

    try {
        $order = $orderService->createCheckoutOrder($request->user(), [
            ...($location ?? []),
            ...$customer,
            'items' => $cart,
            'fulfillment_type' => $fulfillmentType,
            'selected_outlet_id' => $request->session()->get('checkout.fulfillment.selected_outlet_id'),
            'payment_method' => $validated['payment_method'],
            'delivery_fee' => $deliveryFee,
            'delivery_distance_km' => $deliveryQuote['distance_km'] ?? 0,
            'recommended_outlet_id' => $deliveryQuote['outlet']['id'] ?? null,
            'payment_fee' => $paymentFee,
            'notes' => $location['delivery_notes'] ?? null,
        ]);

        // Cache order ID for idempotency (60s TTL)
        Cache::put($idempotencyKey, $order->id, 60);
    } catch (StockAdjustedException $e) {
        $warnings = collect($e->adjustments)->map(function ($adj) {
            $variant = ProductVariant::with('family')->find($adj['variant_id']);
            $name = $variant?->family?->name ?? $variant?->name ?? 'Produk';

            if ($adj['adjusted_qty'] <= 0) {
                return "{$name}: stok habis, item dihapus dari pesanan";
            }

            return "{$name}: jumlah dikurangi dari {$adj['original_qty']} ke {$adj['adjusted_qty']} (stok tersisa {$adj['available_stock']})";
        })->toArray();

        $allRemoved = collect($e->adjustments)->every(fn ($adj) => $adj['adjusted_qty'] <= 0);

        return response()->json([
            'adjusted' => true,
            'all_removed' => $allRemoved,
            'adjustments' => $e->adjustments,
            'warnings' => $warnings,
        ], 422);
    } catch (ValidationException $e) {
        return back()->withErrors($e->validator->errors())->withInput();
    } catch (\Exception $e) {
        return back()->withErrors(['error' => 'Terjadi kesalahan saat membuat pesanan. Silakan coba lagi.'])->withInput();
    }

    // ... existing DOKU payment logic ...
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `php artisan test tests/Feature/Customer/CheckoutControllerTest.php`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Customer/CheckoutController.php tests/Feature/Customer/CheckoutControllerTest.php
git commit -m "feat: handle StockAdjustedException in CheckoutController"
```

---

### Task 6: Unify Stock Terminology - Backend

**Files:**
- Modify: `app/Http/Controllers/Customer/CustomerProductApiController.php`
- Modify: `app/Http/Controllers/Owner/OutletProductController.php`
- Test: `tests/Feature/Customer/CustomerProductApiControllerTest.php`

**Interfaces:**
- Produces: Consistent `stock_status` values and `minimum_stock` threshold

- [ ] **Step 1: Write the failing test**

```php
<?php

namespace Tests\Feature\Customer;

use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerProductApiControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_stock_status_uses_minimum_stock_threshold(): void
    {
        $outlet = Outlet::factory()->create();
        $family = ProductFamily::factory()->create();
        $variant = ProductVariant::factory()->create(['product_family_id' => $family->id]);

        // Stock is below minimum_stock (2)
        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 7,
            'minimum_stock' => 5,
        ]);

        $response = $this->getJson("/customer/products/api?outlet_id={$outlet->id}");

        $response->assertOk()
            ->assertJsonPath('families.0.variants.0.stock_status', 'low')
            ->assertJsonPath('families.0.variants.0.available_stock', 3);
    }

    public function test_stock_status_out_of_stock(): void
    {
        $outlet = Outlet::factory()->create();
        $family = ProductFamily::factory()->create();
        $variant = ProductVariant::factory()->create(['product_family_id' => $family->id]);

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 10,
            'minimum_stock' => 5,
        ]);

        $response = $this->getJson("/customer/products/api?outlet_id={$outlet->id}");

        $response->assertOk()
            ->assertJsonPath('families.0.variants.0.stock_status', 'out_of_stock')
            ->assertJsonPath('families.0.variants.0.available_stock', 0);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/Customer/CustomerProductApiControllerTest.php`
Expected: FAIL with old threshold (<= 5)

- [ ] **Step 3: Update CustomerProductApiController**

```php
// In the map callback, change stock status calculation:
$stockStatus = $availableStock <= 0
    ? 'out_of_stock'
    : ($inventory && $availableStock <= ($inventory->minimum_stock ?? 0) ? 'low' : 'available');
```

- [ ] **Step 4: Update OutletProductController labels**

```php
private function getStockStatus(int $available, int $minimum): string
{
    if ($available <= 0) {
        return 'out_of_stock';
    }
    if ($minimum > 0 && $available <= $minimum) {
        return 'low';
    }
    return 'available';
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `php artisan test tests/Feature/Customer/CustomerProductApiControllerTest.php`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/Customer/CustomerProductApiController.php app/Http/Controllers/Owner/OutletProductController.php tests/Feature/Customer/CustomerProductApiControllerTest.php
git commit -m "feat: unify stock terminology - use minimum_stock threshold"
```

---

### Task 7: Unify Stock Terminology - Frontend Helper

**Files:**
- Create: `resources/js/lib/stock.ts`
- Test: `tests/js/lib/stock.test.ts`

**Interfaces:**
- Produces: `getStockLabel()`, `getStockStatusLabel()` functions

- [ ] **Step 1: Write the failing test**

```typescript
// tests/js/lib/stock.test.ts
import { describe, it, expect } from 'vitest';
import { getStockLabel, getStockStatusLabel } from '@/lib/stock';

describe('getStockLabel', () => {
  it('returns empty string for available status', () => {
    expect(getStockLabel('available')).toBe('');
  });

  it('returns "Habis" for out_of_stock', () => {
    expect(getStockLabel('out_of_stock')).toBe('Habis');
  });

  it('returns "Stok Terbatas" for low stock', () => {
    expect(getStockLabel('low')).toBe('Stok Terbatas');
  });

  it('returns "Stok Terbatas (X)" when showQuantity is true', () => {
    expect(getStockLabel('low', 3, true)).toBe('Stok Terbatas (3)');
  });
});

describe('getStockStatusLabel', () => {
  it('returns "Sehat" for available status', () => {
    expect(getStockStatusLabel('available')).toBe('Sehat');
  });

  it('returns "Stok Rendah" for low stock', () => {
    expect(getStockStatusLabel('low')).toBe('Stok Rendah');
  });

  it('returns "Stok Habis" for out_of_stock', () => {
    expect(getStockStatusLabel('out_of_stock')).toBe('Stok Habis');
  });

  it('includes quantity when provided', () => {
    expect(getStockStatusLabel('low', 3)).toBe('Stok Rendah (3)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/js/lib/stock.test.ts`
Expected: FAIL with module not found

- [ ] **Step 3: Write implementation**

```typescript
// resources/js/lib/stock.ts
export type StockStatus = 'available' | 'low' | 'out_of_stock';

/**
 * Get stock label for customer-facing UI
 * @param status - Stock status
 * @param availableStock - Available stock quantity
 * @param showQuantity - Whether to show quantity in parentheses
 */
export function getStockLabel(
  status: StockStatus,
  availableStock?: number,
  showQuantity = false
): string {
  switch (status) {
    case 'out_of_stock':
      return 'Habis';
    case 'low':
      return showQuantity && availableStock !== undefined
        ? `Stok Terbatas (${availableStock})`
        : 'Stok Terbatas';
    default:
      return '';
  }
}

/**
 * Get stock label for owner/outlet UI
 * @param status - Stock status
 * @param availableStock - Available stock quantity
 */
export function getStockStatusLabel(
  status: StockStatus,
  availableStock?: number
): string {
  switch (status) {
    case 'out_of_stock':
      return 'Stok Habis';
    case 'low':
      return availableStock !== undefined
        ? `Stok Rendah (${availableStock})`
        : 'Stok Rendah';
    case 'available':
      return 'Sehat';
    default:
      return '';
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/js/lib/stock.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add resources/js/lib/stock.ts tests/js/lib/stock.test.ts
git commit -m "feat: add stock terminology helper functions"
```

---

### Task 8: Update Frontend Components - Cart Validation

**Files:**
- Modify: `resources/js/components/customer/size-selector-sheet.tsx`
- Modify: `resources/js/pages/customer/product-detail.tsx`

**Interfaces:**
- Consumes: `max_quantity` from API response
- Produces: Disabled "+" button when quantity >= max_quantity

- [ ] **Step 1: Update size-selector-sheet.tsx**

```typescript
// In the component, add state for maxQuantity
const [maxQuantity, setMaxQuantity] = useState<number>(999);

// Update handleAdd to use maxQuantity from response
const handleAdd = async () => {
  // ... existing code ...
  
  const response = await fetch('/customer/cart/add', { ... });
  const data = await response.json();
  
  if (data.item?.max_quantity) {
    setMaxQuantity(data.item.max_quantity);
  }
  
  if (data.warning) {
    // Show warning toast
    toast.warning(data.warning);
  }
  
  // ... rest of code ...
};

// Update the quantity stepper buttons
<button
  onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
  disabled={quantity >= maxQuantity}
  className="..."
>
  +
</button>

// Add max quantity hint
{maxQuantity < 999 && (
  <span className="text-xs text-text-muted">Maks: {maxQuantity}</span>
)}
```

- [ ] **Step 2: Update product-detail.tsx**

Similar changes to size-selector-sheet.tsx - add maxQuantity state and limit stepper.

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/customer/size-selector-sheet.tsx resources/js/pages/customer/product-detail.tsx
git commit -m "feat: limit quantity stepper based on available stock"
```

---

### Task 9: Update Frontend Components - Checkout Validation

**Files:**
- Modify: `resources/js/pages/customer/checkout/payment.tsx`

**Interfaces:**
- Consumes: `validate-stock` endpoint
- Produces: Warning banner, adjustment modal

- [ ] **Step 1: Add validate-stock call on page load**

```typescript
// In checkout/payment.tsx
const [stockWarnings, setStockWarnings] = useState<string[]>([]);
const [adjustmentModal, setAdjustmentModal] = useState<any>(null);

useEffect(() => {
  const validateStock = async () => {
    try {
      const res = await fetch('/customer/checkout/validate-stock');
      const data = await res.json();
      
      if (!data.valid) {
        setStockWarnings(data.warnings);
        
        // Auto-adjust quantities in the UI
        // Update draft items based on data.items
      }
    } catch (err) {
      console.error('Failed to validate stock:', err);
    }
  };
  
  validateStock();
}, []);
```

- [ ] **Step 2: Add warning banner**

```tsx
{stockWarnings.length > 0 && (
  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
    <div className="flex items-center gap-2">
      <AlertTriangle className="h-5 w-5 text-amber-600" />
      <h3 className="font-semibold text-amber-800">Stok Berubah</h3>
    </div>
    <ul className="mt-2 space-y-1 text-sm text-amber-700">
      {stockWarnings.map((warning, i) => (
        <li key={i}>{warning}</li>
      ))}
    </ul>
  </div>
)}
```

- [ ] **Step 3: Add submit handling for 422 response**

```typescript
const handleSubmit = async () => {
  const res = await fetch('/customer/checkout/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_method: selectedPaymentMethod }),
  });
  
  if (res.status === 422) {
    const data = await res.json();
    
    if (data.all_removed) {
      router.visit('/customer/cart', {
        error: 'Semua produk dalam pesanan sudah habis',
      });
      return;
    }
    
    if (data.adjusted) {
      setAdjustmentModal({
        warnings: data.warnings,
        adjustments: data.adjustments,
      });
      return;
    }
  }
  
  if (res.ok) {
    const data = await res.json();
    window.location.href = data.payment_url;
  }
};
```

- [ ] **Step 4: Add adjustment confirmation modal**

```tsx
{adjustmentModal && (
  <Dialog open={!!adjustmentModal} onClose={() => setAdjustmentModal(null)}>
    <h2>Stok Berubah</h2>
    <ul>
      {adjustmentModal.warnings.map((w: string, i: number) => (
        <li key={i}>{w}</li>
      ))}
    </ul>
    <div className="flex gap-2">
      <Button onClick={() => setAdjustmentModal(null)}>Kembali</Button>
      <Button onClick={handleConfirmAdjusted}>Konfirmasi & Bayar</Button>
    </div>
  </Dialog>
)}
```

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/customer/checkout/payment.tsx
git commit -m "feat: add stock validation and adjustment handling to checkout"
```

---

### Task 10: Update Frontend Components - Unified Labels

**Files:**
- Modify: `resources/js/components/ui/stock-level-badge.tsx`
- Modify: `resources/js/components/customer/variant-list-item.tsx`
- Modify: `resources/js/components/owner/outlet-products.tsx`

**Interfaces:**
- Consumes: `getStockLabel()`, `getStockStatusLabel()` from `lib/stock.ts`

- [ ] **Step 1: Update stock-level-badge.tsx**

```typescript
import { getStockStatusLabel, type StockStatus } from '@/lib/stock';

export default function StockLevelBadge({ 
  status, 
  availableStock,
  showQuantity = false 
}: { 
  status: StockStatus;
  availableStock?: number;
  showQuantity?: boolean;
}) {
  const label = getStockStatusLabel(status, showQuantity ? availableStock : undefined);
  
  const styles: Record<StockStatus, string> = {
    available: 'bg-emerald-50 text-emerald-700',
    low: 'bg-amber-50 text-amber-700',
    out_of_stock: 'bg-red-50 text-red-700',
  };
  
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${styles[status]}`}>
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Update variant-list-item.tsx**

```typescript
import { getStockLabel } from '@/lib/stock';

// In the component:
const stockLabel = getStockLabel(
  variant.stock_status as StockStatus,
  variant.available_stock,
  true // show quantity
);

// Use in JSX:
{stockLabel && (
  <span className="stock-badge stock-badge-low">{stockLabel}</span>
)}
```

- [ ] **Step 3: Update outlet-products.tsx**

```typescript
import { getStockStatusLabel } from '@/lib/stock';

// In StockBadge component:
function StockBadge({ status, stock }: { status: string; stock: number }) {
  return (
    <span className="...">
      {getStockStatusLabel(status as StockStatus, stock)}
    </span>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/components/ui/stock-level-badge.tsx resources/js/components/customer/variant-list-item.tsx resources/js/components/owner/outlet-products.tsx
git commit -m "feat: use unified stock labels across all components"
```

---

### Task 11: Integration Test - Race Condition

**Files:**
- Test: `tests/Feature/StockValidationRaceConditionTest.php`

**Interfaces:**
- Tests concurrent checkout scenarios

- [ ] **Step 1: Write the race condition test**

```php
<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class StockValidationRaceConditionTest extends TestCase
{
    use RefreshDatabase;

    public function test_concurrent_checkout_prevents_overselling(): void
    {
        $outlet = Outlet::factory()->create();
        $variant = ProductVariant::factory()->create();

        // Stock = 3
        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 3,
            'reserved_stock' => 0,
            'minimum_stock' => 1,
        ]);

        $userA = User::factory()->create(['role' => 'customer']);
        $customerA = Customer::factory()->create(['user_id' => $userA->id]);

        $userB = User::factory()->create(['role' => 'customer']);
        $customerB = Customer::factory()->create(['user_id' => $userB->id]);

        // Customer A tries to buy 3
        $responseA = $this->actingAs($userA)
            ->withSession([
                'cart' => [['product_variant_id' => $variant->id, 'quantity' => 3]],
                'checkout.fulfillment' => ['fulfillment_type' => 'pickup', 'selected_outlet_id' => $outlet->id],
                'checkout.customer' => ['customer_name' => 'Customer A', 'phone_number' => '6281111111111'],
            ])
            ->postJson('/customer/checkout/submit', ['payment_method' => 'qris']);

        // Customer B tries to buy 3 at the same time
        $responseB = $this->actingAs($userB)
            ->withSession([
                'cart' => [['product_variant_id' => $variant->id, 'quantity' => 3]],
                'checkout.fulfillment' => ['fulfillment_type' => 'pickup', 'selected_outlet_id' => $outlet->id],
                'checkout.customer' => ['customer_name' => 'Customer B', 'phone_number' => '6282222222222'],
            ])
            ->postJson('/customer/checkout/submit', ['payment_method' => 'qris']);

        // One should succeed, one should get adjustment
        $successCount = 0;
        $adjustCount = 0;

        if ($responseA->status() === 200 || $responseA->status() === 302) {
            $successCount++;
        }
        if ($responseA->status() === 422) {
            $adjustCount++;
        }
        if ($responseB->status() === 200 || $responseB->status() === 302) {
            $successCount++;
        }
        if ($responseB->status() === 422) {
            $adjustCount++;
        }

        $this->assertEquals(1, $successCount, 'Exactly one checkout should succeed');
        $this->assertEquals(1, $adjustCount, 'Exactly one checkout should get adjustment');

        // Verify no overselling
        $inventory = OutletInventory::where('outlet_id', $outlet->id)
            ->where('product_variant_id', $variant->id)
            ->first();

        $this->assertGreaterThanOrEqual(0, $inventory->current_stock - $inventory->reserved_stock);
    }
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `php artisan test tests/Feature/StockValidationRaceConditionTest.php`
Expected: PASS (lockForUpdate prevents overselling)

- [ ] **Step 3: Commit**

```bash
git add tests/Feature/StockValidationRaceConditionTest.php
git commit -m "test: add race condition test for stock validation"
```

---

### Task 12: Final Integration & E2E Test

**Files:**
- Test: `tests/Feature/StockValidationE2ETest.php`

- [ ] **Step 1: Write E2E test**

```php
<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\ProductFamily;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StockValidationE2ETest extends TestCase
{
    use RefreshDatabase;

    public function test_full_stock_validation_flow(): void
    {
        // Setup
        $user = User::factory()->create(['role' => 'customer']);
        $customer = Customer::factory()->create(['user_id' => $user->id]);
        $outlet = Outlet::factory()->create();
        $family = ProductFamily::factory()->create();
        $variant = ProductVariant::factory()->create(['product_family_id' => $family->id]);

        OutletInventory::factory()->create([
            'outlet_id' => $outlet->id,
            'product_variant_id' => $variant->id,
            'current_stock' => 10,
            'reserved_stock' => 5,
            'minimum_stock' => 3,
        ]);

        // Step 1: Add to cart - should auto-adjust
        $response = $this->actingAs($user)
            ->postJson('/customer/cart/add', [
                'product_variant_id' => $variant->id,
                'quantity' => 8,
            ]);

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'item' => [
                    'quantity' => 5,
                    'available_stock' => 5,
                    'max_quantity' => 5,
                ],
                'warning' => 'Jumlah dikurangi dari 8 ke 5 (stok tersisa 5)',
            ]);

        // Step 2: Validate stock at checkout
        $response = $this->actingAs($user)
            ->withSession(['cart' => [['product_variant_id' => $variant->id, 'quantity' => 5]]])
            ->getJson('/customer/checkout/validate-stock');

        $response->assertOk()
            ->assertJson(['valid' => true]);

        // Step 3: Stock reduced before submit
        $inventory = OutletInventory::where('outlet_id', $outlet->id)
            ->where('product_variant_id', $variant->id)
            ->first();
        $inventory->update(['reserved_stock' => 8]); // Now only 2 available

        // Step 4: Submit - should get adjustment
        $response = $this->actingAs($user)
            ->withSession([
                'cart' => [['product_variant_id' => $variant->id, 'quantity' => 5]],
                'checkout.fulfillment' => ['fulfillment_type' => 'pickup', 'selected_outlet_id' => $outlet->id],
                'checkout.customer' => ['customer_name' => 'Test', 'phone_number' => '6281234567890'],
            ])
            ->postJson('/customer/checkout/submit', ['payment_method' => 'qris']);

        $response->assertStatus(422)
            ->assertJson(['adjusted' => true])
            ->assertJsonStructure(['adjustments', 'warnings']);
    }
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `php artisan test tests/Feature/StockValidationE2ETest.php`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/Feature/StockValidationE2ETest.php
git commit -m "test: add E2E test for stock validation flow"
```

---

## Summary

| Task | Description | Files Modified |
|------|-------------|----------------|
| 1 | StockAdjustedException | 1 new |
| 2 | CartController stock info | 1 modified |
| 3 | validate-stock endpoint | 1 modified |
| 4 | OrderService auto-adjust | 1 modified |
| 5 | CheckoutController handling | 1 modified |
| 6 | Backend terminology | 2 modified |
| 7 | Frontend helper | 1 new |
| 8 | Cart validation UI | 2 modified |
| 9 | Checkout validation UI | 1 modified |
| 10 | Unified labels UI | 3 modified |
| 11 | Race condition test | 1 new |
| 12 | E2E test | 1 new |

**Total:** 6 new files, 11 modified files, 12 tasks
