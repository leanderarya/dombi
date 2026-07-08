# Delivery Pricing Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner manage delivery fee tiers (ongkir) via a database-backed admin UI instead of hardcoded config.

**Architecture:** Move delivery tiers from `config/delivery.php` to a `delivery_tiers` database table. Owner can CRUD tiers via `/owner/delivery-tiers` page. `DeliveryPricingService` reads from DB with config fallback. Each tier defines a distance range and fee.

**Tech Stack:** Laravel 13 + Inertia.js + React 19 + TypeScript + Tailwind CSS v4

---

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `database/migrations/2026_07_07_120000_create_delivery_tiers_table.php` | Migration for delivery_tiers table |
| `database/seeders/DeliveryTierSeeder.php` | Seed current config values |
| `database/factories/DeliveryTierFactory.php` | Factory for tests |
| `app/Models/DeliveryTier.php` | Eloquent model |
| `app/Http/Controllers/Owner/DeliveryTierController.php` | CRUD controller |
| `app/Http/Requests/Owner/StoreDeliveryTierRequest.php` | Validation for store/update |
| `resources/js/pages/owner/delivery-tiers/index.tsx` | Tier list + inline edit page |
| `tests/Feature/DeliveryTierTest.php` | CRUD tests |
| `tests/Feature/DeliveryPricingFromDbTest.php` | Integration test |

### Modified Files
| File | Change |
|---|---|
| `app/Services/DeliveryPricingService.php` | Read from DB instead of config |
| `routes/web.php` | Add delivery-tier routes |
| `resources/js/layouts/owner-layout.tsx` | Add nav item for delivery tiers |

---

### Task 1: Database Migration

