# Kurir Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add courier management feature - owner can add/monitor couriers, couriers send real-time GPS, outlets assign nearest courier.

**Architecture:** Extend User model with location fields, add CourierProfile and CourierInvitation tables. Owner CRUD via Inertia pages. Location tracking via polling API. Nearest-courier assignment with Haversine formula.

**Tech Stack:** Laravel 12, React 19, Inertia.js, Tailwind CSS 4, MySQL

---

## File Structure

### New Files
- `database/migrations/2026_07_09_000001_add_location_and_vehicle_fields_to_users_table.php`
- `database/migrations/2026_07_09_000002_create_courier_profiles_table.php`
- `database/migrations/2026_07_09_000003_create_courier_invitations_table.php`
- `app/Models/CourierProfile.php`
- `app/Models/CourierInvitation.php`
- `app/Services/CourierService.php`
- `app/Services/CourierInvitationService.php`
- `app/Services/CourierLocationService.php`
- `app/Http/Controllers/Owner/CourierController.php`
- `app/Http/Controllers/Courier/LocationController.php`
- `app/Http/Requests/Owner/StoreCourierRequest.php`
- `app/Http/Requests/Owner/UpdateCourierRequest.php`
- `resources/js/pages/owner/couriers/index.tsx`
- `resources/js/pages/owner/couriers/create.tsx`
- `resources/js/pages/owner/couriers/show.tsx`
- `resources/js/components/owner/courier-stats.tsx`
- `resources/js/components/outlet/assign-courier-sheet.tsx`
- `tests/Feature/OwnerCourierManagementTest.php`
- `tests/Feature/CourierLocationTrackingTest.php`
- `tests/Feature/NearestCourierAssignmentTest.php`
- `tests/Unit/CourierLocationServiceTest.php`

### Modified Files
- `app/Models/User.php` - Add location fields, vehicle fields, relationships
- `routes/web.php` - Add courier routes
- `resources/js/pages/outlet/orders/show.tsx` - Add assign kurir button

---

## Task 1: Database Migrations

**Files:**
- Create: `database/migrations/2026_07_09_000001_add_location_and_vehicle_fields_to_users_table.php`
- Create: `database/migrations/2026_07_09_000002_create_courier_profiles_table.php`
- Create: `database/migrations/2026_07_09_000003_create_courier_invitations_table.php`

- [ ] **Step 1: Create users table migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->decimal('latitude', 10, 7)->nullable()->after('is_online');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            $table->timestamp('location_updated_at')->nullable()->after('longitude');
            $table->enum('vehicle_type', ['motorcycle', 'bicycle', 'car'])->nullable()->after('location_updated_at');
            $table->string('vehicle_plate', 20)->nullable()->after('vehicle_type');
            $table->string('photo')->nullable()->after('vehicle_plate');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['latitude', 'longitude', 'location_updated_at', 'vehicle_type', 'vehicle_plate', 'photo']);
        });
    }
};
```

- [ ] **Step 2: Create courier_profiles migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('courier_profiles', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('invitation_status', ['pending', 'accepted', 'rejected'])->default('pending');
            $table->timestamp('invited_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->unsignedInteger('total_deliveries')->default(0);
            $table->decimal('rating', 3, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique('user_id');
            $table->index('invitation_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('courier_profiles');
    }
};
```

- [ ] **Step 3: Create courier_invitations migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('courier_invitations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('invited_by')->constrained('users');
            $table->foreignId('courier_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('phone', 20);
            $table->string('name');
            $table->string('token', 64)->unique();
            $table->enum('status', ['pending', 'accepted', 'expired'])->default('pending');
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('expires_at');
            $table->timestamps();

            $table->index('status');
            $table->index('token');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('courier_invitations');
    }
};
```

- [ ] **Step 4: Run migrations**

Run: `php artisan migrate`
Expected: All 3 migrations run successfully

- [ ] **Step 5: Commit**

```bash
git add database/migrations/2026_07_09_000001_add_location_and_vehicle_fields_to_users_table.php database/migrations/2026_07_09_000002_create_courier_profiles_table.php database/migrations/2026_07_09_000003_create_courier_invitations_table.php
git commit -m "feat(kurir): add database migrations for courier management"
```

---

## Task 2: Models

**Files:**
- Create: `app/Models/CourierProfile.php`
- Create: `app/Models/CourierInvitation.php`
- Modify: `app/Models/User.php`

- [ ] **Step 1: Create CourierProfile model**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CourierProfile extends Model
{
    protected $fillable = [
        'user_id',
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
            'total_deliveries' => 'integer',
            'rating' => 'decimal:2',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isPending(): bool
    {
        return $this->invitation_status === 'pending';
    }

    public function isAccepted(): bool
    {
        return $this->invitation_status === 'accepted';
    }

    public function isRejected(): bool
    {
        return $this->invitation_status === 'rejected';
    }

    public function incrementDeliveries(): void
    {
        $this->increment('total_deliveries');
    }
}
```

