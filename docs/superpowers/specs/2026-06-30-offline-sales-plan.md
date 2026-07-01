# Penjualan Offline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let outlet record offline sales (WhatsApp, walk-in). Stock decreases, debt to center increases.

**Architecture:** New `offline_sales` table, `OfflineSaleController`, dialog for recording, settlement integration.

**Tech Stack:** Laravel 11, React + Inertia.js, TypeScript

## Global Constraints

- Center price × quantity = debt amount
- Stock cannot go below 0
- Stock movement logged with type `offline_sale`
- Settlement includes offline sales amount

---

### Task 1: Database Migration

**Files:**
- Create: `database/migrations/xxx_create_offline_sales_table.php`

**Interfaces:**
- Produces: `offline_sales` table

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
        Schema::create('offline_sales', function (Blueprint $table) {
            $table->id();
            $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_variant_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('quantity');
            $table->decimal('center_price', 12, 2);
            $table->decimal('total_amount', 12, 2);
            $table->string('notes', 500)->nullable();
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();

            $table->index(['outlet_id', 'created_at']);
            $table->index('product_variant_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('offline_sales');
    }
};
```

- [ ] **Step 2: Run migration**

```bash
php artisan migrate
```

- [ ] **Step 3: Commit**

```bash
git add database/migrations/
git commit -m "feat: offline_sales table migration"
```

---

### Task 2: OfflineSale Model

**Files:**
- Create: `app/Models/OfflineSale.php`

**Interfaces:**
- Produces: `OfflineSale` model with relationships

- [ ] **Step 1: Create model**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OfflineSale extends Model
{
    protected $fillable = [
        'outlet_id',
        'product_variant_id',
        'quantity',
        'center_price',
        'total_amount',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'center_price' => 'decimal:2',
            'total_amount' => 'decimal:2',
        ];
    }

    public function outlet(): BelongsTo
    {
        return $this->belongsTo(Outlet::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/Models/OfflineSale.php
git commit -m "feat: OfflineSale model"
```

---

### Task 3: OfflineSaleController

**Files:**
- Create: `app/Http/Controllers/Outlet/OfflineSaleController.php`

**Interfaces:**
- Produces: `index()` — list offline sales
- Produces: `store()` — record new offline sale

- [ ] **Step 1: Create controller**

```php
<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\OfflineSale;
use App\Models\OutletInventory;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class OfflineSaleController extends Controller
{
    public function index(Request $request): Response
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet, 403);

        $sales = OfflineSale::where('outlet_id', $outlet->id)
            ->with('variant:id,name,product_id')
            ->latest()
            ->paginate(20);

        $variants = OutletInventory::where('outlet_id', $outlet->id)
            ->where('current_stock', '>', 0)
            ->with('variant:id,name,center_price,product_id')
            ->get()
            ->map(fn ($inv) => [
                'id' => $inv->variant->id,
                'name' => $inv->variant->name,
                'center_price' => $inv->variant->center_price,
                'stock' => $inv->current_stock,
            ]);

        return Inertia::render('outlet/offline-sales/index', [
            'sales' => $sales,
            'variants' => $variants,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $outlet = $request->user()->outlet;
        abort_unless($outlet, 403);

        $validated = $request->validate([
            'variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'quantity' => ['required', 'integer', 'min:1'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $variant = ProductVariant::findOrFail($validated['variant_id']);
        $centerPrice = (float) $variant->center_price;
        $totalAmount = $centerPrice * $validated['quantity'];

        $inventory = OutletInventory::where('outlet_id', $outlet->id)
            ->where('product_variant_id', $variant->id)
            ->first();

        if (!$inventory || $inventory->current_stock < $validated['quantity']) {
            throw ValidationException::withMessages([
                'quantity' => "Stok tidak mencukupi. Tersedia: {$inventory?->current_stock ?? 0}",
            ]);
        }

        DB::transaction(function () use ($outlet, $variant, $validated, $centerPrice, $totalAmount, $inventory, $request) {
            $before = $inventory->current_stock;
            $inventory->decrement('current_stock', $validated['quantity']);

            OfflineSale::create([
                'outlet_id' => $outlet->id,
                'product_variant_id' => $variant->id,
                'quantity' => $validated['quantity'],
                'center_price' => $centerPrice,
                'total_amount' => $totalAmount,
                'notes' => $validated['notes'] ?? null,
                'created_by' => $request->user()->id,
            ]);

            StockMovement::create([
                'outlet_id' => $outlet->id,
                'product_id' => $variant->product_id,
                'product_variant_id' => $variant->id,
                'type' => 'offline_sale',
                'quantity' => -$validated['quantity'],
                'before_stock' => $before,
                'after_stock' => $before - $validated['quantity'],
                'notes' => "Penjualan offline: {$validated['quantity']}x {$variant->name}",
                'created_by' => $request->user()->id,
            ]);

            // Clear cache
            \Cache::forget("outlet:{$outlet->id}:pending_orders");
        });

        return back()->with('success', 'Penjualan offline berhasil dicatat.');
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/Http/Controllers/Outlet/OfflineSaleController.php
git commit -m "feat: OfflineSaleController — index and store"
```

---

### Task 4: Routes

**Files:**
- Modify: `routes/web.php`

**Interfaces:**
- Produces: `GET /outlet/offline-sales`, `POST /outlet/offline-sales`

- [ ] **Step 1: Add routes**

Add inside outlet middleware group:

```php
use App\Http\Controllers\Outlet\OfflineSaleController;

Route::get('/offline-sales', [OfflineSaleController::class, 'index'])->name('offline-sales.index');
Route::post('/offline-sales', [OfflineSaleController::class, 'store'])->name('offline-sales.store');
```

- [ ] **Step 2: Verify routes**

```bash
php artisan route:list --path=outlet/offline-sales
```

Expected: `GET` and `POST` routes exist.

- [ ] **Step 3: Commit**

```bash
git add routes/web.php
git commit -m "feat: offline sales routes"
```

---

### Task 5: Outlet Page — Offline Sales

**Files:**
- Create: `resources/js/pages/outlet/offline-sales/index.tsx`
- Create: `resources/js/components/outlet/offline-sale-dialog.tsx`

**Interfaces:**
- Produces: Outlet page with list + create dialog

- [ ] **Step 1: Create dialog component**

Create `resources/js/components/outlet/offline-sale-dialog.tsx`:

```tsx
import { useForm } from '@inertiajs/react';
import CustomSelect from '@/components/ui/custom-select';
import { X, Plus, Minus } from 'lucide-react';

interface Variant {
    id: number;
    name: string;
    center_price: number;
    stock: number;
}

interface Props {
    open: boolean;
    variants: Variant[];
    onClose: () => void;
}

export default function OfflineSaleDialog({ open, variants = [], onClose }: Props) {
    const form = useForm({
        variant_id: '',
        quantity: 1,
        notes: '',
    });

    const variantOptions = variants.map((v) => ({
        value: String(v.id),
        label: v.name,
        subtitle: `Stok: ${v.stock} · Harga: Rp ${Number(v.center_price).toLocaleString('id-ID')}`,
    }));

    const selectedVariant = variants.find((v) => String(v.id) === form.data.variant_id);
    const totalAmount = selectedVariant ? selectedVariant.center_price * form.data.quantity : 0;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post('/outlet/offline-sales', {
            onSuccess: () => {
                form.reset();
                onClose();
            },
        });
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
            <div
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <h2 className="text-base font-bold text-text">Catat Penjualan</h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-text-muted hover:text-text hover:bg-surface-muted transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                        <CustomSelect
                            label="Produk"
                            options={variantOptions}
                            value={form.data.variant_id}
                            onChange={(v: string) => form.setData('variant_id', v)}
                            placeholder="Pilih produk"
                            searchable
                        />

                        <div>
                            <label className="text-xs font-medium text-text-muted mb-1.5 block">Jumlah Terjual</label>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => form.data.quantity > 1 && form.setData('quantity', form.data.quantity - 1)} className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-text-muted hover:bg-surface-muted transition-colors">
                                    <Minus className="w-3.5 h-3.5" />
                                </button>
                                <input
                                    type="number"
                                    min="1"
                                    max={selectedVariant?.stock ?? 999}
                                    value={form.data.quantity}
                                    onChange={(e) => form.setData('quantity', Math.max(1, parseInt(e.target.value) || 1))}
                                    className="w-20 h-9 text-center text-sm font-semibold text-text border border-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                                <button type="button" onClick={() => form.setData('quantity', form.data.quantity + 1)} className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-text-muted hover:bg-surface-muted transition-colors">
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            {form.errors.quantity && <p className="mt-1 text-xs text-red-600">{form.errors.quantity}</p>}
                        </div>

                        <div>
                            <label className="text-xs font-medium text-text-muted mb-1.5 block">Catatan (opsional)</label>
                            <input
                                type="text"
                                value={form.data.notes}
                                onChange={(e) => form.setData('notes', e.target.value)}
                                placeholder="Misal: jual via WhatsApp"
                                className="w-full h-9 rounded-lg border border-border bg-surface px-3 text-sm text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                        </div>
                    </div>

                    <div className="px-4 py-3 border-t border-border bg-surface-muted/50">
                        {totalAmount > 0 && (
                            <div className="flex items-center justify-between mb-3 text-xs text-text-muted">
                                <span>Total hutang ke pusat</span>
                                <span className="font-semibold text-text">Rp {totalAmount.toLocaleString('id-ID')}</span>
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={form.processing || !form.data.variant_id}
                            className="w-full h-11 rounded-xl bg-emerald-600 text-sm font-bold text-white active:opacity-80 disabled:bg-border disabled:text-text-subtle transition-colors"
                        >
                            {form.processing ? 'Menyimpan...' : 'Simpan Penjualan'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Create index page**

Create `resources/js/pages/outlet/offline-sales/index.tsx`:

```tsx
import { Head } from '@inertiajs/react';
import { Plus, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import EmptyState from '@/components/ui/empty-state';
import OfflineSaleDialog from '@/components/outlet/offline-sale-dialog';
import OutletLayout from '@/layouts/outlet-layout';
import Pagination from '@/components/pagination';
import { formatCurrency, formatDate } from '@/lib/format';

export default function OfflineSalesIndex({ sales, variants }: any) {
    const [showCreate, setShowCreate] = useState(false);

    return (
        <OutletLayout title="Penjualan Offline" subtitle="Catat penjualan di luar aplikasi">
            <Head title="Penjualan Offline" />

            <div className="mt-4 mb-4 flex justify-end">
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-bold text-white active:opacity-80"
                >
                    <Plus className="h-4 w-4" />
                    Catat Penjualan
                </button>
            </div>

            {sales.data.length === 0 ? (
                <EmptyState
                    icon={<ShoppingBag className="h-8 w-8 text-text-subtle" />}
                    title="Belum ada penjualan offline"
                    description="Catat penjualan yang terjadi di luar aplikasi (WhatsApp, walk-in)."
                    action={{ label: 'Catat Penjualan', onClick: () => setShowCreate(true) }}
                />
            ) : (
                <div className="space-y-1.5">
                    {sales.data.map((sale: any) => (
                        <div key={sale.id} className="rounded-xl border border-border bg-white px-3.5 py-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-text">{sale.variant?.name ?? '-'}</span>
                                <span className="text-sm font-bold tabular-nums text-text">{formatCurrency(sale.total_amount)}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between text-xs text-text-muted">
                                <span>{sale.quantity} x {formatCurrency(sale.center_price)}</span>
                                <span>{formatDate(sale.created_at)}</span>
                            </div>
                            {sale.notes && <div className="mt-1 text-xs text-text-subtle">{sale.notes}</div>}
                        </div>
                    ))}
                </div>
            )}

            <Pagination links={sales.links} />

            <OfflineSaleDialog
                open={showCreate}
                onClose={() => setShowCreate(false)}
                variants={variants}
            />
        </OutletLayout>
    );
}
```

- [ ] **Step 3: Commit**

```bash
git add resources/js/pages/outlet/offline-sales/index.tsx resources/js/components/outlet/offline-sale-dialog.tsx
git commit -m "feat: outlet offline sales page and dialog"
```

---

### Task 6: Add to Outlet Navigation

**Files:**
- Modify: `resources/js/pages/outlet/more.tsx`

**Interfaces:**
- Adds "Penjualan Offline" menu item

- [ ] **Step 1: Add menu item**

Add to the `features` array in `resources/js/pages/outlet/more.tsx`:

```tsx
{
    href: '/outlet/offline-sales',
    icon: ShoppingBag,
    title: 'Penjualan Offline',
    description: 'Catat penjualan di luar aplikasi (WhatsApp, walk-in)',
    badgeKey: null,
    color: 'bg-orange-50 text-orange-600',
},
```

- [ ] **Step 2: Add import**

```tsx
import { ShoppingBag } from 'lucide-react';
```

- [ ] **Step 3: Commit**

```bash
git add resources/js/pages/outlet/more.tsx
git commit -m "feat: add offline sales to outlet more menu"
```

---

### Task 7: Owner View — Settlement Integration

**Files:**
- Modify: `app/Http/Controllers/Owner/FinanceSettlementController.php`

**Interfaces:**
- Adds offline sales amount to settlement detail

- [ ] **Step 1: Add offline sales to settlement data**

In the `outletDetail()` method, add offline sales query:

```php
use App\Models\OfflineSale;

// Get offline sales for the period
$offlineSales = OfflineSale::where('outlet_id', $outlet->id)
    ->whereBetween('created_at', [$periodStart, $periodEnd])
    ->with('variant:id,name')
    ->latest()
    ->get();

$offlineSalesTotal = $offlineSales->sum('total_amount');

// Add to response
'offlineSales' => $offlineSales->map(fn ($sale) => [
    'id' => $sale->id,
    'variant_name' => $sale->variant->name,
    'quantity' => $sale->quantity,
    'center_price' => $sale->center_price,
    'total_amount' => $sale->total_amount,
    'created_at' => $sale->created_at->toIso8601String(),
]),
'offlineSalesTotal' => (float) $offlineSalesTotal,
```

- [ ] **Step 2: Commit**

```bash
git add app/Http/Controllers/Owner/FinanceSettlementController.php
git commit -m "feat: add offline sales to owner settlement view"
```

---

## Verification

1. `php artisan migrate` — table created
2. `php artisan route:list --path=outlet/offline-sales` — routes exist
3. Outlet: open "Penjualan Offline" → list empty, button works
4. Outlet: catat penjualan → stok berkurang, list update
5. Owner: cek keuangan outlet → offline sales tercatat
6. Validasi: tidak bisa jual lebih dari stok tersedia
