# Launch Delivery Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Dombi and external courier flows safe enough for a one-outlet, online-payment-only production launch.

**Architecture:** Keep the existing `DeliveryService` as the transaction boundary and add explicit assignment guards plus a separate external-courier transition method. Reuse the current delivery/order state machines, delivery tiers, history tables, and outlet pages; do not introduce courier APIs, GPS, routing, COD, or automatic assignment.

**Tech Stack:** Laravel 13, PHP 8.3, MySQL 8, PHPUnit 12, React 19, TypeScript, Inertia.js.

## Global Constraints

- One active outlet for the first launch.
- Pickup and delivery are both supported.
- Dombi and Gojek/Grab couriers are selected manually by the outlet.
- Payment is online-only; unpaid orders cannot be assigned or dispatched.
- Customer delivery fee is fixed by configured zone/radius.
- Actual external courier cost is independent from the paid customer amount.
- No GPS, route optimization, dynamic courier pricing, courier API, or COD.
- All status changes must record actor and time.
- Every implementation task follows red-green-refactor and ends in a focused commit.

## Existing Components to Preserve

- `app/Services/DeliveryPricingService.php`: server-side distance and tier quote.
- `app/Models/DeliveryTier.php`: configured radius tiers.
- `app/Services/DeliveryService.php`: assignment and lifecycle transaction boundary.
- `app/Models/Delivery.php`: delivery persistence and relations.
- `app/Http/Requests/AssignCourierRequest.php`: assignment input validation.
- `app/Http/Controllers/Outlet/OrderController.php`: outlet assignment endpoint.
- `app/Http/Controllers/Outlet/DeliveryController.php`: outlet delivery workspace.
- `app/Http/Controllers/Courier/DeliveryController.php`: Dombi courier actions.
- `resources/js/components/outlet/assign-courier-sheet.tsx`: assignment UI.

---

### Task 1: Enforce Paid Delivery Assignment

**Files:**

- Modify: `app/Services/DeliveryService.php`
- Test: `tests/Feature/DeliveryAssignmentLaunchGuardTest.php`

**Interfaces:**

- Consumes: `DeliveryService::assignCourier(Order, ?User, User, ...)`
- Produces: a server-side invariant that only paid delivery orders in
  `ready_for_pickup` can be assigned.

- [ ] **Step 1: Write the failing assignment guard tests**

```php
<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use App\Services\DeliveryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class DeliveryAssignmentLaunchGuardTest extends TestCase
{
    use RefreshDatabase;

    public function test_unpaid_order_cannot_be_assigned_to_dombi_courier(): void
    {
        [$order, $operator, $courier] = $this->context('pending');

        $this->expectException(ValidationException::class);

        app(DeliveryService::class)->assignCourier($order, $courier, $operator);
    }

    public function test_unpaid_order_cannot_be_assigned_to_external_courier(): void
    {
        [$order, $operator] = $this->context('pending');

        $this->expectException(ValidationException::class);

        app(DeliveryService::class)->assignCourier(
            order: $order,
            courier: null,
            assignedBy: $operator,
            courierType: 'eksternal',
            externalName: 'Budi',
            courierCost: 15000,
        );
    }

    public function test_paid_delivery_order_can_be_assigned(): void
    {
        [$order, $operator, $courier] = $this->context('paid');

        $delivery = app(DeliveryService::class)
            ->assignCourier($order, $courier, $operator);

        $this->assertSame('waiting_pickup', $delivery->status);
    }

    private function context(string $paymentStatus): array
    {
        $outlet = Outlet::factory()->create();
        $operator = User::factory()->create([
            'role' => 'outlet',
            'outlet_id' => $outlet->id,
        ]);
        $courier = User::factory()->create([
            'role' => 'courier',
            'is_active' => true,
            'is_online' => true,
        ]);
        $order = Order::factory()->create([
            'outlet_id' => $outlet->id,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'payment_status' => $paymentStatus,
        ]);

        return [$order, $operator, $courier];
    }
}
```

- [ ] **Step 2: Run the tests and verify the unpaid cases fail**

Run:

```bash
php artisan test tests/Feature/DeliveryAssignmentLaunchGuardTest.php
```

Expected: the unpaid cases fail because assignment currently ignores
`payment_status`.

- [ ] **Step 3: Add one shared guard before choosing courier type**

Add to the start of `DeliveryService::assignCourier()`:

```php
if (! $order->isDelivery()) {
    throw ValidationException::withMessages([
        'fulfillment_type' => 'Pesanan pickup tidak memerlukan kurir.',
    ]);
}

if ($order->payment_status !== 'paid') {
    throw ValidationException::withMessages([
        'payment_status' => 'Pesanan harus sudah dibayar sebelum kurir dipilih.',
    ]);
}
```