- [ ] **Step 2: Create CourierInvitation model**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class CourierInvitation extends Model
{
    protected $fillable = [
        'invited_by',
        'courier_user_id',
        'phone',
        'name',
        'token',
        'status',
        'sent_at',
        'accepted_at',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
            'accepted_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function invitedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }

    public function courierUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'courier_user_id');
    }

    public function isPending(): bool
    {
        return $this->status === 'pending' && $this->expires_at->isFuture();
    }

    public function isExpired(): bool
    {
        return $this->status === 'expired' || $this->expires_at->isPast();
    }

    public function isAccepted(): bool
    {
        return $this->status === 'accepted';
    }

    public static function generateToken(): string
    {
        return Str::random(64);
    }
}
```

- [ ] **Step 3: Update User model - add relationships and fillable fields**

Read `app/Models/User.php` first, then add:

```php
// Add to fillable array (line 17):
#[Fillable(['name', 'email', 'password', 'phone', 'provider', 'provider_id', 'avatar', 'role', 'outlet_id', 'is_active', 'latitude', 'longitude', 'location_updated_at', 'vehicle_type', 'vehicle_plate', 'photo'])]

// Add to casts method (after line 37):
'location_updated_at' => 'datetime',
'latitude' => 'decimal:7',
'longitude' => 'decimal:7',

// Add relationships (after line 127):
public function courierProfile(): HasOne
{
    return $this->hasOne(CourierProfile::class);
}

public function courierInvitations(): HasMany
{
    return $this->hasMany(CourierInvitation::class, 'invited_by');
}

public function hasActiveLocation(): bool
{
    return $this->latitude !== null
        && $this->longitude !== null
        && $this->location_updated_at !== null
        && $this->location_updated_at->diffInMinutes(now()) <= 5;
}

public function activeDeliveryCount(): int
{
    return $this->courierDeliveries()
        ->whereIn('status', ['waiting_pickup', 'picked_up', 'delivering'])
        ->count();
}

public function canAcceptDelivery(): bool
{
    return $this->is_online
        && $this->is_active
        && $this->hasActiveLocation()
        && $this->activeDeliveryCount() < 3;
}
```

- [ ] **Step 4: Run tests to verify models work**

Run: `php artisan tinker --execute="echo 'Models loaded successfully';"`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add app/Models/CourierProfile.php app/Models/CourierInvitation.php app/Models/User.php
git commit -m "feat(kurir): add CourierProfile and CourierInvitation models"
```

---

## Task 3: CourierService

**Files:**
- Create: `app/Services/CourierService.php`
- Create: `tests/Feature/OwnerCourierManagementTest.php`

- [ ] **Step 1: Write failing test for createCourier**

```php
<?php

namespace Tests\Feature;

use App\Models\CourierProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OwnerCourierManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create(['role' => 'owner']);
    }

    public function test_owner_can_create_courier(): void
    {
        $response = $this->actingAs($this->owner)->post('/owner/couriers', [
            'name' => 'Budi Kurir',
            'phone' => '6281234567890',
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('users', [
            'name' => 'Budi Kurir',
            'phone' => '6281234567890',
            'role' => 'courier',
        ]);
        $courier = User::where('phone', '6281234567890')->first();
        $this->assertDatabaseHas('courier_profiles', [
            'user_id' => $courier->id,
            'invitation_status' => 'pending',
        ]);
    }

    public function test_owner_can_list_couriers(): void
    {
        $courier = User::factory()->create(['role' => 'courier']);
        CourierProfile::create(['user_id' => $courier->id, 'invitation_status' => 'accepted']);

        $response = $this->actingAs($this->owner)->get('/owner/couriers');

        $response->assertStatus(200);
    }

    public function test_owner_can_view_courier_detail(): void
    {
        $courier = User::factory()->create(['role' => 'courier']);
        CourierProfile::create(['user_id' => $courier->id, 'invitation_status' => 'accepted']);

        $response = $this->actingAs($this->owner)->get("/owner/couriers/{$courier->id}");

        $response->assertStatus(200);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/OwnerCourierManagementTest.php`
Expected: FAIL with "Route not found"

- [ ] **Step 3: Create CourierService**

```php
<?php

namespace App\Services;

use App\Models\CourierInvitation;
use App\Models\CourierProfile;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class CourierService
{
    public function __construct(
        private readonly CourierInvitationService $invitationService,
    ) {}

    public function createCourier(array $data, User $owner): User
    {
        return DB::transaction(function () use ($data, $owner) {
            $password = Str::random(16);

            $courier = User::create([
                'name' => $data['name'],
                'email' => $this->generateEmail($data['phone']),
                'password' => $password,
                'phone' => $data['phone'],
                'role' => 'courier',
                'is_active' => true,
                'is_online' => false,
                'vehicle_type' => $data['vehicle_type'] ?? null,
                'vehicle_plate' => $data['vehicle_plate'] ?? null,
                'photo' => $data['photo'] ?? null,
                'must_change_password' => true,
            ]);

            CourierProfile::create([
                'user_id' => $courier->id,
                'invitation_status' => 'pending',
                'invited_at' => now(),
            ]);

            $invitation = $this->invitationService->create($courier, $owner, $data['phone']);

            return $courier;
        });
    }

    public function getStats(): array
    {
        $total = User::where('role', 'courier')->count();
        $online = User::where('role', 'courier')->where('is_online', true)->count();
        $activeLocation = User::where('role', 'courier')
            ->whereNotNull('location_updated_at')
            ->where('location_updated_at', '>=', now()->subMinutes(5))
            ->count();

        return [
            'total' => $total,
            'online' => $online,
            'active_location' => $activeLocation,
        ];
    }

    public function getTodayDeliveryCount(): int
    {
        return \App\Models\Delivery::whereDate('created_at', today())->count();
    }

    private function generateEmail(string $phone): string
    {
        $base = 'courier.' . $phone . '@dombi.local';
        $email = $base;
        $counter = 1;

        while (User::where('email', $email)->exists()) {
            $email = 'courier.' . $phone . '.' . $counter . '@dombi.local';
            $counter++;
        }

        return $email;
    }
}
```