**Files:**
- Create: `database/migrations/2026_07_07_120000_create_delivery_tiers_table.php`

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
        Schema::create('delivery_tiers', function (Blueprint $table) {
            $table->id();
            $table->decimal('min_km', 6, 2)->default(0);
            $table->decimal('max_km', 6, 2);
            $table->decimal('fee', 10, 2);
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->index(['is_active', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_tiers');
    }
};
```

- [ ] **Step 2: Run migration**

Run: `php artisan migrate`

- [ ] **Step 3: Commit**

```bash
git add database/migrations/*_create_delivery_tiers_table.php
git commit -m "feat: add delivery_tiers table"
```

---

### Task 2: Model

**Files:**
- Create: `app/Models/DeliveryTier.php`

- [ ] **Step 1: Create model**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class DeliveryTier extends Model
{
    protected $fillable = [
        'min_km',
        'max_km',
        'fee',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'min_km' => 'decimal:2',
            'max_km' => 'decimal:2',
            'fee' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true)->orderBy('sort_order');
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('sort_order');
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/Models/DeliveryTier.php
git commit -m "feat: add DeliveryTier model"
```

---

### Task 3: Seeder

**Files:**
- Create: `database/seeders/DeliveryTierSeeder.php`

- [ ] **Step 1: Create seeder with current config values**

```php
<?php

namespace Database\Seeders;

use App\Models\DeliveryTier;
use Illuminate\Database\Seeder;

class DeliveryTierSeeder extends Seeder
{
    public function run(): void
    {
        $tiers = [
            ['min_km' => 0, 'max_km' => 3,  'fee' => 5000,  'sort_order' => 1],
            ['min_km' => 3, 'max_km' => 5,  'fee' => 8000,  'sort_order' => 2],
            ['min_km' => 5, 'max_km' => 8,  'fee' => 12000, 'sort_order' => 3],
            ['min_km' => 8, 'max_km' => 10, 'fee' => 15000, 'sort_order' => 4],
        ];

        foreach ($tiers as $tier) {
            DeliveryTier::create($tier);
        }
    }
}
```

- [ ] **Step 2: Run seeder**

Run: `php artisan db:seed --class=DeliveryTierSeeder`

- [ ] **Step 3: Commit**

```bash
git add database/seeders/DeliveryTierSeeder.php
git commit -m "feat: seed delivery tiers from config"
```

---

### Task 4: Update DeliveryPricingService

**Files:**
- Modify: `app/Services/DeliveryPricingService.php`

- [ ] **Step 1: Update service to read from DB with config fallback**

Replace the entire file:

```php
<?php

namespace App\Services;

use App\Models\DeliveryTier;
use App\Services\Concerns\CalculatesDistance;

class DeliveryPricingService
{
    use CalculatesDistance;

    public function __construct(
        private readonly OutletAssignmentService $outletAssignmentService,
    ) {}

    public function quote(float $customerLat, float $customerLng, float $outletLat, float $outletLng): array
    {
        $distanceKm = round($this->calculateDistance(
            $customerLat, $customerLng, $outletLat, $outletLng
        ), 2);

        $tiers = $this->loadTiers();

        foreach ($tiers as $tier) {
            if ($distanceKm <= $tier['max_km']) {
                return [
                    'distance_km' => $distanceKm,
                    'delivery_fee' => (float) $tier['fee'],
                    'is_serviceable' => true,
                ];
            }
        }

        return [
            'distance_km' => $distanceKm,
            'delivery_fee' => 0.0,
            'is_serviceable' => false,
        ];
    }

    /**
     * Load tiers from DB, fallback to config.
     */
    private function loadTiers(): array
    {
        $dbTiers = DeliveryTier::active()->get();

        if ($dbTiers->isNotEmpty()) {
            return $dbTiers->map(fn (DeliveryTier $t) => [
                'min_km' => (float) $t->min_km,
                'max_km' => (float) $t->max_km,
                'fee' => (float) $t->fee,
            ])->all();
        }

        return config('delivery.tiers', []);
    }
}
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `php artisan test --filter=DeliveryPricing`
Expected: All existing tests pass (service now reads seeded DB data which matches config)

- [ ] **Step 3: Commit**

```bash
git add app/Services/DeliveryPricingService.php
git commit -m "feat: read delivery tiers from DB with config fallback"
```

---

### Task 5: Form Request

**Files:**
- Create: `app/Http/Requests/Owner/StoreDeliveryTierRequest.php`

- [ ] **Step 1: Create form request**

```php
<?php

namespace App\Http\Requests\Owner;

use Illuminate\Foundation\Http\FormRequest;

class StoreDeliveryTierRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isOwner() ?? false;
    }

    public function rules(): array
    {
        return [
            'min_km' => ['required', 'numeric', 'min:0'],
            'max_km' => ['required', 'numeric', 'gt:min_km'],
            'fee' => ['required', 'numeric', 'min:0'],
            'is_active' => ['boolean'],
            'sort_order' => ['integer', 'min:0'],
        ];
    }

    public function messages(): array
    {
        return [
            'max_km.gt' => 'Jarak maksimal harus lebih besar dari jarak minimal.',
        ];
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/Http/Requests/Owner/StoreDeliveryTierRequest.php
git commit -m "feat: add StoreDeliveryTierRequest validation"
```

---

### Task 6: Controller

**Files:**
- Create: `app/Http/Controllers/Owner/DeliveryTierController.php`

- [ ] **Step 1: Create CRUD controller**

```php
<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Http\Requests\Owner\StoreDeliveryTierRequest;
use App\Models\DeliveryTier;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class DeliveryTierController extends Controller
{
    public function index(): Response
    {
        $tiers = DeliveryTier::ordered()->get();

        return Inertia::render('owner/delivery-tiers/index', [
            'tiers' => $tiers,
        ]);
    }

    public function store(StoreDeliveryTierRequest $request): RedirectResponse
    {
        DeliveryTier::create($request->validated());

        return redirect()->route('owner.delivery-tiers.index')->with('success', 'Tier ongkir berhasil ditambahkan.');
    }

    public function update(StoreDeliveryTierRequest $request, DeliveryTier $tier): RedirectResponse
    {
        $tier->update($request->validated());

        return redirect()->route('owner.delivery-tiers.index')->with('success', 'Tier ongkir berhasil diperbarui.');
    }

    public function destroy(DeliveryTier $tier): RedirectResponse
    {
        $tier->delete();

        return redirect()->route('owner.delivery-tiers.index')->with('success', 'Tier ongkir berhasil dihapus.');
    }

    public function toggle(DeliveryTier $tier): RedirectResponse
    {
        $tier->update(['is_active' => ! $tier->is_active]);

        return redirect()->route('owner.delivery-tiers.index');
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/Http/Controllers/Owner/DeliveryTierController.php
git commit -m "feat: add DeliveryTierController CRUD"
```

---

### Task 7: Routes

**Files:**
- Modify: `routes/web.php`

- [ ] **Step 1: Add import at top of file**

Add after existing owner controller imports:

```php
use App\Http\Controllers\Owner\DeliveryTierController as OwnerDeliveryTierController;
```

- [ ] **Step 2: Add delivery-tier routes under owner group**

Find the owner route group and add after the pricing routes (around line 240):

```php
Route::resource('delivery-tiers', OwnerDeliveryTierController::class)->except(['create', 'show', 'edit']);
Route::patch('delivery-tiers/{tier}/toggle', [OwnerDeliveryTierController::class, 'toggle'])->name('delivery-tiers.toggle');
```

- [ ] **Step 3: Commit**

```bash
git add routes/web.php
git commit -m "feat: add delivery-tier routes"
```

---

### Task 8: Frontend Page

**Files:**
- Create: `resources/js/pages/owner/delivery-tiers/index.tsx`

- [ ] **Step 1: Create the delivery tiers management page**

```tsx
import { Head, router, useForm } from '@inertiajs/react';
import { Edit2, GripVertical, Plus, Trash2, Truck } from 'lucide-react';
import { useState } from 'react';
import OwnerLayout from '@/layouts/owner-layout';
import { formatCurrency } from '@/lib/format';

interface DeliveryTier {
    id: number;
    min_km: number;
    max_km: number;
    fee: number;
    is_active: boolean;
    sort_order: number;
}

export default function DeliveryTiersIndex({ tiers }: { tiers: DeliveryTier[] }) {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showForm, setShowForm] = useState(false);

    return (
        <OwnerLayout>
            <Head title="Tier Ongkir" />

            <div className="mx-auto max-w-3xl">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-text">Pengaturan Ongkir</h1>
                        <p className="mt-1 text-sm text-text-muted">Kelola tarif pengiriman berdasarkan jarak</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => { setShowForm(true); setEditingId(null); }}
                        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white active:opacity-80"
                    >
                        <Plus className="h-4 w-4" />
                        Tambah Tier
                    </button>
                </div>

                {/* Tier List */}
                <div className="rounded-xl border border-border bg-white">
                    <div className="grid grid-cols-12 gap-4 border-b border-border px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-text-subtle">
                        <div className="col-span-1" />
                        <div className="col-span-3">Jarak</div>
                        <div className="col-span-3">Tarif</div>
                        <div className="col-span-2">Status</div>
                        <div className="col-span-3 text-right">Aksi</div>
                    </div>

                    {tiers.length === 0 ? (
                        <div className="px-4 py-10 text-center">
                            <Truck className="mx-auto h-8 w-8 text-text-subtle" />
                            <p className="mt-2 text-sm text-text-muted">Belum ada tier ongkir</p>
                            <p className="mt-1 text-xs text-text-subtle">Tambah tier untuk mengatur tarif pengiriman</p>
                        </div>
                    ) : (
                        tiers.map((tier) => (
                            <TierRow
                                key={tier.id}
                                tier={tier}
                                isEditing={editingId === tier.id}
                                onEdit={() => { setEditingId(tier.id); setShowForm(true); }}
                                onCancel={() => { setEditingId(null); setShowForm(false); }}
                            />
                        ))
                    )}
                </div>

                {/* Info box */}
                <div className="mt-4 rounded-xl border border-border bg-white p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-text-subtle">Cara Kerja</h3>
                    <ul className="mt-2 space-y-1.5 text-xs text-text-muted">
                        <li>Tier diurutkan berdasarkan jarak (sort_order). Sistem mencocokkan dari tier pertama.</li>
                        <li>Jika jarak pelanggan melebihi tier terakhir, pesanan dianggap di luar jangkauan.</li>
                        <li>Nonaktifkan tier untuk menonaktifkan sementara tanpa menghapus.</li>
                    </ul>
                </div>
            </div>
        </OwnerLayout>
    );
}

function TierRow({ tier, isEditing, onEdit, onCancel }: { tier: DeliveryTier; isEditing: boolean; onEdit: () => void; onCancel: () => void }) {
    const form = useForm({
        min_km: String(tier.min_km),
        max_km: String(tier.max_km),
        fee: String(tier.fee),
        is_active: tier.is_active,
        sort_order: tier.sort_order,
    });

    const handleSave = () => {
        form.put(`/owner/delivery-tiers/${tier.id}`, {
            onSuccess: () => onCancel(),
        });
    };

    const handleDelete = () => {
        if (!confirm('Hapus tier ini?')) return;
        router.delete(`/owner/delivery-tiers/${tier.id}`);
    };

    const handleToggle = () => {
        router.patch(`/owner/delivery-tiers/${tier.id}/toggle`);
    };

    if (isEditing) {
        return (
            <div className="grid grid-cols-12 items-center gap-4 border-b border-border/50 bg-emerald-50/30 px-4 py-3">
                <div className="col-span-1" />
                <div className="col-span-3 flex items-center gap-2">
                    <input
                        type="number"
                        step="0.01"
                        value={form.data.min_km}
                        onChange={(e) => form.setData('min_km', e.target.value)}
                        className="w-20 rounded border border-border px-2 py-1.5 text-xs"
                        placeholder="Min"
                    />
                    <span className="text-xs text-text-muted">–</span>
                    <input
                        type="number"
                        step="0.01"
                        value={form.data.max_km}
                        onChange={(e) => form.setData('max_km', e.target.value)}
                        className="w-20 rounded border border-border px-2 py-1.5 text-xs"
                        placeholder="Max"
                    />
                    <span className="text-xs text-text-muted">km</span>
                </div>
                <div className="col-span-3">
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-text-muted">Rp</span>
                        <input
                            type="number"
                            step="500"
                            value={form.data.fee}
                            onChange={(e) => form.setData('fee', e.target.value)}
                            className="w-28 rounded border border-border px-2 py-1.5 text-xs"
                            placeholder="Tarif"
                        />
                    </div>
                </div>
                <div className="col-span-2">
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={form.data.is_active}
                            onChange={(e) => form.setData('is_active', e.target.checked)}
                            className="h-4 w-4 rounded border-border"
                        />
                        <span className="text-xs text-text-muted">Aktif</span>
                    </label>
                </div>
                <div className="col-span-3 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={form.processing}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white active:opacity-80 disabled:opacity-50"
                    >
                        Simpan
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text active:opacity-80"
                    >
                        Batal
                    </button>
                </div>
                {Object.keys(form.errors).length > 0 && (
                    <div className="col-span-12 mt-1">
                        {Object.values(form.errors).map((err, i) => (
                            <p key={i} className="text-[11px] text-red-600">{err}</p>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={`grid grid-cols-12 items-center gap-4 border-b border-border/50 px-4 py-3 transition-colors ${!tier.is_active ? 'opacity-50' : ''}`}>
            <div className="col-span-1">
                <GripVertical className="h-4 w-4 text-text-subtle" />
            </div>
            <div className="col-span-3 text-sm font-medium text-text">
                {tier.min_km} – {tier.max_km} km
            </div>
            <div className="col-span-3 text-sm font-bold tabular-nums text-text">
                {formatCurrency(tier.fee)}
            </div>
            <div className="col-span-2">
                <button
                    type="button"
                    onClick={handleToggle}
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        tier.is_active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-zinc-100 text-zinc-500'
                    }`}
                >
                    {tier.is_active ? 'Aktif' : 'Nonaktif'}
                </button>
            </div>
            <div className="col-span-3 flex items-center justify-end gap-2">
                <button
                    type="button"
                    onClick={onEdit}
                    className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text active:opacity-80"
                >
                    <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                    type="button"
                    onClick={handleDelete}
                    className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-500 active:opacity-80"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/pages/owner/delivery-tiers/index.tsx