Remove the later duplicate pickup check. Keep the locked order checks inside each
transaction and repeat the payment check after `lockForUpdate()` so a stale model
cannot bypass the invariant:

```php
if ($order->payment_status !== 'paid') {
    throw ValidationException::withMessages([
        'payment_status' => 'Pesanan harus sudah dibayar sebelum kurir dipilih.',
    ]);
}
```

- [ ] **Step 4: Run focused and existing delivery safety tests**

Run:

```bash
php artisan test tests/Feature/DeliveryAssignmentLaunchGuardTest.php tests/Feature/DeliverySafetyTest.php tests/Feature/DeliveryExternalCourierTest.php
```

Expected: PASS. Existing fixtures that omitted `payment_status` must be corrected
to explicitly create paid orders; do not weaken the guard.

- [ ] **Step 5: Commit**

```bash
git add app/Services/DeliveryService.php tests/Feature/DeliveryAssignmentLaunchGuardTest.php tests/Feature/DeliverySafetyTest.php tests/Feature/DeliveryExternalCourierTest.php
git commit -m "fix: require paid orders before courier assignment"
```

---

### Task 2: Enforce Outlet-to-Courier Eligibility

**Files:**

- Modify: `app/Services/DeliveryService.php`
- Modify: `app/Http/Controllers/Outlet/CourierController.php`
- Test: `tests/Feature/DeliveryCourierEligibilityTest.php`

**Interfaces:**

- Consumes: `CourierProfile::scopeAvailableForOutlet($query, int $outletId)`
- Produces: `DeliveryService::assertCourierAvailableForOutlet(User $courier, int $outletId): void`
- Produces: outlet courier search containing only accepted couriers available to
  that outlet.

- [ ] **Step 1: Write failing cross-outlet and accepted-courier tests**

```php
<?php

namespace Tests\Feature;

use App\Models\CourierProfile;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use App\Services\DeliveryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class DeliveryCourierEligibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_outlet_cannot_assign_courier_from_another_outlet(): void
    {
        $firstOutlet = Outlet::factory()->create();
        $secondOutlet = Outlet::factory()->create();
        $operator = User::factory()->create([
            'role' => 'outlet',
            'outlet_id' => $firstOutlet->id,
        ]);
        $courier = User::factory()->create([
            'role' => 'courier',
            'is_active' => true,
            'is_online' => true,
        ]);
        CourierProfile::create([
            'user_id' => $courier->id,
            'courier_source' => 'outlet',
            'outlet_id' => $secondOutlet->id,
            'invitation_status' => 'accepted',
        ]);
        $order = Order::factory()->create([
            'outlet_id' => $firstOutlet->id,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'payment_status' => 'paid',
        ]);

        $this->expectException(ValidationException::class);

        app(DeliveryService::class)->assignCourier($order, $courier, $operator);
    }

    public function test_outlet_can_assign_accepted_courier_for_its_outlet(): void
    {
        $outlet = Outlet::factory()->create();
        $operator = User::factory()->create([
            'role' => 'outlet',
            'outlet_id' => $outlet->id,
        ]);
        $courier = User::factory()->create([
            'role' => 'courier',
            'is_active' => true,
            'is_online' => true,
        ]);
        CourierProfile::create([
            'user_id' => $courier->id,
            'courier_source' => 'outlet',
            'outlet_id' => $outlet->id,
            'invitation_status' => 'accepted',
        ]);
        $order = Order::factory()->create([
            'outlet_id' => $outlet->id,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'payment_status' => 'paid',
        ]);

        $delivery = app(DeliveryService::class)
            ->assignCourier($order, $courier, $operator);

        $this->assertSame($courier->id, $delivery->courier_id);
    }
}
```

- [ ] **Step 2: Run the tests and verify the cross-outlet case fails**

Run:

```bash
php artisan test tests/Feature/DeliveryCourierEligibilityTest.php
```

Expected: cross-outlet assignment is currently accepted, so the first test fails.

- [ ] **Step 3: Add the service-level eligibility guard**

Add to `DeliveryService`:

```php
private function assertCourierAvailableForOutlet(User $courier, int $outletId): void
{
    $available = \App\Models\CourierProfile::query()
        ->availableForOutlet($outletId)
        ->where('user_id', $courier->id)
        ->exists();

    if (! $available) {
        throw ValidationException::withMessages([
            'courier_id' => 'Kurir tidak tersedia untuk outlet pesanan ini.',
        ]);
    }
}
```

Call it inside the locked internal assignment transaction after verifying the user
is an active courier:

```php
$this->assertCourierAvailableForOutlet($courier, $order->outlet_id);
```

- [ ] **Step 4: Filter the outlet courier endpoint by outlet eligibility**

