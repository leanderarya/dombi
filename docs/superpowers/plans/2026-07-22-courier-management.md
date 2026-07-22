# Courier Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dual courier types (Dombi Pusat + Dombi Outlet + Eksternal Gojek/Grab), flat delivery fee, cost tracking per delivery, settlement integration.

**Architecture:** 3 migrations (courier_profiles source, pivot assignments, deliveries eksternal fields), modified DeliveryService with dual assign path, 2 new controllers (owner management + outlet nomination), 3 TDD test files.

**Tech Stack:** Laravel 13, React 19 + Inertia, TypeScript, MySQL 8+

---

## File Structure Map

### Migrations (3)
| File | Action | Responsibility |
|------|--------|----------------|
| `database/migrations/xxxx_add_courier_source_to_courier_profiles.php` | Create | Add `courier_source`, `nominated_by`, `approved_by`, `approved_at`; make `outlet_id` nullable |
| `database/migrations/xxxx_create_courier_outlet_assignments_table.php` | Create | Pivot: `courier_profile_id`, `outlet_id`, `assigned_at`, unique composite |
| `database/migrations/xxxx_add_external_courier_fields_to_deliveries.php` | Create | Add `courier_type`, `external_courier_name`, `external_courier_phone`, `external_plate_number`, `courier_cost` |

### Models (2 modify)
| File | Action |
|------|--------|
| `app/Models/CourierProfile.php` | Add `courier_source`, `nominated_by`, `approved_by`, `approved_at` to fillable. Add `assignedOutlets()` BelongsToMany, `scopePusat()`, `scopeOutlet()`, `scopePending()`, `scopeAvailableForOutlet()` |
| `app/Models/Delivery.php` | Add casts for `courier_type`, `external_courier_name`, `external_courier_phone`, `external_plate_number`, `courier_cost` |

### Services (2 modify)
| File | Action |
|------|--------|
| `app/Services/DeliveryService.php` | Modify `assignCourier()` to accept courier_type + eksternal fields. For eksternal: skip courer validation, set status='delivering', call `OrderStatusService::updateStatus(order, delivering)`. |
| `app/Services/SettlementReconciliationService.php` | Add `total_delivery_fee`, `eksternal_courier_cost`, `eksternal_delivery_count` to reconciliation output. |

### FormRequest (1 modify)
| File | Action |
|------|--------|
| `app/Http/Requests/AssignCourierRequest.php` | Modify `authorize()` to allow `ready_for_pickup` OR `pending_confirmation` for eksternal. Modify `rules()` to conditional: Dombi → courier_id required; Eksternal → nama + cost required. |

### Controllers (2 create, 2 modify)
| File | Action |
|------|--------|
| `app/Http/Controllers/Owner/CourierManagementController.php` | Create. Methods: `index()` — list pusat + candidate outlets; `approve($profileId)` — create user, set accepted; `reject($profileId)` — set rejected with audit trail; `updateAssignments($profileId)` — sync pivot outlets |
| `app/Http/Controllers/Outlet/MyCourierController.php` | Create. Methods: `index()` — list available couriers for this outlet; `nominate()` — create profile with source='outlet', status='pending'; |
| `app/Http/Controllers/Outlet/OrderController.php` | Modify `assignCourier()` — pass courier_type + eksternal fields to DeliveryService |
| `app/Http/Controllers/Owner/DeliveryController.php` | Modify `assignCourier()` — same change as outlet version |

### Routes (modify)
| Route | Action |
|-------|--------|
| Owner courier management CRUD | Add |
| Outlet my-couriers list + nominate | Add |
| (Existing assign routes unchanged — just pass new params) | Modify `assign-courier` param handling |

### Frontend (3 create, 1 modify)
| File | Action |
|------|--------|
| `resources/js/pages/owner/courier-management/index.tsx` | Create. Tabs: Kurir Pusat, Kandidat Outlet. Kurir Pusat table + plot modal. Kandidat approve/reject. |
| `resources/js/pages/outlet/my-couriers/index.tsx` | Create. Table of couriers available for this outlet. Nominate form (name + phone). |
| `resources/js/components/outlet/assign-courier-sheet.tsx` | Modify. Tab switch Dombi/Eksternal. Dombi: existing courier list. Eksternal: inline form (name, phone, plate, cost). Financial guardrail: real-time margin calc. |

### Backend Tests (3 files — TDD)
| File | Action |
|------|--------|
| `tests/Feature/DeliveryExternalCourierTest.php` | Create. Assign eksternal, lifecycle (delivering→completed), margin guardrail warning. |
| `tests/Feature/CourierProfileTest.php` | Create. Nomination → pending → approve/reject, pivot assignment, scopeAvailableForOutlet. |
| `tests/Feature/SettlementCourierCostTest.php` | Create. Courier cost aggregation in settlement reconciliation. |

---

### Task 1: Migration 1 — Add courier_source to courier_profiles

**Files:**
- Create: `database/migrations/xxxx_add_courier_source_to_courier_profiles.php`

- [ ] **Step 1: Write the migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courier_profiles', function (Blueprint $table) {
            $table->string('courier_source')->nullable()->after('user_id');
            $table->foreignId('outlet_id')->nullable()->change();
            $table->foreignId('nominated_by')->nullable()->constrained('users')->nullOnDelete()->after('outlet_id');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete()->after('nominated_by');
            $table->timestamp('approved_at')->nullable()->after('approved_by');
        });
    }

    public function down(): void
    {
        Schema::table('courier_profiles', function (Blueprint $table) {
            $table->dropColumn(['courier_source', 'nominated_by', 'approved_by', 'approved_at']);
        });
    }
};
```

- [ ] **Step 2: Run migration**

Run: `php artisan migrate`

- [ ] **Step 3: Commit**

```bash
git add database/migrations/xxxx_add_courier_source_to_courier_profiles.php
git commit -m "feat: add courier_source and approval fields to courier_profiles"
```

---

### Task 2: Migration 2 — Create courier_outlet_assignments pivot

**Files:**
- Create: `database/migrations/xxxx_create_courier_outlet_assignments_table.php`

- [ ] **Step 1: Write the migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('courier_outlet_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('courier_profile_id')->constrained()->cascadeOnDelete();
            $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
            $table->timestamp('assigned_at')->useCurrent();
            $table->unique(['courier_profile_id', 'outlet_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('courier_outlet_assignments');
    }
};
```