- [ ] **Step 4: Create CourierInvitationService**

```php
<?php

namespace App\Services;

use App\Models\CourierInvitation;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class CourierInvitationService
{
    public function __construct(
        private readonly GowaService $gowa,
    ) {}

    public function create(User $courier, User $owner, string $phone): CourierInvitation
    {
        $invitation = CourierInvitation::create([
            'invited_by' => $owner->id,
            'courier_user_id' => $courier->id,
            'phone' => $phone,
            'name' => $courier->name,
            'token' => CourierInvitation::generateToken(),
            'status' => 'pending',
            'sent_at' => now(),
            'expires_at' => now()->addDays(7),
        ]);

        $this->sendWhatsApp($invitation);

        return $invitation;
    }

    public function sendWhatsApp(CourierInvitation $invitation): bool
    {
        $message = $this->buildMessage($invitation);

        try {
            $sent = $this->gowa->sendText($invitation->phone, $message);

            if ($sent) {
                Log::info('Courier invitation sent', [
                    'invitation_id' => $invitation->id,
                    'phone' => $invitation->phone,
                ]);
            }

            return $sent;
        } catch (\Throwable $e) {
            Log::error('Failed to send courier invitation', [
                'invitation_id' => $invitation->id,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    private function buildMessage(CourierInvitation $invitation): string
    {
        $loginUrl = url("/courier/invite/{$invitation->token}");

        return <<<MESSAGE
        Halo {$invitation->name}! 👋

        Anda telah diundang sebagai kurir di Dombi.

        Download aplikasi dan login dengan link berikut:
        {$loginUrl}

        Link ini berlaku sampai {$invitation->expires_at->format('d M Y H:i')}.

        Terima kasih!
        MESSAGE;
    }
}
```

- [ ] **Step 5: Run test again**

Run: `php artisan test tests/Feature/OwnerCourierManagementTest.php`
Expected: PASS (routes not added yet, so still fails - but service should be valid)

- [ ] **Step 6: Commit**

```bash
git add app/Services/CourierService.php app/Services/CourierInvitationService.php tests/Feature/OwnerCourierManagementTest.php
git commit -m "feat(kurir): add CourierService and CourierInvitationService"
```

---

## Task 4: Owner Courier Controller & Routes

**Files:**
- Create: `app/Http/Controllers/Owner/CourierController.php`
- Create: `app/Http/Requests/Owner/StoreCourierRequest.php`
- Modify: `routes/web.php`

- [ ] **Step 1: Create StoreCourierRequest**

```php
<?php

namespace App\Http\Requests\Owner;

use Illuminate\Foundation\Http\FormRequest;

class StoreCourierRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->isOwner();
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:20', 'unique:users,phone'],
            'vehicle_type' => ['nullable', 'in:motorcycle,bicycle,car'],
            'vehicle_plate' => ['nullable', 'string', 'max:20'],
        ];
    }
}
```

- [ ] **Step 2: Create CourierController**