In `Outlet\CourierController::nearestCouriers()`, authorize the current outlet from
the request rather than trusting the route parameter, then intersect the location
results with accepted profiles:

```php
public function nearestCouriers(Request $request, Outlet $outlet): JsonResponse
{
    abort_unless($request->user()?->outlet?->id === $outlet->id, 403);

    $eligibleIds = CourierProfile::query()
        ->availableForOutlet($outlet->id)
        ->pluck('user_id');

    $couriers = $this->locationService
        ->getNearestCouriers((float) $outlet->latitude, (float) $outlet->longitude)
        ->whereIn('id', $eligibleIds);

    $result = $couriers->map(fn ($courier) => [
        'id' => $courier->id,
        'name' => $courier->name,
        'phone' => $courier->phone,
        'vehicle_type' => $courier->vehicle_type,
        'vehicle_plate' => $courier->vehicle_plate,
        'photo' => $courier->photo,
        'distance' => round($courier->distance, 2),
        'active_delivery_count' => $courier->activeDeliveryCount(),
    ]);

    return response()->json($result);
}
```

Add imports for `Request` and `CourierProfile`.

- [ ] **Step 5: Run focused tests**

Run:

```bash
php artisan test tests/Feature/DeliveryCourierEligibilityTest.php tests/Feature/OwnerCourierManagementTest.php tests/Feature/CourierLocationTrackingTest.php
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/Services/DeliveryService.php app/Http/Controllers/Outlet/CourierController.php tests/Feature/DeliveryCourierEligibilityTest.php
git commit -m "fix: restrict courier assignment to eligible outlet couriers"
```

---

### Task 3: Persist External Provider and Reference

**Files:**

- Create: `database/migrations/2026_07_27_000001_add_provider_fields_to_deliveries.php`
- Modify: `app/Models/Delivery.php`
- Modify: `app/Http/Requests/AssignCourierRequest.php`
- Modify: `app/Http/Controllers/Outlet/OrderController.php`
- Modify: `app/Http/Controllers/Owner/DeliveryController.php`
- Modify: `app/Services/DeliveryService.php`
- Test: `tests/Feature/DeliveryExternalCourierTest.php`

**Interfaces:**

- Produces columns `external_provider` and `external_reference`.
- Changes `DeliveryService::assignCourier()` named parameters to include
  `?string $externalProvider` and `?string $externalReference`.

- [ ] **Step 1: Replace the external assignment happy-path test**

Update the payload and assertions:

```php
$response = $this->actingAs($this->outletStaff)
    ->post("/outlet/orders/{$this->order->id}/assign-courier", [
        'courier_type' => 'eksternal',
        'external_provider' => 'gojek',
        'external_courier_name' => 'Budi',
        'external_courier_phone' => '081111111',
        'external_plate_number' => 'H 1234 AB',
        'external_reference' => 'GK-123456',
        'courier_cost' => 25000,
    ]);

$delivery = Delivery::where('order_id', $this->order->id)->firstOrFail();
$this->assertSame('gojek', $delivery->external_provider);
$this->assertSame('Budi', $delivery->external_courier_name);
$this->assertSame('GK-123456', $delivery->external_reference);
$this->assertSame(25000.0, (float) $delivery->courier_cost);
$this->assertSame(65000.0, (float) $this->order->fresh()->total);
```

Also make the setup order explicitly paid:

```php
'payment_status' => 'paid',
```

- [ ] **Step 2: Run the test and verify missing columns/validation fail**

Run:

```bash
php artisan test tests/Feature/DeliveryExternalCourierTest.php
```

Expected: FAIL because provider/reference are not persisted.