- [ ] **Step 2: Run migration**

Run: `php artisan migrate`

- [ ] **Step 3: Commit**

```bash
git add database/migrations/xxxx_create_courier_outlet_assignments_table.php
git commit -m "feat: create courier_outlet_assignments pivot table"
```

---

### Task 3: Migration 3 — Add external courier fields to deliveries

**Files:**
- Create: `database/migrations/xxxx_add_external_courier_fields_to_deliveries.php`

- [ ] **Step 1: Write the migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deliveries', function (Blueprint $table) {
            $table->string('courier_type', 20)->default('dombi')->after('courier_id');
            $table->string('external_courier_name', 100)->nullable()->after('courier_type');
            $table->string('external_courier_phone', 20)->nullable()->after('external_courier_name');
            $table->string('external_plate_number', 20)->nullable()->after('external_courier_phone');
            $table->decimal('courier_cost', 14, 2)->nullable()->after('external_plate_number');
        });
    }

    public function down(): void
    {
        Schema::table('deliveries', function (Blueprint $table) {
            $table->dropColumn(['courier_type', 'external_courier_name', 'external_courier_phone', 'external_plate_number', 'courier_cost']);
        });
    }
};
```

- [ ] **Step 2: Run migration**

Run: `php artisan migrate`

- [ ] **Step 3: Commit**

```bash
git add database/migrations/xxxx_add_external_courier_fields_to_deliveries.php
git commit -m "feat: add external courier fields to deliveries table"
```

---

### Task 4: Update CourierProfile model

**Files:**
- Modify: `app/Models/CourierProfile.php`

- [ ] **Step 1: Update fillable + casts**

```php
protected $fillable = [
    'user_id',
    'courier_source',
    'outlet_id',
    'nominated_by',
    'approved_by',
    'approved_at',
    'invitation_status',
    'invited_at',
    'accepted_at',
    'total_deliveries',
    'rating',
    'notes',
];

protected function casts(): array
{
    return [
        'invited_at' => 'datetime',
        'accepted_at' => 'datetime',
        'approved_at' => 'datetime',
        'total_deliveries' => 'integer',
        'rating' => 'decimal:2',
    ];
}
```

- [ ] **Step 2: Add relationships**

```php
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

public function assignedOutlets(): BelongsToMany
{
    return $this->belongsToMany(Outlet::class, 'courier_outlet_assignments')
        ->withPivot('assigned_at')
        ->withTimestamps();
}

public function nominatedBy(): BelongsTo
{
    return $this->belongsTo(User::class, 'nominated_by');
}

public function approvedBy(): BelongsTo
{
    return $this->belongsTo(User::class, 'approved_by');
}
```

- [ ] **Step 3: Add scopes**

```php
public function scopePusat($query)
{
    return $query->where('courier_source', 'pusat');
}

public function scopeOutlet($query)
{
    return $query->where('courier_source', 'outlet');
}

public function scopePending($query)
{
    return $query->where('invitation_status', 'pending');
}

public function scopeAvailableForOutlet($query, int $outletId)
{
    return $query->where(function ($q) use ($outletId) {
        $q->where('courier_source', 'outlet')->where('outlet_id', $outletId)
          ->orWhereHas('assignedOutlets', fn ($q) => $q->where('outlets.id', $outletId));
    })->where('invitation_status', 'accepted');
}
```

- [ ] **Step 4: Commit**

```bash
git add app/Models/CourierProfile.php
git commit -m "feat: CourierProfile scopes and relationships for dual courier types"
```

---

### Task 5: Update Delivery model casts

**Files:**
- Modify: `app/Models/Delivery.php`

- [ ] **Step 1: Read the model file**

Read `/Users/aryaajisadda/Herd/dombi/app/Models/Delivery.php`. Find the `casts()` method or `$fillable` array.

- [ ] **Step 2: Add new fields to fillable and casts**

```php
// In $fillable, add:
'external_courier_name', 'external_courier_phone', 'external_plate_number', 'courier_cost', 'courier_type',