```php
<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Http\Requests\Owner\StoreCourierRequest;
use App\Models\CourierProfile;
use App\Models\Delivery;
use App\Models\User;
use App\Services\CourierService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CourierController extends Controller
{
    public function __construct(
        private readonly CourierService $courierService,
    ) {}

    public function index(): Response
    {
        $stats = $this->courierService->getStats();
        $todayDeliveries = $this->courierService->getTodayDeliveryCount();

        $couriers = User::query()
            ->where('role', 'courier')
            ->with('courierProfile')
            ->withCount([
                'courierDeliveries as active_deliveries_count' => fn ($query) => $query->whereIn('status', ['waiting_pickup', 'picked_up', 'delivering']),
                'courierDeliveries as today_deliveries_count' => fn ($query) => $query->whereDate('created_at', today()),
            ])
            ->latest()
            ->paginate(15);

        return Inertia::render('owner/couriers/index', [
            'couriers' => $couriers,
            'stats' => $stats,
            'todayDeliveries' => $todayDeliveries,
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('owner/couriers/create');
    }

    public function store(StoreCourierRequest $request): RedirectResponse
    {
        $courier = $this->courierService->createCourier(
            $request->validated(),
            $request->user(),
        );

        return redirect()
            ->route('owner.couriers.index')
            ->with('success', 'Kurir berhasil ditambahkan. Undangan WhatsApp telah dikirim.');
    }

    public function show(User $courier): Response
    {
        $courier->load('courierProfile');
        $courier->loadCount([
            'courierDeliveries as total_deliveries_count',
            'courierDeliveries as today_deliveries_count' => fn ($query) => $query->whereDate('created_at', today()),
            'courierDeliveries as active_deliveries_count' => fn ($query) => $query->whereIn('status', ['waiting_pickup', 'picked_up', 'delivering']),
        ]);

        $recentDeliveries = Delivery::where('courier_id', $courier->id)
            ->with('order:id,order_code,total_amount')
            ->latest()
            ->limit(10)
            ->get();

        return Inertia::render('owner/couriers/show', [
            'courier' => $courier,
            'recentDeliveries' => $recentDeliveries,
        ]);
    }

    public function update(Request $request, User $courier): RedirectResponse
    {
        $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['sometimes', 'string', 'max:20', 'unique:users,phone,' . $courier->id],
            'vehicle_type' => ['nullable', 'in:motorcycle,bicycle,car'],
            'vehicle_plate' => ['nullable', 'string', 'max:20'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $courier->update($request->only(['name', 'phone', 'vehicle_type', 'vehicle_plate', 'is_active']));

        return redirect()
            ->route('owner.couriers.show', $courier)
            ->with('success', 'Data kurir berhasil diperbarui.');
    }
}
```

- [ ] **Step 3: Add routes to web.php**

Add after line 256 (after delivery-tiers routes):

```php
Route::resource('couriers', \App\Http\Controllers\Owner\CourierController::class)->only(['index', 'create', 'store', 'show', 'update']);
```

- [ ] **Step 4: Run test**