- [ ] **Step 3: Add the migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deliveries', function (Blueprint $table): void {
            $table->string('external_provider', 20)
                ->nullable()
                ->after('courier_type');
            $table->string('external_reference', 100)
                ->nullable()
                ->after('external_plate_number');
        });
    }

    public function down(): void
    {
        Schema::table('deliveries', function (Blueprint $table): void {
            $table->dropColumn(['external_provider', 'external_reference']);
        });
    }
};
```

- [ ] **Step 4: Add model fillable fields**

Add to `Delivery::$fillable`:

```php
'external_provider',
'external_reference',
```

- [ ] **Step 5: Add request validation**

Add to `AssignCourierRequest::rules()`:

```php
'external_provider' => [
    'required_if:courier_type,eksternal',
    Rule::in(['gojek', 'grab']),
],
'external_reference' => ['nullable', 'string', 'max:100'],
```

- [ ] **Step 6: Thread the two named parameters through controllers and service**

Add to both assignment controller calls:

```php
externalProvider: $request->validated('external_provider'),
externalReference: $request->validated('external_reference'),
```

Add nullable parameters to `DeliveryService::assignCourier()` and
`assignEksternal()`, then persist:

```php
'external_provider' => $externalProvider,
'external_reference' => $externalReference,
```

- [ ] **Step 7: Run migration and focused tests**

Run:

```bash
php artisan migrate
php artisan test tests/Feature/DeliveryExternalCourierTest.php tests/Feature/SettlementCourierCostTest.php
```

Expected: PASS. The order total remains unchanged when external cost is saved.

- [ ] **Step 8: Commit**

```bash
git add database/migrations/2026_07_27_000001_add_provider_fields_to_deliveries.php app/Models/Delivery.php app/Http/Requests/AssignCourierRequest.php app/Http/Controllers/Outlet/OrderController.php app/Http/Controllers/Owner/DeliveryController.php app/Services/DeliveryService.php tests/Feature/DeliveryExternalCourierTest.php
git commit -m "feat: record external courier provider and reference"
```

---

### Task 4: Give External Deliveries a Real Lifecycle

**Files:**

- Create: `app/Http/Requests/Outlet/UpdateExternalDeliveryRequest.php`
- Modify: `app/Services/DeliveryService.php`
- Modify: `app/Http/Controllers/Outlet/DeliveryController.php`
- Modify: `routes/web.php`
- Test: `tests/Feature/ExternalDeliveryLifecycleTest.php`

**Interfaces:**

- Produces:
  `DeliveryService::transitionExternal(Delivery $delivery, User $operator, string $targetStatus, ?string $reason = null): Delivery`
- Produces route:
  `POST /outlet/deliveries/{delivery}/status`
- Allowed external transitions:
  `waiting_pickup → picked_up → delivering → completed|failed`, followed by
  `failed → returned_to_outlet`.

- [ ] **Step 1: Write failing lifecycle and authorization tests**

```php
<?php

namespace Tests\Feature;

use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExternalDeliveryLifecycleTest extends TestCase
{
    use RefreshDatabase;

    public function test_external_assignment_starts_waiting_for_pickup(): void
    {
        [$operator, $order] = $this->context();

        $this->actingAs($operator)->post(
            "/outlet/orders/{$order->id}/assign-courier",
            $this->externalPayload()
        )->assertRedirect();

        $delivery = Delivery::where('order_id', $order->id)->firstOrFail();

        $this->assertSame('waiting_pickup', $delivery->status);
        $this->assertSame(Order::STATUS_READY_FOR_PICKUP, $order->fresh()->status);
    }

    public function test_outlet_operator_can_complete_external_lifecycle(): void
    {
        [$operator, $order] = $this->context();
        $this->actingAs($operator)->post(
            "/outlet/orders/{$order->id}/assign-courier",
            $this->externalPayload()
        );
        $delivery = Delivery::where('order_id', $order->id)->firstOrFail();

        foreach (['picked_up', 'delivering', 'completed'] as $status) {
            $this->actingAs($operator)
                ->post("/outlet/deliveries/{$delivery->id}/status", ['status' => $status])
                ->assertRedirect();
        }

        $this->assertSame('completed', $delivery->fresh()->status);
        $this->assertSame(Order::STATUS_COMPLETED, $order->fresh()->status);
    }

    public function test_external_failure_requires_reason(): void
    {
        [$operator, $order] = $this->context();
        $this->actingAs($operator)->post(
            "/outlet/orders/{$order->id}/assign-courier",
            $this->externalPayload()
        );
        $delivery = Delivery::where('order_id', $order->id)->firstOrFail();
        $delivery->update(['status' => 'delivering']);
        $order->update(['status' => Order::STATUS_DELIVERING]);

        $this->actingAs($operator)
            ->post("/outlet/deliveries/{$delivery->id}/status", ['status' => 'failed'])
            ->assertSessionHasErrors('reason');
    }

    public function test_failed_external_delivery_can_be_returned_to_outlet(): void
    {
        [$operator, $order] = $this->context();
        $this->actingAs($operator)->post(
            "/outlet/orders/{$order->id}/assign-courier",
            $this->externalPayload()
        );
        $delivery = Delivery::where('order_id', $order->id)->firstOrFail();
        $delivery->update(['status' => 'failed', 'failed_reason' => 'Alamat tidak ditemukan']);
        $order->update(['status' => Order::STATUS_FAILED_DELIVERY]);

        $this->actingAs($operator)->post(
            "/outlet/deliveries/{$delivery->id}/status",
            [
                'status' => 'returned_to_outlet',
                'reason' => 'Barang sudah kembali dan diterima outlet.',
            ],
        )->assertRedirect();

        $this->assertSame('returned_to_outlet', $delivery->fresh()->status);
        $this->assertSame(Order::STATUS_PREPARING, $order->fresh()->status);
    }

    public function test_other_outlet_cannot_mutate_external_delivery(): void
    {
        [$operator, $order] = $this->context();
        $this->actingAs($operator)->post(
            "/outlet/orders/{$order->id}/assign-courier",
            $this->externalPayload()
        );
        $delivery = Delivery::where('order_id', $order->id)->firstOrFail();
        $other = User::factory()->create([
            'role' => 'outlet',
            'outlet_id' => Outlet::factory()->create()->id,
        ]);

        $this->actingAs($other)
            ->post("/outlet/deliveries/{$delivery->id}/status", ['status' => 'picked_up'])
            ->assertForbidden();
    }

    private function context(): array
    {
        $outlet = Outlet::factory()->create();
        $operator = User::factory()->create([
            'role' => 'outlet',
            'outlet_id' => $outlet->id,
        ]);
        $order = Order::factory()->create([
            'outlet_id' => $outlet->id,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'payment_status' => 'paid',
        ]);

        return [$operator, $order];
    }

    private function externalPayload(): array
    {
        return [
            'courier_type' => 'eksternal',
            'external_provider' => 'gojek',
            'external_courier_name' => 'Budi',
            'courier_cost' => 15000,
        ];
    }
}
```

- [ ] **Step 2: Run the test and verify route/lifecycle failures**

Run:

```bash
php artisan test tests/Feature/ExternalDeliveryLifecycleTest.php
```

Expected: FAIL because external assignment currently starts at `delivering` and the
outlet transition route does not exist.

- [ ] **Step 3: Make external assignment start at waiting pickup**

In `assignEksternal()` persist:

```php
'status' => 'waiting_pickup',
```

Remove the immediate order transition to `delivering`. Record the history as:

```php
$this->recordHistory(
    $delivery,
    null,
    'waiting_pickup',
    $actor,
    'outlet',
    'Kurir eksternal dipilih manual.',
);
```

- [ ] **Step 4: Create the request**

```php
<?php