// In casts(), add:
'courier_cost' => 'decimal:2',
```

- [ ] **Step 3: Commit**

```bash
git add app/Models/Delivery.php
git commit -m "feat: add courier_type and external courier fields to Delivery fillable"
```

---

### Task 6: AssignCourierRequest — conditional rules

**Files:**
- Modify: `app/Http/Requests/AssignCourierRequest.php`

- [ ] **Step 1: Read the existing file**

The current `authorize()` checks `$order->status !== 'ready_for_pickup'`. For eksternal, the order is still at `ready_for_pickup` so it passes. No change needed in `authorize()`.

- [ ] **Step 2: Update rules() to be conditional**

```php
public function rules(): array
{
    return [
        'courier_type' => ['required', 'in:dombi,eksternal'],
        'courier_id' => [
            'required_if:courier_type,dombi',
            Rule::exists('users', 'id')->where('role', 'courier')->where('is_active', true)->where('is_online', true),
        ],
        'external_courier_name' => ['required_if:courier_type,eksternal', 'string', 'max:100'],
        'external_courier_phone' => ['nullable', 'string', 'max:20'],
        'external_plate_number' => ['nullable', 'string', 'max:20'],
        'courier_cost' => ['required_if:courier_type,eksternal', 'numeric', 'min:0'],
    ];
}
```

- [ ] **Step 3: Commit**

```bash
git add app/Http/Requests/AssignCourierRequest.php
git commit -m "feat: AssignCourierRequest conditional rules for dombi/eksternal"
```

---

### Task 7: DeliveryService — assignCourier dual path

**Files:**
- Modify: `app/Services/DeliveryService.php`

This is the core logic change. The method must handle both Dombi (existing flow) and Eksternal (new simplified flow).

- [ ] **Step 1: Read the current method** (lines 24-116)

- [ ] **Step 2: Add eksternal validation + path**

Add at the start of `assignCourier()`:

```php
if ($courierType === 'eksternal') {
    return $this->assignEksternal($order, $actor, $externalName, $externalPhone, $externalPlate, $courierCost);
}
```

- [ ] **Step 3: Create assignEksternal private method**

```php
private function assignEksternal(Order $order, User $actor, ?string $externalName, ?string $externalPhone, ?string $externalPlate, ?float $courierCost): Delivery
{
    return DB::transaction(function () use ($order, $actor, $externalName, $externalPhone, $externalPlate, $courierCost): Delivery {
        $order = Order::query()->lockForUpdate()->findOrFail($order->id);

        if ($order->status !== 'ready_for_pickup') {
            throw ValidationException::withMessages([
                'courier_id' => 'Pesanan harus dalam status siap diambil.',
            ]);
        }

        $delivery = Delivery::create([
            'order_id' => $order->id,
            'courier_id' => null,
            'courier_type' => 'eksternal',
            'status' => 'delivering',
            'external_courier_name' => $externalName,
            'external_courier_phone' => $externalPhone,
            'external_plate_number' => $externalPlate,
            'courier_cost' => $courierCost,
            'assigned_by' => $actor->id,
            'assigned_at' => now(),
        ]);

        // Sync order status to delivering — pelanggan lihat "sedang dikirim"
        $this->orderStatusService->updateStatus($order, Order::STATUS_DELIVERING);

        $this->recordHistory($delivery, null, 'delivering', $actor, 'outlet', 'Kurir eksternal (Gojek/Grab).');

        return $delivery->load(['order.outlet', 'order.items.product', 'assignedBy']);
    });
}
```

- [ ] **Step 4: Update method signature**

Change from:
```php
public function assignCourier(Order $order, User $courier, User $assignedBy, ...)
```
To:
```php
public function assignCourier(
    Order $order,
    ?User $courier,
    User $assignedBy,
    bool $overrideCapacity = false,
    ?string $overrideReason = null,
    ?string $courierType = 'dombi',
    ?string $externalName = null,
    ?string $externalPhone = null,
    ?string $externalPlate = null,
    ?float $courierCost = null,
): Delivery
```

- [ ] **Step 5: Commit**

```bash
git add app/Services/DeliveryService.php
git commit -m "feat: DeliveryService assignEksternal path with order status sync"
```

---

### Task 8: TDD — CourierProfileTest

**Files:**
- Create: `tests/Feature/CourierProfileTest.php`

- [ ] **Step 1: Write the test**

```php
<?php

namespace Tests\Feature;