Run: `php artisan test tests/Feature/OwnerCourierManagementTest.php`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Owner/CourierController.php app/Http/Requests/Owner/StoreCourierRequest.php routes/web.php
git commit -m "feat(kurir): add owner courier controller and routes"
```

---

## Task 5: Location Tracking

**Files:**
- Create: `app/Http/Controllers/Courier/LocationController.php`
- Create: `app/Services/CourierLocationService.php`
- Create: `tests/Feature/CourierLocationTrackingTest.php`

- [ ] **Step 1: Write failing test for location update**

```php
<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CourierLocationTrackingTest extends TestCase
{
    use RefreshDatabase;

    private User $courier;

    protected function setUp(): void
    {
        parent::setUp();
        $this->courier = User::factory()->create(['role' => 'courier', 'is_online' => true]);
    }

    public function test_courier_can_update_location(): void
    {
        $response = $this->actingAs($this->courier)->post('/courier/location', [
            'latitude' => -7.0568000,
            'longitude' => 110.4381000,
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('users', [
            'id' => $this->courier->id,
            'latitude' => -7.0568000,
            'longitude' => 110.4381000,
        ]);
    }

    public function test_location_updated_at_is_set(): void
    {
        $this->actingAs($this->courier)->post('/courier/location', [
            'latitude' => -7.0568000,
            'longitude' => 110.4381000,
        ]);

        $this->courier->refresh();
        $this->assertNotNull($this->courier->location_updated_at);
        $this->assertTrue($this->courier->location_updated_at->diffInSeconds(now()) < 5);
    }

    public function test_non_courier_cannot_update_location(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);

        $response = $this->actingAs($customer)->post('/courier/location', [
            'latitude' => -7.0568000,
            'longitude' => 110.4381000,
        ]);

        $response->assertForbidden();
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `php artisan test tests/Feature/CourierLocationTrackingTest.php`
Expected: FAIL with "Route not found"

- [ ] **Step 3: Create CourierLocationService**

```php
<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Collection;

class CourierLocationService
{
    public function updateLocation(User $courier, float $latitude, float $longitude): void
    {
        $courier->update([
            'latitude' => $latitude,
            'longitude' => $longitude,
            'location_updated_at' => now(),
        ]);
    }

    public function getNearestCouriers(float $outletLat, float $outletLng, int $limit = 10): Collection
    {
        return User::query()
            ->where('role', 'courier')
            ->where('is_online', true)
            ->where('is_active', true)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->where('location_updated_at', '>=', now()->subMinutes(5))
            ->selectRaw("
                *,
                (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude)))) AS distance
            ", [$outletLat, $outletLng, $outletLat])
            ->having('distance', '<=', 50)
            ->orderBy('distance')
            ->limit($limit)
            ->get();
    }

    public function hasActiveLocation(User $courier): bool
    {
        return $courier->latitude !== null
            && $courier->longitude !== null
            && $courier->location_updated_at !== null
            && $courier->location_updated_at->diffInMinutes(now()) <= 5;
    }
}
```

- [ ] **Step 4: Create LocationController**

```php
<?php

namespace App\Http\Controllers\Courier;

use App\Http\Controllers\Controller;
use App\Services\CourierLocationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LocationController extends Controller
{
    public function __construct(
        private readonly CourierLocationService $locationService,
    ) {}

    public function update(Request $request): JsonResponse
    {
        $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $user = $request->user();

        if (!$user->isCourier()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $this->locationService->updateLocation(
            $user,
            $request->input('latitude'),
            $request->input('longitude'),
        );

        return response()->json(['message' => 'Location updated']);
    }
}
```

- [ ] **Step 5: Add route to web.php**

Add after line 358 (after courier shift routes):

```php
Route::post('/location', [LocationController::class, 'update'])->name('location.update');
```

Add import at top of file:

```php
use App\Http\Controllers\Courier\LocationController;
```

- [ ] **Step 6: Run test**

Run: `php artisan test tests/Feature/CourierLocationTrackingTest.php`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add app/Http/Controllers/Courier/LocationController.php app/Services/CourierLocationService.php tests/Feature/CourierLocationTrackingTest.php routes/web.php
git commit -m "feat(kurir): add location tracking for couriers"
```

---

## Task 6: Nearest Courier Assignment

**Files:**
- Create: `tests/Feature/NearestCourierAssignmentTest.php`
- Create: `tests/Unit/CourierLocationServiceTest.php`

- [ ] **Step 1: Write unit test for Haversine distance**

```php
<?php

namespace Tests\Unit;

use App\Models\User;
use App\Services\CourierLocationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CourierLocationServiceTest extends TestCase
{
    use RefreshDatabase;

    private CourierLocationService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new CourierLocationService();
    }

    public function test_nearest_couriers_sorted_by_distance(): void
    {
        $outletLat = -7.0568000;
        $outletLng = 110.4381000;

        $courier1 = User::factory()->create([
            'role' => 'courier',
            'is_online' => true,
            'is_active' => true,
            'latitude' => -7.0570000,
            'longitude' => 110.4383000,
            'location_updated_at' => now(),
        ]);

        $courier2 = User::factory()->create([
            'role' => 'courier',
            'is_online' => true,
            'is_active' => true,
            'latitude' => -7.0600000,
            'longitude' => 110.4400000,
            'location_updated_at' => now(),
        ]);

        $courier3 = User::factory()->create([
            'role' => 'courier',
            'is_online' => true,
            'is_active' => true,
            'latitude' => -7.0550000,
            'longitude' => 110.4370000,
            'location_updated_at' => now(),
        ]);

        $nearest = $this->service->getNearestCouriers($outletLat, $outletLng);

        $this->assertCount(3, $nearest);
        $this->assertEquals($courier3->id, $nearest->first()->id);
    }

    public function test_couriers_without_active_location_excluded(): void
    {
        $outletLat = -7.0568000;
        $outletLng = 110.4381000;

        User::factory()->create([
            'role' => 'courier',
            'is_online' => true,
            'is_active' => true,
            'latitude' => -7.0570000,
            'longitude' => 110.4383000,
            'location_updated_at' => now()->subMinutes(10),
        ]);

        $nearest = $this->service->getNearestCouriers($outletLat, $outletLng);

        $this->assertCount(0, $nearest);
    }

    public function test_offline_couriers_excluded(): void
    {
        $outletLat = -7.0568000;
        $outletLng = 110.4381000;

        User::factory()->create([
            'role' => 'courier',
            'is_online' => false,
            'is_active' => true,
            'latitude' => -7.0570000,
            'longitude' => 110.4383000,
            'location_updated_at' => now(),
        ]);

        $nearest = $this->service->getNearestCouriers($outletLat, $outletLng);

        $this->assertCount(0, $nearest);
    }
}
```

- [ ] **Step 2: Run test**

Run: `php artisan test tests/Unit/CourierLocationServiceTest.php`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/Unit/CourierLocationServiceTest.php
git commit -m "test(kurir): add unit tests for nearest courier calculation"
```

---

## Task 7: Frontend - Owner Courier Pages

**Files:**
- Create: `resources/js/pages/owner/couriers/index.tsx`
- Create: `resources/js/pages/owner/couriers/create.tsx`
- Create: `resources/js/pages/owner/couriers/show.tsx`
- Create: `resources/js/components/owner/courier-stats.tsx`

- [ ] **Step 1: Create courier-stats component**

```tsx
import { Users, Wifi, MapPin, Truck } from 'lucide-react';

interface CourierStatsProps {
    stats: {
        total: number;
        online: number;
        active_location: number;
    };
    todayDeliveries: number;
}

export default function CourierStats({ stats, todayDeliveries }: CourierStatsProps) {
    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-white p-4">
                <div className="flex items-center gap-2 text-xs text-text-muted">
                    <Users className="h-4 w-4 text-text-subtle" />
                    Total Kurir
                </div>
                <div className="mt-2 text-2xl font-bold text-text">{stats.total}</div>
            </div>
            <div className="rounded-lg border border-border bg-white p-4">
                <div className="flex items-center gap-2 text-xs text-text-muted">
                    <Wifi className="h-4 w-4 text-emerald-500" />
                    Online
                </div>
                <div className="mt-2 text-2xl font-bold text-text">{stats.online}</div>
            </div>
            <div className="rounded-lg border border-border bg-white p-4">
                <div className="flex items-center gap-2 text-xs text-text-muted">
                    <MapPin className="h-4 w-4 text-blue-500" />
                    Lokasi Aktif
                </div>
                <div className="mt-2 text-2xl font-bold text-text">{stats.active_location}</div>
            </div>
            <div className="rounded-lg border border-border bg-white p-4">
                <div className="flex items-center gap-2 text-xs text-text-muted">
                    <Truck className="h-4 w-4 text-amber-500" />
                    Delivery Hari Ini
                </div>
                <div className="mt-2 text-2xl font-bold text-text">{todayDeliveries}</div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Create index page**

```tsx
import { Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import CourierStats from '@/components/owner/courier-stats';
import { buttonVariants } from '@/components/ui/button';
import Pagination from '@/components/ui/pagination';
import StatusBadge from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

export default function CouriersIndex({ couriers, stats, todayDeliveries }: any) {
    return (
        <OwnerPageShell
            title="Kurir"
            subtitle="Manajemen kurir dan monitoring"
            headerRight={
                <Link href="/owner/couriers/create" className={cn(buttonVariants({ variant: 'primary', size: 'md' }))}>
                    + Tambah Kurir
                </Link>
            }
        >
            <CourierStats stats={stats} todayDeliveries={todayDeliveries} />

            <div className="mt-6 space-y-3">
                {couriers.data.length === 0 && (
                    <div className="rounded-lg border border-border bg-white p-10 text-center">
                        <p className="text-sm text-text-muted">Belum ada kurir</p>
                        <Link href="/owner/couriers/create" className="mt-2 inline-block text-sm font-semibold text-primary">
                            + Tambah Kurir
                        </Link>
                    </div>
                )}
                {couriers.data.map((courier: any) => {
                    const profile = courier.courier_profile;
                    const isActive = courier.is_online && courier.location_updated_at &&
                        new Date(courier.location_updated_at).getTime() > Date.now() - 5 * 60 * 1000;

                    return (
                        <div
                            key={courier.id}
                            className="cursor-pointer rounded-lg border border-border bg-white p-4 transition-all duration-200"
                            onClick={() => router.visit(`/owner/couriers/${courier.id}`)}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-surface-muted flex items-center justify-center">
                                        {courier.photo ? (
                                            <img src={courier.photo} alt={courier.name} className="h-10 w-10 rounded-full object-cover" />
                                        ) : (
                                            <span className="text-sm font-bold text-text-muted">{courier.name.charAt(0)}</span>
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-text">{courier.name}</span>
                                            <StatusBadge variant={courier.is_online ? 'success' : 'neutral'} size="sm">
                                                {courier.is_online ? 'Online' : 'Offline'}
                                            </StatusBadge>
                                            {isActive && (
                                                <StatusBadge variant="info" size="sm">Lokasi Aktif</StatusBadge>
                                            )}
                                        </div>
                                        <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
                                            {courier.vehicle_type && (
                                                <span>{courier.vehicle_type} {courier.vehicle_plate && `(${courier.vehicle_plate})`}</span>
                                            )}
                                            <span>{courier.active_deliveries_count}/3 order aktif</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-bold text-text">{courier.today_deliveries_count}</div>
                                    <div className="text-xs text-text-muted">delivery hari ini</div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <Pagination links={couriers.links} />
        </OwnerPageShell>
    );
}
```

- [ ] **Step 3: Create create page**

```tsx
import { useForm } from '@inertiajs/react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function CourierCreate() {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        phone: '',
        vehicle_type: '' as string,
        vehicle_plate: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/owner/couriers');
    };

    return (
        <OwnerPageShell title="Tambah Kurir" subtitle="Undang kurir baru via WhatsApp">
            <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
                <div>
                    <label className="block text-sm font-medium text-text">Nama</label>
                    <input
                        type="text"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                        required
                    />
                    {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-text">No. WhatsApp</label>
                    <input
                        type="text"
                        value={data.phone}
                        onChange={(e) => setData('phone', e.target.value)}
                        placeholder="628xxxxxxxxxx"
                        className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                        required
                    />
                    {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-text">Jenis Kendaraan (opsional)</label>
                    <select
                        value={data.vehicle_type}
                        onChange={(e) => setData('vehicle_type', e.target.value)}
                        className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                    >
                        <option value="">Pilih kendaraan</option>
                        <option value="motorcycle">Motor</option>
                        <option value="bicycle">Sepeda</option>
                        <option value="car">Mobil</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-text">Plat Nomor (opsional)</label>
                    <input
                        type="text"
                        value={data.vehicle_plate}
                        onChange={(e) => setData('vehicle_plate', e.target.value)}
                        className="mt-1 block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                    />
                </div>

                <button
                    type="submit"
                    disabled={processing}
                    className={cn(buttonVariants({ variant: 'primary', size: 'md' }))}
                >
                    {processing ? 'Mengirim...' : 'Kirim Undangan WhatsApp'}
                </button>
            </form>
        </OwnerPageShell>
    );
}
```

- [ ] **Step 4: Create show page**

```tsx
import { Link, router, usePage } from '@inertiajs/react';
import OwnerPageShell from '@/components/owner/owner-page-shell';
import StatusBadge from '@/components/ui/status-badge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function CourierShow({ courier, recentDeliveries }: any) {
    const profile = courier.courier_profile;
    const isActive = courier.is_online && courier.location_updated_at &&
        new Date(courier.location_updated_at).getTime() > Date.now() - 5 * 60 * 1000;

    return (
        <OwnerPageShell title={courier.name} subtitle="Detail kurir">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
                <div className="space-y-4">
                    {/* Status Card */}
                    <div className="rounded-lg border border-border bg-white p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-full bg-surface-muted flex items-center justify-center">
                                    {courier.photo ? (
                                        <img src={courier.photo} alt={courier.name} className="h-12 w-12 rounded-full object-cover" />
                                    ) : (
                                        <span className="text-lg font-bold text-text-muted">{courier.name.charAt(0)}</span>
                                    )}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-bold text-text">{courier.name}</h2>
                                        <StatusBadge variant={courier.is_online ? 'success' : 'neutral'}>
                                            {courier.is_online ? 'Online' : 'Offline'}
                                        </StatusBadge>
                                        {isActive && <StatusBadge variant="info">Lokasi Aktif</StatusBadge>}
                                    </div>
                                    <p className="text-sm text-text-muted">{courier.phone}</p>
                                </div>
                            </div>
                        </div>

                        {courier.vehicle_type && (
                            <div className="mt-3 flex items-center gap-2 text-sm text-text-muted">
                                <span className="capitalize">{courier.vehicle_type}</span>
                                {courier.vehicle_plate && <span>({courier.vehicle_plate})</span>}
                            </div>
                        )}
                    </div>

                    {/* Delivery History */}
                    <div className="rounded-lg border border-border bg-white p-4">
                        <h3 className="mb-3 text-sm font-bold text-text">Riwayat Delivery</h3>
                        {recentDeliveries.length === 0 ? (
                            <p className="text-sm text-text-muted">Belum ada delivery</p>
                        ) : (
                            <div className="space-y-2">
                                {recentDeliveries.map((delivery: any) => (
                                    <div key={delivery.id} className="flex items-center justify-between rounded-lg bg-surface-muted p-3">
                                        <div>
                                            <div className="text-sm font-medium text-text">{delivery.order?.order_code}</div>
                                            <div className="text-xs text-text-muted">
                                                {new Date(delivery.created_at).toLocaleDateString('id-ID')}
                                            </div>
                                        </div>
                                        <StatusBadge variant={delivery.status === 'completed' ? 'success' : delivery.status === 'failed' ? 'danger' : 'warning'} size="sm">
                                            {delivery.status}
                                        </StatusBadge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar Stats */}
                <aside className="space-y-3">
                    <div className="rounded-lg border border-border bg-white p-4">
                        <div className="text-xs text-text-muted">Delivery Aktif</div>
                        <div className="mt-1 text-2xl font-bold text-text">{courier.active_deliveries_count}/3</div>
                    </div>
                    <div className="rounded-lg border border-border bg-white p-4">
                        <div className="text-xs text-text-muted">Delivery Hari Ini</div>
                        <div className="mt-1 text-2xl font-bold text-text">{courier.today_deliveries_count}</div>
                    </div>
                    <div className="rounded-lg border border-border bg-white p-4">
                        <div className="text-xs text-text-muted">Total Delivery</div>
                        <div className="mt-1 text-2xl font-bold text-text">{courier.total_deliveries_count}</div>
                    </div>
                    {profile?.rating && (
                        <div className="rounded-lg border border-border bg-white p-4">
                            <div className="text-xs text-text-muted">Rating</div>
                            <div className="mt-1 text-2xl font-bold text-text">{profile.rating}</div>
                        </div>
                    )}
                </aside>
            </div>
        </OwnerPageShell>
    );
}
```

- [ ] **Step 5: Run frontend type check**

Run: `npm run types:check`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add resources/js/pages/owner/couriers/ resources/js/components/owner/courier-stats.tsx
git commit -m "feat(kurir): add owner courier frontend pages"
```

---

## Task 8: Assign Courier at Outlet

**Files:**
- Create: `resources/js/components/outlet/assign-courier-sheet.tsx`
- Modify: `resources/js/pages/outlet/orders/show.tsx`

- [ ] **Step 1: Create assign-courier-sheet component**

```tsx
import { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { MapPin, Truck, X } from 'lucide-react';
import StatusBadge from '@/components/ui/status-badge';

interface Courier {
    id: number;
    name: string;
    phone: string;
    vehicle_type: string | null;
    vehicle_plate: string | null;
    photo: string | null;
    distance: number;
    active_delivery_count: number;
}

interface AssignCourierSheetProps {
    outletId: number;
    orderId: number;
    isOpen: boolean;
    onClose: () => void;
}

export default function AssignCourierSheet({ outletId, orderId, isOpen, onClose }: AssignCourierSheetProps) {
    const [couriers, setCouriers] = useState<Courier[]>([]);
    const [loading, setLoading] = useState(false);
    const [assigning, setAssigning] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchCouriers();
            const interval = setInterval(fetchCouriers, 10000);
            return () => clearInterval(interval);
        }
    }, [isOpen, outletId]);

    const fetchCouriers = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/outlets/${outletId}/nearest-couriers`);
            const data = await response.json();
            setCouriers(data);
        } catch (error) {
            console.error('Failed to fetch couriers:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAssign = async (courierId: number) => {
        setAssigning(courierId);
        try {
            router.post(`/orders/${orderId}/assign-courier`, { courier_id: courierId }, {
                onSuccess: () => onClose(),
                onFinish: () => setAssigning(null),
            });
        } catch (error) {
            console.error('Failed to assign courier:', error);
            setAssigning(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/50">
            <div className="fixed bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white">
                <div className="sticky top-0 bg-white p-4 border-b border-border">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-text">Pilih Kurir</h2>
                        <button onClick={onClose} className="rounded-full p-2 hover:bg-surface-muted">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <p className="mt-1 text-sm text-text-muted">Diurutkan dari yang terdekat</p>
                </div>

                <div className="p-4 space-y-3">
                    {loading && couriers.length === 0 && (
                        <p className="text-center text-sm text-text-muted">Memuat kurir...</p>
                    )}

                    {!loading && couriers.length === 0 && (
                        <p className="text-center text-sm text-text-muted">Tidak ada kurir tersedia</p>
                    )}

                    {couriers.map((courier) => (
                        <div
                            key={courier.id}
                            className="rounded-lg border border-border bg-white p-4"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-surface-muted flex items-center justify-center">
                                        {courier.photo ? (
                                            <img src={courier.photo} alt={courier.name} className="h-10 w-10 rounded-full object-cover" />
                                        ) : (
                                            <span className="text-sm font-bold text-text-muted">{courier.name.charAt(0)}</span>
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-text">{courier.name}</span>
                                            <span className="text-xs text-text-muted">{courier.active_delivery_count}/3 order</span>
                                        </div>
                                        <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
                                            {courier.vehicle_type && (
                                                <span className="capitalize">{courier.vehicle_type}</span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <MapPin className="h-3 w-3" />
                                                {courier.distance.toFixed(1)} km
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleAssign(courier.id)}
                                    disabled={assigning === courier.id || courier.active_delivery_count >= 3}
                                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
                                >
                                    {assigning === courier.id ? 'Memilih...' : 'Pilih'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Add API endpoint for nearest couriers**

Add to `routes/web.php` inside outlet middleware group:

```php
Route::get('/api/outlets/{outlet}/nearest-couriers', [App\Http\Controllers\Outlet\CourierController::class, 'nearestCouriers'])->name('outlets.nearest-couriers');
```

- [ ] **Step 3: Create Outlet CourierController**

```php
<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\Outlet;
use App\Services\CourierLocationService;
use Illuminate\Http\JsonResponse;

class CourierController extends Controller
{
    public function __construct(
        private readonly CourierLocationService $locationService,
    ) {}

    public function nearestCouriers(Outlet $outlet): JsonResponse
    {
        $couriers = $this->locationService->getNearestCouriers(
            (float) $outlet->latitude,
            (float) $outlet->longitude,
        );

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
}
```

- [ ] **Step 4: Run frontend type check**

Run: `npm run types:check`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add resources/js/components/outlet/assign-courier-sheet.tsx app/Http/Controllers/Outlet/CourierController.php routes/web.php
git commit -m "feat(kurir): add assign courier sheet at outlet"
```

---

## Task 9: Testing & QA

**Files:**
- Run all tests
- Manual testing checklist

- [ ] **Step 1: Run all tests**

Run: `php artisan test`
Expected: All tests pass

- [ ] **Step 2: Run frontend lint and type check**

Run: `npm run lint:check && npm run types:check`
Expected: No errors

- [ ] **Step 3: Manual testing - Owner creates courier**

1. Login as owner
2. Go to `/owner/couriers`
3. Click "+ Tambah Kurir"
4. Fill form and submit
5. Verify courier appears in list with "Pending" status

- [ ] **Step 4: Manual testing - Location tracking**

1. Login as courier
2. Allow location permission
3. Verify GPS updates every 30 seconds
4. Check location appears in owner dashboard

- [ ] **Step 5: Manual testing - Assign courier**

1. Login as outlet
2. Open order ready for pickup
3. Click "Assign Kurir"
4. Verify nearest couriers appear sorted by distance
5. Select courier and verify assignment

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(kurir): complete kurir management feature"
```

---

## Spec Coverage Check

| Requirement | Task |
|-------------|------|
| Owner can add couriers via WhatsApp | Task 3, 4 |
| All couriers can be assigned to any outlet | Task 6, 8 |
| Couriers sorted by nearest location | Task 6, 8 |
| Real-time location (last 5 min) | Task 5 |
| Max 3 active orders per courier | Task 2, 6 |
| Owner dashboard shows status/activity | Task 7 |