namespace App\Http\Requests\Outlet;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateExternalDeliveryRequest extends FormRequest
{
    public function authorize(): bool
    {
        $delivery = $this->route('delivery');
        $outlet = $this->user()?->outlet;

        return $this->user()?->isOutlet()
            && $delivery?->courier_type === 'eksternal'
            && $outlet?->id === $delivery?->order?->outlet_id;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in([
                'picked_up',
                'delivering',
                'completed',
                'failed',
                'returned_to_outlet',
            ])],
            'reason' => [
                'nullable',
                'string',
                'max:1000',
                Rule::requiredIf(fn () => in_array(
                    $this->input('status'),
                    ['failed', 'returned_to_outlet'],
                    true,
                )),
            ],
        ];
    }
}
```

- [ ] **Step 5: Add the service transition**

Add:

```php
public function transitionExternal(
    Delivery $delivery,
    User $operator,
    string $targetStatus,
    ?string $reason = null,
): Delivery {
    return DB::transaction(function () use ($delivery, $operator, $targetStatus, $reason): Delivery {
        $delivery = Delivery::query()
            ->lockForUpdate()
            ->with('order')
            ->findOrFail($delivery->id);

        if ($delivery->courier_type !== 'eksternal'
            || $operator->outlet?->id !== $delivery->order->outlet_id) {
            abort(403);
        }

        if ($targetStatus === 'returned_to_outlet') {
            if ($delivery->status !== 'failed') {
                throw ValidationException::withMessages([
                    'status' => 'Hanya delivery gagal yang dapat dikembalikan ke outlet.',
                ]);
            }

            return $this->resolveFailedDelivery(
                $delivery,
                $operator,
                'returned_to_outlet',
                $reason,
            );
        }

        $allowed = [
            'waiting_pickup' => ['picked_up'],
            'picked_up' => ['delivering'],
            'delivering' => ['completed', 'failed'],
        ];

        if (! in_array($targetStatus, $allowed[$delivery->status] ?? [], true)) {
            throw ValidationException::withMessages([
                'status' => "Delivery tidak bisa diubah dari {$delivery->status} ke {$targetStatus}.",
            ]);
        }

        if ($targetStatus === 'failed' && blank($reason)) {
            throw ValidationException::withMessages([
                'reason' => 'Alasan kegagalan wajib diisi.',
            ]);
        }

        $from = $delivery->status;
        $attributes = ['status' => $targetStatus];
        if ($targetStatus === 'picked_up') {
            $attributes['pickup_time'] = now();
        }
        if ($targetStatus === 'completed') {
            $attributes['delivered_time'] = now();
        }
        if ($targetStatus === 'failed') {
            $attributes['failed_reason'] = $reason;
        }

        $delivery->update($attributes);

        $orderStatus = match ($targetStatus) {
            'picked_up' => Order::STATUS_PICKED_UP,
            'delivering' => Order::STATUS_DELIVERING,
            'completed' => Order::STATUS_COMPLETED,
            'failed' => Order::STATUS_FAILED_DELIVERY,
        };
        $this->orderStatusService->updateStatus(
            $delivery->order,
            $orderStatus,
            $operator,
            $reason,
        );
        $this->recordHistory(
            $delivery,
            $from,
            $targetStatus,
            $operator,
            'outlet',
            $reason,
        );

        return $delivery->fresh(['order', 'statusHistories']);
    });
}
```

The exact constants already defined in `app/Models/Order.php` are
`STATUS_PICKED_UP`, `STATUS_DELIVERING`, `STATUS_COMPLETED`, and
`STATUS_FAILED_DELIVERY`.

- [ ] **Step 6: Add controller action and route**

Controller:

```php
public function updateExternalStatus(
    UpdateExternalDeliveryRequest $request,
    Delivery $delivery,
    DeliveryService $deliveryService,
): RedirectResponse {
    $deliveryService->transitionExternal(
        $delivery,
        $request->user(),
        $request->validated('status'),
        $request->validated('reason'),
    );

    return redirect()
        ->route('outlet.deliveries.show', $delivery)
        ->with('success', 'Status pengiriman eksternal diperbarui.');
}
```

Route inside the existing outlet group:

```php
Route::post('/deliveries/{delivery}/status', [OutletDeliveryController::class, 'updateExternalStatus'])
    ->name('deliveries.status');