use App\Models\CourierProfile;
use App\Models\Outlet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CourierProfileTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $outletStaff;
    private Outlet $outlet;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create(['role' => 'owner']);
        $this->outletStaff = User::factory()->create(['role' => 'outlet']);
        $this->outlet = Outlet::create([
            'name' => 'Test Outlet',
            'address' => 'Jl. Test',
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'status' => 'active',
        ]);
    }

    public function test_outlet_can_nominate_courier(): void
    {
        $response = $this->actingAs($this->outletStaff)
            ->post("/outlet/couriers/nominate", [
                'name' => 'Bambang',
                'phone' => '081234567890',
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('courier_profiles', [
            'courier_source' => 'outlet',
            'outlet_id' => $this->outlet->id,
            'nominated_by' => $this->outletStaff->id,
            'invitation_status' => 'pending',
        ]);
    }

    public function test_owner_can_approve_nominated_courier(): void
    {
        $profile = CourierProfile::create([
            'courier_source' => 'outlet',
            'outlet_id' => $this->outlet->id,
            'nominated_by' => $this->outletStaff->id,
            'invitation_status' => 'pending',
        ]);

        $response = $this->actingAs($this->owner)
            ->post("/owner/couriers/{$profile->id}/approve");

        $response->assertRedirect();
        $profile->refresh();
        $this->assertEquals('accepted', $profile->invitation_status);
        $this->assertEquals($this->owner->id, $profile->approved_by);
        $this->assertNotNull($profile->approved_at);
        // A User should have been created with role=courier
        $this->assertNotNull($profile->user_id);
        $this->assertDatabaseHas('users', ['id' => $profile->user_id, 'role' => 'courier']);
    }

    public function test_owner_can_reject_nominated_courier_with_audit_trail(): void
    {
        $profile = CourierProfile::create([
            'courier_source' => 'outlet',
            'outlet_id' => $this->outlet->id,
            'nominated_by' => $this->outletStaff->id,
            'invitation_status' => 'pending',
        ]);

        $response = $this->actingAs($this->owner)
            ->post("/owner/couriers/{$profile->id}/reject");

        $response->assertRedirect();
        $profile->refresh();
        $this->assertEquals('rejected', $profile->invitation_status);
        $this->assertEquals($this->owner->id, $profile->approved_by);
        // Row still exists — audit trail preserved
        $this->assertDatabaseHas('courier_profiles', ['id' => $profile->id]);
    }

    public function test_owner_can_plot_pusat_courier_to_outlets(): void
    {
        $pusatUser = User::factory()->create(['role' => 'courier']);
        $profile = CourierProfile::create([
            'user_id' => $pusatUser->id,
            'courier_source' => 'pusat',
            'invitation_status' => 'accepted',
        ]);

        $outletB = Outlet::create([
            'name' => 'Outlet B',
            'address' => 'Jl. B',
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'status' => 'active',
        ]);

        $response = $this->actingAs($this->owner)
            ->put("/owner/couriers/{$profile->id}/outlets", [
                'outlet_ids' => [$this->outlet->id, $outletB->id],
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('courier_outlet_assignments', [
            'courier_profile_id' => $profile->id,
            'outlet_id' => $this->outlet->id,
        ]);
        $this->assertDatabaseHas('courier_outlet_assignments', [
            'courier_profile_id' => $profile->id,
            'outlet_id' => $outletB->id,
        ]);
    }

    public function test_scope_available_for_outlet_returns_assigned_pusat_and_owned_outlet(): void
    {
        $pusatUser = User::factory()->create(['role' => 'courier']);
        $pusatProfile = CourierProfile::create([
            'user_id' => $pusatUser->id,
            'courier_source' => 'pusat',
            'invitation_status' => 'accepted',
        ]);
        $pusatProfile->assignedOutlets()->attach($this->outlet->id);

        $outletProfile = CourierProfile::create([
            'courier_source' => 'outlet',
            'outlet_id' => $this->outlet->id,
            'invitation_status' => 'accepted',
        ]);

        $available = CourierProfile::availableForOutlet($this->outlet->id)->get();

        $this->assertCount(2, $available);
        $this->assertTrue($available->contains('id', $pusatProfile->id));
        $this->assertTrue($available->contains('id', $outletProfile->id));
    }
}
```

- [ ] **Step 2: Run test to verify it fails** (no controllers yet)

Run: `php artisan test tests/Feature/CourierProfileTest.php --stop-on-failure`
Expected: FAIL — route not defined, controller not found

- [ ] **Step 3: Keep test for later — it will pass after controllers are built**

- [ ] **Step 4: Commit**

```bash
git add tests/Feature/CourierProfileTest.php
git commit -m "test: CourierProfile nomination/approval/pivot tests"
```

---

### Task 9: TDD — DeliveryExternalCourierTest

**Files:**
- Create: `tests/Feature/DeliveryExternalCourierTest.php`

- [ ] **Step 1: Write the test**

```php
<?php

namespace Tests\Feature;

use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\OutletInventory;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeliveryExternalCourierTest extends TestCase
{
    use RefreshDatabase;

    private User $outletStaff;
    private Order $order;

    protected function setUp(): void
    {
        parent::setUp();

        $this->outletStaff = User::factory()->create(['role' => 'outlet']);
        $outletUser = User::factory()->create(['role' => 'outlet']);
        $outlet = Outlet::create([
            'user_id' => $outletUser->id,
            'name' => 'Test Outlet',
            'address' => 'Jl. Test',
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'latitude' => -6.2,
            'longitude' => 106.8,
            'status' => 'active',
        ]);

        $this->order = Order::create([
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-EXT-001',
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'fulfillment_type' => 'delivery_dombi',
            'subtotal' => 50000,
            'delivery_fee' => 15000,
            'total' => 65000,
            'customer_name' => 'Test',
            'customer_phone' => '081234567890',
            'customer_address' => 'Jl. Customer',
            'ordered_at' => now(),
        ]);
    }

    public function test_assign_eksternal_sets_delivery_status_delivering(): void
    {
        $response = $this->actingAs($this->outletStaff)
            ->post("/outlet/orders/{$this->order->id}/assign-courier", [
                'courier_type' => 'eksternal',
                'external_courier_name' => 'Gojek',
                'external_courier_phone' => '081111111',
                'external_plate_number' => 'B 1234 ABC',
                'courier_cost' => 25000,
            ]);

        $response->assertRedirect();
        $delivery = Delivery::where('order_id', $this->order->id)->first();

        $this->assertNotNull($delivery);
        $this->assertEquals('eksternal', $delivery->courier_type);
        $this->assertEquals('delivering', $delivery->status);
        $this->assertEquals('Gojek', $delivery->external_courier_name);
        $this->assertEquals(25000, (float) $delivery->courier_cost);

        // Order status sync'd to delivering
        $this->order->refresh();
        $this->assertEquals(Order::STATUS_DELIVERING, $this->order->status);
    }

    public function test_assign_eksternal_rejects_without_name(): void
    {
        $response = $this->actingAs($this->outletStaff)
            ->post("/outlet/orders/{$this->order->id}/assign-courier", [
                'courier_type' => 'eksternal',
                'courier_cost' => 25000,
            ]);

        $response->assertSessionHasErrors('external_courier_name');
    }

    public function test_assign_eksternal_rejects_without_cost(): void
    {
        $response = $this->actingAs($this->outletStaff)
            ->post("/outlet/orders/{$this->order->id}/assign-courier", [
                'courier_type' => 'eksternal',
                'external_courier_name' => 'Gojek',
            ]);

        $response->assertSessionHasErrors('courier_cost');
    }

    public function test_eksternal_delivery_can_be_marked_completed(): void
    {
        // Assign eksternal
        $this->actingAs($this->outletStaff)
            ->post("/outlet/orders/{$this->order->id}/assign-courier", [
                'courier_type' => 'eksternal',
                'external_courier_name' => 'Gojek',
                'courier_cost' => 25000,
            ]);

        $delivery = Delivery::where('order_id', $this->order->id)->first();

        // Mark completed
        $response = $this->actingAs($this->outletStaff)
            ->post("/outlet/deliveries/{$delivery->id}/complete", []);

        $response->assertRedirect();
        $delivery->refresh();
        $this->assertEquals('completed', $delivery->status);

        $this->order->refresh();
        $this->assertEquals(Order::STATUS_COMPLETED, $this->order->status);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/DeliveryExternalCourierTest.php --stop-on-failure`
Expected: FAIL — controllers not updated yet

- [ ] **Step 3: Commit**

```bash
git add tests/Feature/DeliveryExternalCourierTest.php
git commit -m "test: DeliveryExternalCourier lifecycle tests"
```

---

### Task 10: Update Outlet OrderController — pass eksternal params

**Files:**
- Modify: `app/Http/Controllers/Outlet/OrderController.php`

- [ ] **Step 1: Read the current assignCourier method**

```php
public function assignCourier(AssignCourierRequest $request, Order $order, DeliveryService $deliveryService): RedirectResponse
```

- [ ] **Step 2: Update to pass courier_type + eksternal fields**

```php
public function assignCourier(AssignCourierRequest $request, Order $order, DeliveryService $deliveryService): RedirectResponse
{
    $validated = $request->validated();

    $courier = null;
    if (($validated['courier_type'] ?? 'dombi') === 'dombi') {
        $courier = User::findOrFail($validated['courier_id']);
    }

    $delivery = $deliveryService->assignCourier(
        $order,
        $courier,
        $request->user(),
        overrideCapacity: $request->boolean('override_capacity'),
        overrideReason: $request->input('override_reason'),
        courierType: $validated['courier_type'] ?? 'dombi',
        externalName: $validated['external_courier_name'] ?? null,
        externalPhone: $validated['external_courier_phone'] ?? null,
        externalPlate: $validated['external_plate_number'] ?? null,
        courierCost: isset($validated['courier_cost']) ? (float) $validated['courier_cost'] : null,
    );

    $msg = $delivery->courier_type === 'eksternal'
        ? "Pesanan dikirim via {$delivery->external_courier_name}."
        : "Kurir {$delivery->courier->name} di-assign.";

    return redirect()->back()->with('success', $msg);
}
```

- [ ] **Step 3: Commit**

```bash
git add app/Http/Controllers/Outlet/OrderController.php
git commit -m "feat: pass courier_type and eksternal params from outlet order controller"
```

---

### Task 11: Update Owner DeliveryController — same change

**Files:**
- Modify: `app/Http/Controllers/Owner/DeliveryController.php`

- [ ] **Step 1: Read the current assignCourier method**

- [ ] **Step 2: Apply the same change as Task 10**

- [ ] **Step 3: Commit**

```bash
git add app/Http/Controllers/Owner/DeliveryController.php
git commit -m "feat: pass courier_type and eksternal params from owner delivery controller"
```

---

### Task 12: Routes — add courier management

**Files:**
- Modify: `routes/web.php`

- [ ] **Step 1: Add owner routes (inside `owner` prefix group)**

```php
Route::get('couriers', [App\Http\Controllers\Owner\CourierManagementController::class, 'index'])->name('couriers.index');
Route::post('couriers/{profile}/approve', [App\Http\Controllers\Owner\CourierManagementController::class, 'approve'])->name('couriers.approve');
Route::post('couriers/{profile}/reject', [App\Http\Controllers\Owner\CourierManagementController::class, 'reject'])->name('couriers.reject');
Route::put('couriers/{profile}/outlets', [App\Http\Controllers\Owner\CourierManagementController::class, 'updateAssignments'])->name('couriers.outlets');
```

- [ ] **Step 2: Add outlet routes (inside `outlet` prefix group)**

```php
Route::get('my-couriers', [App\Http\Controllers\Outlet\MyCourierController::class, 'index'])->name('my-couriers.index');
Route::post('my-couriers/nominate', [App\Http\Controllers\Outlet\MyCourierController::class, 'nominate'])->name('my-couriers.nominate');
```

- [ ] **Step 3: Verify routes**

Run: `php artisan route:list | grep courier`

- [ ] **Step 4: Commit**

```bash
git add routes/web.php
git commit -m "feat: add courier management routes (owner + outlet)"
```

---

### Task 13: Owner CourierManagementController

**Files:**
- Create: `app/Http/Controllers/Owner/CourierManagementController.php`

- [ ] **Step 1: Create controller**

```php
<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\CourierProfile;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CourierManagementController extends Controller
{
    public function index(): Response
    {
        $pusat = CourierProfile::with(['user', 'assignedOutlets'])
            ->pusat()
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'name' => $p->user?->name,
                'phone' => $p->user?->phone,
                'assigned_outlets' => $p->assignedOutlets->pluck('id'),
                'assigned_outlet_names' => $p->assignedOutlets->pluck('name'),
                'total_deliveries' => $p->total_deliveries,
            ]);

        $candidates = CourierProfile::with(['nominatedBy', 'outlet'])
            ->outlet()
            ->pending()
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'outlet_name' => $p->outlet?->name,
                'nominated_by_name' => $p->nominatedBy?->name,
                'created_at' => $p->created_at->toISOString(),
            ]);

        $rejected = CourierProfile::with(['outlet'])
            ->outlet()
            ->where('invitation_status', 'rejected')
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'outlet_name' => $p->outlet?->name,
                'rejected_at' => $p->approved_at?->toISOString(),
            ]);

        return Inertia::render('owner/courier-management/index', [
            'pusat' => $pusat,
            'candidates' => $candidates,
            'rejected' => $rejected,
            'outlets' => \App\Models\Outlet::where('status', 'active')->get(['id', 'name']),
        ]);
    }

    public function approve(CourierProfile $profile): RedirectResponse
    {
        if (! $profile->isPending()) {
            return back()->with('error', 'Kandidat sudah diproses.');
        }

        // Create user
        $user = User::create([
            'name' => 'Kurir ' . $profile->outlet?->name,
            'phone' => '08' . random_int(1000000000, 9999999999),
            'role' => 'courier',
            'is_active' => true,
            'password' => bcrypt('password'),
        ]);

        $profile->update([
            'user_id' => $user->id,
            'invitation_status' => 'accepted',
            'approved_by' => request()->user()->id,
            'approved_at' => now(),
        ]);

        return back()->with('success', 'Kurir berhasil disetujui.');
    }

    public function reject(CourierProfile $profile): RedirectResponse
    {
        if (! $profile->isPending()) {
            return back()->with('error', 'Kandidat sudah diproses.');
        }

        $profile->update([
            'invitation_status' => 'rejected',
            'approved_by' => request()->user()->id,
            'approved_at' => now(),
        ]);

        return back()->with('success', 'Kandidat ditolak.');
    }

    public function updateAssignments(Request $request, CourierProfile $profile): RedirectResponse
    {
        $validated = $request->validate([
            'outlet_ids' => ['required', 'array'],
            'outlet_ids.*' => ['integer', 'exists:outlets,id'],
        ]);

        $profile->assignedOutlets()->sync($validated['outlet_ids']);

        return back()->with('success', 'Plotting outlet berhasil diperbarui.');
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/Http/Controllers/Owner/CourierManagementController.php
git commit -m "feat: CourierManagementController with approve/reject/plot"
```

---

### Task 14: Outlet MyCourierController

**Files:**
- Create: `app/Http/Controllers/Outlet/MyCourierController.php`

- [ ] **Step 1: Create controller**

```php
<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\CourierProfile;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MyCourierController extends Controller
{
    public function index(): Response
    {
        $outlet = request()->user()->outlet;

        $couriers = CourierProfile::with('user')
            ->availableForOutlet($outlet->id)
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'name' => $p->user?->name,
                'source' => $p->courier_source,
                'total_deliveries' => $p->total_deliveries,
            ]);

        $pending = CourierProfile::where('outlet_id', $outlet->id)
            ->where('courier_source', 'outlet')
            ->where('invitation_status', 'pending')
            ->count();

        return Inertia::render('outlet/my-couriers/index', [
            'couriers' => $couriers,
            'pending_count' => $pending,
        ]);
    }

    public function nominate(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:20'],
        ]);

        $outlet = $request->user()->outlet;

        CourierProfile::create([
            'courier_source' => 'outlet',
            'outlet_id' => $outlet->id,
            'nominated_by' => $request->user()->id,
            'invitation_status' => 'pending',
        ]);

        return back()->with('success', 'Kandidat kurir diajukan. Menunggu persetujuan Owner.');
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/Http/Controllers/Outlet/MyCourierController.php
git commit -m "feat: Outlet MyCourierController list + nominate"
```

---

### Task 15: Frontend — AssignCourierSheet (Dombi/Eksternal switch + guardrail)

**Files:**
- Modify: `resources/js/components/outlet/assign-courier-sheet.tsx`

This is the largest frontend change. The existing sheet shows a list of Dombi couriers. We must add:
1. A tab switch at top: "Kurir Dombi" | "Gojek/Grab"
2. When "Gojek/Grab" selected: show inline form (name, phone, plate, cost) instead of courier list
3. Financial guardrail: real-time margin calculation

- [ ] **Step 1: Add courierType state + tab UI**

Add state after existing state declarations:
```tsx
const [courierType, setCourierType] = useState<'dombi' | 'eksternal'>('dombi');
```

Add tab switcher after the header:
```tsx
<div className="mt-3 flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
    <button
        type="button"
        onClick={() => setCourierType('dombi')}
        className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
            courierType === 'dombi' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
        }`}
    >
        Kurir Dombi
    </button>
    <button
        type="button"
        onClick={() => setCourierType('eksternal')}
        className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
            courierType === 'eksternal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
        }`}
    >
        Gojek / Grab
    </button>