git commit -m "feat: add delivery tiers management page"
```

---

### Task 9: Navigation

**Files:**
- Modify: `resources/js/layouts/owner-layout.tsx`

- [ ] **Step 1: Add delivery tiers nav item**

Find the `Keuangan` nav group (around line 42-48). Add a new group after it:

```tsx
{
    label: 'Pengiriman',
    icon: <DeliveryIcon />,
    items: [
        { href: '/owner/delivery-tiers', label: 'Tier Ongkir' },
    ],
},
```

Add the icon component at the bottom of the file (after existing icon components):

```tsx
function DeliveryIcon() {
    return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
        </svg>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/layouts/owner-layout.tsx
git commit -m "feat: add delivery tiers to owner nav"
```

---

### Task 10: Factory + Tests

**Files:**
- Create: `database/factories/DeliveryTierFactory.php`
- Create: `tests/Feature/DeliveryTierTest.php`
- Create: `tests/Feature/DeliveryPricingFromDbTest.php`

- [ ] **Step 1: Create factory**

```php
<?php

namespace Database\Factories;

use App\Models\DeliveryTier;
use Illuminate\Database\Eloquent\Factories\Factory;

class DeliveryTierFactory extends Factory
{
    protected $model = DeliveryTier::class;

    public function definition(): array
    {
        return [
            'min_km' => 0,
            'max_km' => $this->faker->randomFloat(2, 1, 20),
            'fee' => $this->faker->numberBetween(3000, 20000),
            'is_active' => true,
            'sort_order' => $this->faker->numberBetween(1, 10),
        ];
    }
}
```

- [ ] **Step 2: Create CRUD tests**

```php
<?php

namespace Tests\Feature;

use App\Models\DeliveryTier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeliveryTierTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create(['role' => 'owner']);
    }

    public function test_owner_can_list_delivery_tiers(): void
    {
        DeliveryTier::factory()->count(3)->create();

        $response = $this->actingAs($this->owner)->get('/owner/delivery-tiers');

        $response->assertStatus(200);
        $response->assertInertia(fn ($page) => $page->component('owner/delivery-tiers/index')->has('tiers', 3));
    }

    public function test_owner_can_create_delivery_tier(): void
    {
        $response = $this->actingAs($this->owner)->post('/owner/delivery-tiers', [
            'min_km' => 0,
            'max_km' => 5,
            'fee' => 10000,
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $response->assertRedirect('/owner/delivery-tiers');
        $this->assertDatabaseHas('delivery_tiers', ['max_km' => 5, 'fee' => 10000]);
    }

    public function test_owner_can_update_delivery_tier(): void
    {
        $tier = DeliveryTier::factory()->create();

        $response = $this->actingAs($this->owner)->put("/owner/delivery-tiers/{$tier->id}", [
            'min_km' => 0,
            'max_km' => 7,
            'fee' => 12000,
            'is_active' => true,
            'sort_order' => 1,
        ]);

        $response->assertRedirect('/owner/delivery-tiers');
        $this->assertDatabaseHas('delivery_tiers', ['id' => $tier->id, 'max_km' => 7, 'fee' => 12000]);
    }

    public function test_owner_can_delete_delivery_tier(): void
    {
        $tier = DeliveryTier::factory()->create();

        $response = $this->actingAs($this->owner)->delete("/owner/delivery-tiers/{$tier->id}");

        $response->assertRedirect('/owner/delivery-tiers');
        $this->assertDatabaseMissing('delivery_tiers', ['id' => $tier->id]);
    }

    public function test_owner_can_toggle_tier_active_status(): void
    {
        $tier = DeliveryTier::factory()->create(['is_active' => true]);

        $response = $this->actingAs($this->owner)->patch("/owner/delivery-tiers/{$tier->id}/toggle");

        $response->assertRedirect('/owner/delivery-tiers');
        $this->assertDatabaseHas('delivery_tiers', ['id' => $tier->id, 'is_active' => false]);
    }

    public function test_max_km_must_be_greater_than_min_km(): void
    {
        $response = $this->actingAs($this->owner)->post('/owner/delivery-tiers', [
            'min_km' => 10,
            'max_km' => 5,
            'fee' => 10000,
        ]);

        $response->assertSessionHasErrors('max_km');
    }

    public function test_non_owner_cannot_manage_tiers(): void
    {
        $user = User::factory()->create(['role' => 'customer']);

        $response = $this->actingAs($user)->get('/owner/delivery-tiers');

        $response->assertStatus(403);
    }
}
```

- [ ] **Step 3: Create integration test**

```php
<?php

namespace Tests\Feature;

use App\Models\DeliveryTier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeliveryPricingFromDbTest extends TestCase
{
    use RefreshDatabase;

    public function test_pricing_service_uses_db_tiers_over_config(): void
    {
        DeliveryTier::create(['min_km' => 0, 'max_km' => 5, 'fee' => 7777, 'sort_order' => 1]);
        DeliveryTier::create(['min_km' => 5, 'max_km' => 15, 'fee' => 9999, 'sort_order' => 2]);

        $service = app(\App\Services\DeliveryPricingService::class);

        $quote = $service->quote(-7.05, 110.43, -7.051, 110.431);

        $this->assertEquals(7777, $quote['delivery_fee']);
        $this->assertTrue($quote['is_serviceable']);
    }

    public function test_pricing_service_falls_back_to_config_when_no_db_tiers(): void
    {
        $service = app(\App\Services\DeliveryPricingService::class);

        $quote = $service->quote(-7.05, 110.43, -7.051, 110.431);

        $this->assertEquals(5000, $quote['delivery_fee']);
    }
}
```

- [ ] **Step 4: Run all tests**

Run: `php artisan test --filter=DeliveryTier`
Run: `php artisan test --filter=DeliveryPricingFromDb`
Run: `php artisan test --filter=DeliveryPricing`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add database/factories/DeliveryTierFactory.php tests/Feature/DeliveryTierTest.php tests/Feature/DeliveryPricingFromDbTest.php
git commit -m "feat: add delivery tier tests"
```

---

## Verification Checklist

After all tasks:

- [ ] `php artisan migrate:fresh --seed` — DB has delivery_tiers seeded
- [ ] `php artisan test --filter=DeliveryTier` — all CRUD tests pass
- [ ] `php artisan test --filter=DeliveryPricing` — existing pricing tests still pass
- [ ] `php artisan test --filter=DeliveryPricingFromDb` — DB integration tests pass
- [ ] Owner can view `/owner/delivery-tiers` — lists seeded tiers
- [ ] Owner can add new tier — form validates, tier appears in list
- [ ] Owner can edit tier inline — fee updates, reflected in checkout
- [ ] Owner can toggle tier active/inactive
- [ ] Owner can delete tier
- [ ] Checkout delivery quote uses DB tiers (change a fee → verify checkout shows new fee)
- [ ] Config fallback works (truncate delivery_tiers → pricing still works from config)