```

- [ ] **Step 7: Run lifecycle and regression tests**

Run:

```bash
php artisan test tests/Feature/ExternalDeliveryLifecycleTest.php tests/Feature/DeliveryExternalCourierTest.php tests/Feature/DeliveryStatusHistoryTest.php tests/Feature/DeliverySafetyTest.php
```

Expected: PASS. Delete the old test technique that assigns a fake internal courier
ID to an external delivery.

- [ ] **Step 8: Commit**

```bash
git add app/Http/Requests/Outlet/UpdateExternalDeliveryRequest.php app/Services/DeliveryService.php app/Http/Controllers/Outlet/DeliveryController.php routes/web.php tests/Feature/ExternalDeliveryLifecycleTest.php tests/Feature/DeliveryExternalCourierTest.php
git commit -m "feat: add operator-controlled external delivery lifecycle"
```

---

### Task 5: Update Assignment and External Lifecycle UI

**Files:**

- Modify: `resources/js/components/outlet/assign-courier-sheet.tsx`
- Modify: `resources/js/pages/outlet/deliveries/show.tsx`
- Modify: `app/Http/Controllers/Outlet/DeliveryController.php`
- Create: `resources/js/lib/external-courier.ts`
- Test: `tests/js/lib/external-courier.test.ts`
- Test: `tests/Feature/ExternalDeliveryLifecycleTest.php`

**Interfaces:**

- Consumes: `external_provider`, `external_reference`, `courier_type`, and the
  `outlet.deliveries.status` endpoint from Tasks 3–4.
- Produces: manual Gojek/Grab assignment and status controls visible only for
  external deliveries.

- [ ] **Step 1: Add backend payload assertions**

Extend the outlet delivery show test:

```php
$response->assertInertia(fn ($page) => $page
    ->where('delivery.courier_type', 'eksternal')
    ->where('delivery.external_provider', 'gojek')
    ->where('delivery.external_reference', 'GK-123456')
    ->where('delivery.courier_cost', 15000)
);
```

- [ ] **Step 2: Run the feature test and verify payload fields are missing**

Run:

```bash
php artisan test tests/Feature/ExternalDeliveryLifecycleTest.php
```

Expected: FAIL on missing Inertia properties.

- [ ] **Step 3: Expose external delivery fields from the controller**

Add to the delivery payload:

```php
'courier_type' => $delivery->courier_type,
'external_provider' => $delivery->external_provider,
'external_reference' => $delivery->external_reference,
'external_courier_name' => $delivery->external_courier_name,
'external_courier_phone' => $delivery->external_courier_phone,
'external_plate_number' => $delivery->external_plate_number,
'courier_cost' => (float) $delivery->courier_cost,
```

- [ ] **Step 4: Add a pure external assignment payload builder**

Create:

```ts
export interface ExternalCourierInput {
    provider: 'gojek' | 'grab';
    reference: string;
    name: string;
    phone: string;
    plate: string;
    cost: string;
}

export function buildExternalCourierPayload(input: ExternalCourierInput) {
    return {
        courier_type: 'eksternal' as const,
        external_provider: input.provider,
        external_reference: input.reference.trim() || null,
        external_courier_name: input.name.trim(),
        external_courier_phone: input.phone.trim() || null,
        external_plate_number: input.plate.trim() || null,
        courier_cost: input.cost,
    };
}
```

- [ ] **Step 5: Add provider and reference to the assignment form state**

Use:

```tsx
const [externalProvider, setExternalProvider] =
    useState<'gojek' | 'grab'>('gojek');