</div>
```

- [ ] **Step 2: Add eksternal form + guardrail state**

```tsx
const [externalName, setExternalName] = useState('');
const [externalPhone, setExternalPhone] = useState('');
const [externalPlate, setExternalPlate] = useState('');
const [courierCost, setCourierCost] = useState('');

// Financial guardrail — assumes deliveryFee passed via props or fetched
// Add deliveryFee to Props interface
```

Update Props interface:
```tsx
interface Props {
    outletId: number;
    orderId: number;
    deliveryFee: number; // from order data
    open: boolean;
    onClose: () => void;
}
```

Guardrail calculation:
```tsx
const costNum = parseFloat(courierCost) || 0;
const margin = deliveryFee - costNum;
const isLoss = margin < 0;
```

- [ ] **Step 3: Conditional render — eksternal form vs dombi list**

Replace the content section:

```tsx
{courierType === 'dombi' ? (
    /* Existing courier list code */
) : (
    <div className="space-y-3">
        <div>
            <label className="text-xs font-semibold text-slate-500">Nama Kurir</label>
            <input
                type="text"
                value={externalName}
                onChange={e => setExternalName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm"
                placeholder="Nama driver Gojek/Grab"
            />
        </div>
        <div className="flex gap-2">
            <div className="flex-1">
                <label className="text-xs font-semibold text-slate-500">No. HP</label>
                <input
                    type="text"
                    value={externalPhone}
                    onChange={e => setExternalPhone(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm"
                    placeholder="0812..."
                />
            </div>
            <div className="flex-1">
                <label className="text-xs font-semibold text-slate-500">Plat</label>
                <input
                    type="text"
                    value={externalPlate}
                    onChange={e => setExternalPlate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm"
                    placeholder="B 1234 ABC"
                />
            </div>
        </div>
        <div>
            <label className="text-xs font-semibold text-slate-500">Biaya Ongkir (Gojek)</label>
            <input
                type="number"
                value={courierCost}
                onChange={e => setCourierCost(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm"
                placeholder="25000"
                min={0}
            />
        </div>

        {/* Financial Guardrail */}
        {costNum > 0 && (
            <div className={`rounded-lg border p-3 ${isLoss ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
                <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Ongkir Customer</span>
                    <span className="font-semibold">Rp {deliveryFee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Biaya Gojek</span>
                    <span className="font-semibold">Rp {costNum.toLocaleString()}</span>
                </div>
                <div className={`mt-1 flex justify-between border-t pt-1 text-sm font-bold ${isLoss ? 'text-red-600' : 'text-emerald-600'}`}>
                    <span>Selisih</span>
                    <span>{isLoss ? '⚠️' : '✅'} Rp {Math.abs(margin).toLocaleString()} {isLoss ? 'RUGI' : 'UNTUNG'}</span>
                </div>
                {isLoss && (
                    <p className="mt-2 text-xs text-red-600">Pengiriman ini merugi. Lanjutkan?</p>
                )}
            </div>
        )}
    </div>
)}
```

- [ ] **Step 4: Update handleSubmit for eksternal**

```tsx
function handleSubmit() {
    if (courierType === 'dombi') {
        if (!selectedCourier) return;
        form.transform(() => ({ courier_id: String(selectedCourier), courier_type: 'dombi' }));
    } else {
        if (!externalName || !courierCost) return;
        form.transform(() => ({
            courier_type: 'eksternal',
            external_courier_name: externalName,
            external_courier_phone: externalPhone,
            external_plate_number: externalPlate,
            courier_cost: courierCost,
        }));
    }

    form.post(`/outlet/orders/${orderId}/assign-courier`, {
        onSuccess: () => onClose(),
        preserveScroll: true,
    });
}
```

- [ ] **Step 5: Verify TypeScript**

Run: `npx tsc --noEmit` — check for any type errors in the component

- [ ] **Step 6: Commit**

```bash
git add resources/js/components/outlet/assign-courier-sheet.tsx
git commit -m "feat: assign-courier-sheet Dombi/Eksternal switch + financial guardrail"
```

---

### Task 16: Frontend — Owner courier management page

**Files:**
- Create: `resources/js/pages/owner/courier-management/index.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import OwnerLayout from '@/layouts/owner-layout';

interface CourierPusat {
    id: number;
    name: string;
    phone: string | null;
    assigned_outlets: number[];
    assigned_outlet_names: string[];
    total_deliveries: number;
}

interface Candidate {
    id: number;
    outlet_name: string;
    nominated_by_name: string;
    created_at: string;
}

interface Outlet {
    id: number;
    name: string;
}

export default function CourierManagement() {
    const { pusat, candidates, rejected, outlets } = usePage<any>().props;
    const [activeTab, setActiveTab] = useState<'pusat' | 'kandidat' | 'riwayat'>('pusat');
    const [plottingId, setPlottingId] = useState<number | null>(null);
    const [selectedOutlets, setSelectedOutlets] = useState<number[]>([]);

    const tabs = [
        { key: 'pusat', label: 'Kurir Pusat' },
        { key: 'kandidat', label: 'Kandidat Outlet' },
        { key: 'riwayat', label: 'Riwayat' },
    ];

    return (
        <OwnerLayout title="Kelola Kurir">
            <div className="p-4">
                <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key as any)}
                            className={`flex-1 rounded-md py-2 text-sm font-medium ${
                                activeTab === t.key ? 'bg-white shadow-sm' : 'text-slate-500'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {activeTab === 'pusat' && (
                    <div className="mt-4 space-y-3">
                        {pusat.map((c: CourierPusat) => (
                            <div key={c.id} className="rounded-lg border p-3">
                                <div className="flex justify-between">
                                    <div>
                                        <div className="font-semibold">{c.name}</div>
                                        <div className="text-sm text-slate-500">{c.total_deliveries} delivery</div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setPlottingId(c.id);
                                            setSelectedOutlets(c.assigned_outlets);
                                        }}
                                        className="text-sm text-emerald-600 font-medium"
                                    >
                                        Plot Outlet
                                    </button>
                                </div>
                                <div className="mt-1 text-xs text-slate-400">
                                    Outlet: {c.assigned_outlet_names.join(', ') || 'Belum diplot'}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'kandidat' && (
                    <div className="mt-4 space-y-3">
                        {candidates.map((c: Candidate) => (
                            <div key={c.id} className="rounded-lg border p-3">
                                <div className="font-semibold">{c.outlet_name}</div>
                                <div className="text-sm text-slate-500">Dicalonkan oleh: {c.nominated_by_name}</div>
                                <div className="mt-2 flex gap-2">
                                    <button
                                        onClick={() => router.post(`/owner/couriers/${c.id}/approve`)}
                                        className="rounded bg-emerald-600 px-3 py-1 text-sm font-medium text-white"
                                    >
                                        Setujui
                                    </button>
                                    <button
                                        onClick={() => router.post(`/owner/couriers/${c.id}/reject`)}
                                        className="rounded bg-red-600 px-3 py-1 text-sm font-medium text-white"
                                    >
                                        Tolak
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'riwayat' && (
                    <div className="mt-4 space-y-3">
                        {rejected.map((r: any) => (
                            <div key={r.id} className="rounded-lg border p-3 text-sm text-slate-500">
                                {r.outlet_name} — Ditolak
                            </div>
                        ))}
                    </div>
                )}

                {/* Plot Modal */}
                {plottingId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPlottingId(null)}>
                        <div className="w-full max-w-md rounded-xl bg-white p-4" onClick={e => e.stopPropagation()}>
                            <h3 className="font-bold">Plot Kurir ke Outlet</h3>
                            <div className="mt-3 space-y-2">
                                {outlets.map((o: Outlet) => (
                                    <label key={o.id} className="flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={selectedOutlets.includes(o.id)}
                                            onChange={() => {
                                                setSelectedOutlets(prev =>
                                                    prev.includes(o.id)
                                                        ? prev.filter(id => id !== o.id)
                                                        : [...prev, o.id]
                                                );
                                            }}
                                        />
                                        {o.name}
                                    </label>
                                ))}
                            </div>
                            <div className="mt-4 flex gap-2">
                                <button onClick={() => setPlottingId(null)} className="flex-1 rounded-lg border py-2 text-sm font-medium">Batal</button>
                                <button
                                    onClick={() => {
                                        router.put(`/owner/couriers/${plottingId}/outlets`, { outlet_ids: selectedOutlets });
                                        setPlottingId(null);
                                    }}
                                    className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white"
                                >
                                    Simpan
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </OwnerLayout>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/pages/owner/courier-management/index.tsx
git commit -m "feat: owner courier management page with approve/reject/plot"
```

---

### Task 17: Frontend — Outlet my-couriers page

**Files:**
- Create: `resources/js/pages/outlet/my-couriers/index.tsx`

- [ ] **Step 1: Create page**

```tsx
import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import OutletLayout from '@/layouts/outlet-layout';

export default function MyCouriers() {
    const { couriers, pending_count } = usePage<any>().props;
    const [showNominate, setShowNominate] = useState(false);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');

    const handleNominate = () => {
        router.post('/outlet/my-couriers/nominate', { name, phone });
    };

    return (
        <OutletLayout title="Kurir Saya">
            <div className="p-4">
                <div className="mb-4 flex items-center justify-between">
                    <div className="text-sm text-slate-500">
                        {pending_count > 0 && `${pending_count} menunggu persetujuan`}
                    </div>
                    <button
                        onClick={() => setShowNominate(true)}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white"
                    >
                        + Calonkan Kurir
                    </button>
                </div>

                <div className="space-y-3">
                    {couriers.map((c: any) => (
                        <div key={c.id} className="rounded-lg border p-3">
                            <div className="font-semibold">{c.name}</div>
                            <div className="text-sm text-slate-500">
                                {c.source === 'pusat' ? 'Kurir Pusat' : 'Kurir Outlet'} · {c.total_deliveries} delivery
                            </div>
                        </div>
                    ))}
                </div>

                {showNominate && (
                    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setShowNominate(false)}>
                        <div className="w-full max-w-lg rounded-t-2xl bg-white p-4" onClick={e => e.stopPropagation()}>
                            <h3 className="font-bold">Calonkan Kurir Baru</h3>
                            <p className="mt-1 text-xs text-slate-500">Owner akan menyetujui sebelum kurir aktif.</p>
                            <div className="mt-3 space-y-3">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Nama"
                                    className="w-full rounded-lg border p-3 text-sm"
                                />
                                <input
                                    type="text"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    placeholder="No. HP"
                                    className="w-full rounded-lg border p-3 text-sm"
                                />
                            </div>
                            <div className="mt-4 flex gap-2">
                                <button onClick={() => setShowNominate(false)} className="flex-1 rounded-lg border py-3 text-sm font-medium">Batal</button>
                                <button onClick={handleNominate} disabled={!name} className="flex-1 rounded-lg bg-emerald-600 py-3 text-sm font-medium text-white disabled:bg-slate-300">
                                    Ajukan
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </OutletLayout>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/pages/outlet/my-couriers/index.tsx
git commit -m "feat: outlet my-couriers page with nominate form"
```

---

### Task 18: Settlement reconciliation — courier cost aggregation

**Files:**
- Modify: `app/Services/SettlementReconciliationService.php`

- [ ] **Step 1: Add courier metrics to reconciliation**

Find `getOutletReconciliation()` method. Add after existing aggregations:

```php
// Total delivery fee collected from customers
$totalDeliveryFee = (float) \App\Models\Order::where('outlet_id', $outletId)
    ->where('status', \App\Models\Order::STATUS_COMPLETED)
    ->sum('delivery_fee');

// Eksternal courier costs
$eksternalCost = (float) \App\Models\Delivery::whereHas('order', fn ($q) => $q->where('outlet_id', $outletId))
    ->where('courier_type', 'eksternal')
    ->sum('courier_cost');

$eksternalCount = (int) \App\Models\Delivery::whereHas('order', fn ($q) => $q->where('outlet_id', $outletId))
    ->where('courier_type', 'eksternal')
    ->count();
```

Add to returned array:
```php
'total_delivery_fee' => $totalDeliveryFee,
'eksternal_courier_cost' => $eksternalCost,
'eksternal_delivery_count' => $eksternalCount,
'net_delivery_income' => $totalDeliveryFee - $eksternalCost,
```

- [ ] **Step 2: Commit**

```bash
git add app/Services/SettlementReconciliationService.php
git commit -m "feat: add courier cost aggregation to settlement reconciliation"
```

---

### Task 19: TDD — SettlementCourierCostTest

**Files:**
- Create: `tests/Feature/SettlementCourierCostTest.php`

- [ ] **Step 1: Write the test**

```php
<?php

namespace Tests\Feature;

use App\Models\Delivery;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\Settlement;
use App\Models\User;
use App\Services\SettlementReconciliationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SettlementCourierCostTest extends TestCase
{
    use RefreshDatabase;

    public function test_reconciliation_includes_courier_costs(): void
    {
        $outlet = Outlet::create([
            'name' => 'Test Outlet',
            'address' => 'Jl. Test',
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'status' => 'active',
        ]);

        // Create completed orders with delivery fees
        $order1 = Order::create([
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-SET-001',
            'status' => Order::STATUS_COMPLETED,
            'delivery_fee' => 15000,
            'subtotal' => 50000,
            'total' => 65000,
            'customer_name' => 'Test',
            'customer_phone' => '081234567890',
            'customer_address' => 'Jl. Test',
            'ordered_at' => now()->subDays(5),
        ]);

        $order2 = Order::create([
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-SET-002',
            'status' => Order::STATUS_COMPLETED,
            'delivery_fee' => 15000,
            'subtotal' => 50000,
            'total' => 65000,
            'customer_name' => 'Test',
            'customer_phone' => '081234567890',
            'customer_address' => 'Jl. Test',
            'ordered_at' => now()->subDays(3),
        ]);

        // One delivery using eksternal courier with cost 25000
        Delivery::create([
            'order_id' => $order1->id,
            'courier_type' => 'eksternal',
            'status' => 'completed',
            'external_courier_name' => 'Gojek',
            'courier_cost' => 25000,
        ]);

        // One delivery using dombi courier (no cost)
        Delivery::create([
            'order_id' => $order2->id,
            'courier_type' => 'dombi',
            'status' => 'completed',
        ]);

        $service = app(SettlementReconciliationService::class);
        $result = $service->getOutletReconciliation($outlet->id);

        $this->assertEquals(30000, $result['total_delivery_fee']);
        $this->assertEquals(25000, $result['eksternal_courier_cost']);
        $this->assertEquals(1, $result['eksternal_delivery_count']);
        $this->assertEquals(5000, $result['net_delivery_income']);
    }
}
```

- [ ] **Step 2: Run test**

Run: `php artisan test tests/Feature/SettlementCourierCostTest.php --stop-on-failure`
Expected: PASS (service already updated in Task 18)

- [ ] **Step 3: Commit**

```bash
git add tests/Feature/SettlementCourierCostTest.php
git commit -m "test: settlement courier cost aggregation test"
```

---

### Task 20: Verify full test suite

- [ ] **Step 1: Run all tests**

Run: `php artisan test`

Expected: All 3 new test files pass. Existing 781 tests still pass. Total ≥ 784.

- [ ] **Step 2: Fix any failures**

If any new tests fail, fix and re-run.

- [ ] **Step 3: Push**

```bash
git push origin main
```