const [externalReference, setExternalReference] = useState('');
```

Send the result of:

```tsx
buildExternalCourierPayload({
    provider: externalProvider,
    reference: externalReference,
    name: externalName,
    phone: externalPhone,
    plate: externalPlate,
    cost: courierCost,
})
```

Render a required Gojek/Grab selector, optional driver identity/reference fields,
actual cost, and the existing margin preview. Label cost explicitly as internal:
`Biaya aktual kurir—tidak mengubah tagihan customer`.

- [ ] **Step 6: Render explicit external lifecycle actions**

On `outlet/deliveries/show.tsx`, render actions only when
`delivery.courier_type === 'eksternal'`:

```tsx
const nextExternalActions: Record<string, Array<{
    status: string;
    label: string;
    destructive?: boolean;
}>> = {
    waiting_pickup: [{ status: 'picked_up', label: 'Kurir sudah mengambil' }],
    picked_up: [{ status: 'delivering', label: 'Mulai pengiriman' }],
    delivering: [
        { status: 'completed', label: 'Pesanan diterima' },
        { status: 'failed', label: 'Pengiriman gagal', destructive: true },
    ],
    failed: [
        {
            status: 'returned_to_outlet',
            label: 'Konfirmasi kembali ke outlet',
        },
    ],
};
```

Post actions to `/outlet/deliveries/${delivery.id}/status`. Require a reason
textarea before posting `failed` or `returned_to_outlet`. Do not expose these
controls for Dombi courier deliveries.

- [ ] **Step 7: Test the pure external payload builder**

Create:

```ts
import { describe, expect, it } from 'vitest';
import { buildExternalCourierPayload } from '@/lib/external-courier';

describe('buildExternalCourierPayload', () => {
    it('keeps provider, reference, identity, and actual cost separate', () => {
        expect(buildExternalCourierPayload({
            provider: 'grab',
            reference: ' GR-9988 ',
            name: ' Budi ',
            phone: '',
            plate: ' H 1234 AB ',
            cost: '18000',
        })).toEqual({
            courier_type: 'eksternal',
            external_provider: 'grab',
            external_reference: 'GR-9988',
            external_courier_name: 'Budi',
            external_courier_phone: null,
            external_plate_number: 'H 1234 AB',
            courier_cost: '18000',
        });
    });
});
```

- [ ] **Step 8: Run frontend and feature checks**

Run:

```bash
npm test
npm run types:check
npm run lint:check
php artisan test tests/Feature/ExternalDeliveryLifecycleTest.php tests/Feature/DeliveryExternalCourierTest.php
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add resources/js/components/outlet/assign-courier-sheet.tsx resources/js/pages/outlet/deliveries/show.tsx resources/js/lib/external-courier.ts app/Http/Controllers/Outlet/DeliveryController.php tests/js/lib/external-courier.test.ts tests/Feature/ExternalDeliveryLifecycleTest.php
git commit -m "feat: add manual external delivery controls"
```

---

### Task 6: Harden Delivery Tier Configuration

**Files:**

- Modify: `app/Http/Requests/Owner/StoreDeliveryTierRequest.php`
- Modify: `app/Services/DeliveryPricingService.php`
- Test: `tests/Feature/DeliveryTierTest.php`
- Test: `tests/Feature/DeliveryPricingTest.php`

**Interfaces:**

- Consumes: active `DeliveryTier` records.
- Produces: non-overlapping configured zones and a quote that respects both
  `min_km` and `max_km`.

- [ ] **Step 1: Write failing overlap and lower-bound tests**

Add:

```php
public function test_active_delivery_tiers_cannot_overlap(): void
{
    DeliveryTier::create([
        'min_km' => 0,
        'max_km' => 5,
        'fee' => 10000,
        'is_active' => true,
        'sort_order' => 1,
    ]);

    $this->actingAs($this->owner)->post('/owner/delivery-tiers', [
        'min_km' => 4,
        'max_km' => 8,
        'fee' => 15000,
        'is_active' => true,
        'sort_order' => 2,
    ])->assertSessionHasErrors('min_km');
}
```

Add a pricing service test using the existing outlet coordinates and quote
coordinates from
`test_delivery_pricing_service_calculates_fee_for_serviceable_distance`. Create
active tiers `0–0.5 km` and `1.5–2 km`; the existing coordinate pair is about
1 km apart, so assert:

```php
$this->assertFalse($quote['is_serviceable']);
$this->assertSame(0.0, $quote['delivery_fee']);
```

- [ ] **Step 2: Run focused tests and verify failures**

Run:

```bash
php artisan test tests/Feature/DeliveryTierTest.php tests/Feature/DeliveryPricingTest.php
```

Expected: overlapping tiers are accepted and `quote()` ignores `min_km`.

- [ ] **Step 3: Validate overlap after base validation**

In `StoreDeliveryTierRequest::after()` add a callback that queries active tiers,
excludes the current route tier on update, and rejects an interval when:

```php
$overlap = DeliveryTier::query()
    ->where('is_active', true)
    ->when($this->route('tier'), fn ($query, $tier) => $query->whereKeyNot($tier->id))
    ->where('min_km', '<', (float) $this->input('max_km'))
    ->where('max_km', '>', (float) $this->input('min_km'))
    ->exists();

if ($overlap) {
    $validator->errors()->add(
        'min_km',
        'Rentang jarak bertumpang tindih dengan tier aktif lain.',
    );
}
```

- [ ] **Step 4: Respect both tier boundaries**

Change the quote match:

```php
if ($distanceKm >= $tier['min_km'] && $distanceKm <= $tier['max_km']) {
    return [
        'distance_km' => $distanceKm,
        'delivery_fee' => (float) $tier['fee'],
        'is_serviceable' => true,
    ];
}
```

- [ ] **Step 5: Run delivery pricing tests**

Run:

```bash
php artisan test tests/Feature/DeliveryTierTest.php tests/Feature/DeliveryPricingTest.php
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/Http/Requests/Owner/StoreDeliveryTierRequest.php app/Services/DeliveryPricingService.php tests/Feature/DeliveryTierTest.php tests/Feature/DeliveryPricingTest.php
git commit -m "fix: enforce valid delivery radius tiers"
```

---

### Task 7: Release Verification for the Delivery Slice

**Files:**

- Modify: `docs/PRODUCTION_CHECKLIST.md`
- Modify: `docs/RUNBOOK.md`
- Create: `docs/DELIVERY-SMOKE-TEST.md`

**Interfaces:**

- Consumes: all behavior from Tasks 1–6.
- Produces: repeatable staging evidence for both courier paths.

- [ ] **Step 1: Create the smoke-test record**

```markdown
# Delivery Launch Smoke Test

**Release commit:**
**Environment:** staging
**Operator:**
**Started/finished:**

| Journey | Order | Expected | Result | Evidence |
|---|---|---|---|---|
| Address outside radius | — | Rejected before payment |  |  |
| Dombi courier success |  | Paid → completed |  |  |
| External courier success |  | Paid → completed |  |  |
| External courier failure |  | Failed with reason |  |  |
| Pending payment dispatch |  | Assignment rejected |  |  |
| Cross-outlet assignment |  | Authorization rejected |  |  |

## Reconciliation

- Customer paid amount:
- Customer delivery fee:
- External actual courier cost:
- Order status:
- Delivery status:
- Stock before/after:
- Unexpected failed jobs/log errors:
```

- [ ] **Step 2: Add external-delivery incident actions to the runbook**

Document:

- keep an order at `ready_for_pickup` when external booking fails;
- never mark completed based only on booking creation;
- require operator confirmation and actor/timestamp;
- reconcile customer fee separately from external courier cost;
- on failure, record reason before retry/return/cancel.

- [ ] **Step 3: Add delivery evidence to the production checklist**

Add blocker checkboxes for:

```markdown
- [ ] **BLOCKER:** paid Dombi courier staging journey completed
- [ ] **BLOCKER:** paid Gojek/Grab staging journey completed
- [ ] **BLOCKER:** unpaid dispatch and cross-outlet assignment are rejected
- [ ] **BLOCKER:** customer fee and actual external courier cost reconcile separately
```

- [ ] **Step 4: Run the complete delivery gate**

Run:

```bash
php artisan test --filter='Delivery|Courier|Checkout|PaymentAuthorization|Ownership'
npm test
npm run types:check
npm run lint:check
npm run build
```

Expected: all commands exit `0`.

- [ ] **Step 5: Perform staging smoke tests**

Execute every row in `docs/DELIVERY-SMOKE-TEST.md`. Record real order identifiers,
timestamps, and evidence. Any failed blocker returns the release to `NO-GO`.

- [ ] **Step 6: Commit**

```bash
git add docs/PRODUCTION_CHECKLIST.md docs/RUNBOOK.md docs/DELIVERY-SMOKE-TEST.md
git commit -m "docs: add delivery launch verification"
```

## Plan Boundary

This plan does not activate CI, provision MySQL for CI, change production
deployment, or configure offsite backups. Those are separate production-readiness
plans and remain blockers even after every task above passes. The next plan to
execute before feature work is the CI reproducibility plan because delivery tests
cannot serve as a gate until the environment runs them reliably.
