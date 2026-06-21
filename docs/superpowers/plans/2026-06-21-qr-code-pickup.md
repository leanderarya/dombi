# QR Code Pickup Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable QR code-based pickup verification where customers show a QR code and outlets scan it to confirm order handover.

**Architecture:** Customer tracking page generates a QR code encoding the plain `order_code`. Outlet has a dedicated scan page with camera-based QR scanning (html5-qrcode for browser; `@capacitor-mlkit/barcode-scanning` planned for Capacitor native). After scanning, outlet is redirected to the order detail page to confirm pickup via existing `completePickup` flow.

**Tech Stack:** Laravel 12, Inertia.js, React 19, TailwindCSS v4, qrcode.react v4, html5-qrcode

**Camera Strategy:** Web-only via html5-qrcode for initial release. Requires HTTPS. Manual input always available as fallback. Native Capacitor scanner (`@capacitor-mlkit/barcode-scanning`) deferred to Capacitor setup phase.

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `app/Http/Controllers/Outlet/ScanController.php` | Handle scan page rendering and order lookup by code |
| `resources/js/pages/outlet/scan.tsx` | Outlet scan page with camera scanner and manual input |
| `tests/Feature/OutletScanTest.php` | Tests for scan controller endpoints + end-to-end pickup flow |

### Modified Files
| File | Changes |
|------|---------|
| `routes/web.php:264-269` | Add scan routes in outlet route group |
| `resources/js/pages/track.tsx:289-330` | Replace text order code with QR code in PickupHero |
| `resources/js/pages/outlet/dashboard.tsx` | Add scan card/button |

---

### Task 1: Install npm dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install qrcode.react and html5-qrcode**

```bash
npm install qrcode.react html5-qrcode
```

- [ ] **Step 2: Verify installation**

```bash
npm ls qrcode.react html5-qrcode
```

Expected: Both packages listed with versions. `qrcode.react` should be v4+.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add qrcode.react and html5-qrcode for QR pickup flow"
```

---

### Task 2: Write failing tests for ScanController

**Files:**
- Create: `tests/Feature/OutletScanTest.php`

- [ ] **Step 1: Write the test file**

```php
<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OutletScanTest extends TestCase
{
    use RefreshDatabase;

    public function test_scan_page_renders_for_outlet_user(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);

        $this->actingAs($user)
            ->get('/outlet/scan')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('outlet/scan')
            );
    }

    public function test_scan_page_requires_auth(): void
    {
        $this->get('/outlet/scan')
            ->assertRedirect('/login');
    }

    public function test_scan_page_requires_outlet_role(): void
    {
        $user = User::create([
            'name' => 'Customer User',
            'email' => 'cust-' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'customer',
        ]);

        $this->actingAs($user)
            ->get('/outlet/scan')
            ->assertForbidden();
    }

    public function test_lookup_returns_order_by_valid_code(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);
        $order = $this->createOrder($outlet, [
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'fulfillment_type' => 'pickup',
        ]);

        $this->actingAs($user)
            ->get("/outlet/scan/{$order->order_code}")
            ->assertOk()
            ->assertJson([
                'found' => true,
                'order' => [
                    'id' => $order->id,
                    'order_code' => $order->order_code,
                    'status' => Order::STATUS_READY_FOR_PICKUP,
                ],
            ]);
    }

    public function test_lookup_returns_not_found_for_invalid_code(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);

        $this->actingAs($user)
            ->get('/outlet/scan/INVALID-CODE')
            ->assertOk()
            ->assertJson(['found' => false]);
    }

    public function test_lookup_returns_not_found_for_other_outlet_order(): void
    {
        $outlet1 = $this->createOutlet();
        $outlet2 = $this->createOutlet();
        $user = $this->createOutletUser($outlet1);
        $order = $this->createOrder($outlet2, [
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'fulfillment_type' => 'pickup',
        ]);

        $this->actingAs($user)
            ->get("/outlet/scan/{$order->order_code}")
            ->assertOk()
            ->assertJson(['found' => false]);
    }

    public function test_lookup_rejects_order_not_ready_for_pickup(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);
        $order = $this->createOrder($outlet, [
            'status' => Order::STATUS_PREPARING,
            'fulfillment_type' => 'pickup',
        ]);

        $this->actingAs($user)
            ->get("/outlet/scan/{$order->order_code}")
            ->assertOk()
            ->assertJson([
                'found' => false,
                'error' => 'Pesanan belum siap diambil.',
            ]);
    }

    public function test_lookup_rejects_already_completed_order(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);
        $order = $this->createOrder($outlet, [
            'status' => Order::STATUS_COMPLETED,
            'fulfillment_type' => 'pickup',
        ]);

        $this->actingAs($user)
            ->get("/outlet/scan/{$order->order_code}")
            ->assertOk()
            ->assertJson([
                'found' => false,
                'error' => 'Pesanan sudah selesai.',
            ]);
    }

    public function test_lookup_rejects_cancelled_order(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);
        $order = $this->createOrder($outlet, [
            'status' => Order::STATUS_CANCELLED_BY_CUSTOMER,
            'fulfillment_type' => 'pickup',
        ]);

        $this->actingAs($user)
            ->get("/outlet/scan/{$order->order_code}")
            ->assertOk()
            ->assertJson([
                'found' => false,
                'error' => 'Pesanan sudah dibatalkan.',
            ]);
    }

    public function test_lookup_rejects_delivery_order(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);
        $order = $this->createOrder($outlet, [
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'fulfillment_type' => 'delivery_dombi',
        ]);

        $this->actingAs($user)
            ->get("/outlet/scan/{$order->order_code}")
            ->assertOk()
            ->assertJson(['found' => false]);
    }

    public function test_lookup_is_case_insensitive(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);
        $order = $this->createOrder($outlet, [
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'fulfillment_type' => 'pickup',
        ]);

        $this->actingAs($user)
            ->get('/outlet/scan/' . strtolower($order->order_code))
            ->assertOk()
            ->assertJson(['found' => true]);
    }

    public function test_lookup_includes_items(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);
        $order = $this->createOrder($outlet, [
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'fulfillment_type' => 'pickup',
        ]);

        $this->actingAs($user)
            ->get("/outlet/scan/{$order->order_code}")
            ->assertOk()
            ->assertJson([
                'found' => true,
                'order' => [
                    'items' => [
                        ['product_name' => 'Susu Kambing 500ml', 'quantity' => 2],
                    ],
                ],
            ]);
    }

    public function test_end_to_end_scan_and_complete_pickup(): void
    {
        $outlet = $this->createOutlet();
        $user = $this->createOutletUser($outlet);
        $order = $this->createOrder($outlet, [
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'fulfillment_type' => 'pickup',
        ]);

        // Step 1: Scan lookup returns order
        $this->actingAs($user)
            ->get("/outlet/scan/{$order->order_code}")
            ->assertOk()
            ->assertJson(['found' => true]);

        // Step 2: Confirm pickup via existing endpoint
        $this->actingAs($user)
            ->post("/outlet/orders/{$order->id}/complete-pickup")
            ->assertRedirect();

        // Step 3: Order is now completed
        $order->refresh();
        $this->assertSame(Order::STATUS_COMPLETED, $order->status);
    }

    public function test_only_outlet_owner_can_complete_pickup(): void
    {
        $outlet1 = $this->createOutlet();
        $outlet2 = $this->createOutlet();
        $user1 = $this->createOutletUser($outlet1);
        $order = $this->createOrder($outlet2, [
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'fulfillment_type' => 'pickup',
        ]);

        $this->actingAs($user1)
            ->post("/outlet/orders/{$order->id}/complete-pickup")
            ->assertForbidden();
    }

    private function createOutlet(): Outlet
    {
        return Outlet::create([
            'name' => 'Outlet Test ' . uniqid(),
            'kelurahan' => 'Test',
            'kecamatan' => 'Test',
            'address' => 'Jl. Test',
            'latitude' => -7.0523456,
            'longitude' => 110.4345678,
            'status' => 'active',
        ]);
    }

    private function createOutletUser(Outlet $outlet): User
    {
        return User::create([
            'name' => 'Outlet Staff',
            'email' => 'outlet-' . uniqid() . '@test.com',
            'password' => bcrypt('password'),
            'role' => 'outlet',
            'outlet_id' => $outlet->id,
            'is_active' => true,
        ]);
    }

    private function createOrder(Outlet $outlet, array $overrides = []): Order
    {
        $customer = Customer::create([
            'name' => 'Test Customer',
            'phone' => '6281234567890' . rand(1000, 9999),
        ]);

        $product = Product::create([
            'name' => 'Susu Kambing 500ml',
            'slug' => 'susu-kambing-500ml-scan-' . uniqid(),
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        $order = Order::create(array_merge([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-SCAN-' . strtoupper(uniqid()),
            'status' => Order::STATUS_READY_FOR_PICKUP,
            'fulfillment_type' => 'pickup',
            'subtotal' => 50000,
            'delivery_fee' => 0,
            'payment_method' => 'cod',
            'payment_fee' => 0,
            'total' => 50000,
            'customer_name' => 'Test Customer',
            'customer_phone' => '6281234567890',
            'customer_address' => 'Jl. Test',
            'ordered_at' => now(),
        ], $overrides));

        $order->items()->create([
            'product_id' => $product->id,
            'product_name' => $product->name,
            'quantity' => 2,
            'price' => $product->price,
            'subtotal' => 50000,
        ]);

        return $order;
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
php artisan test tests/Feature/OutletScanTest.php
```

Expected: FAIL — routes and controller don't exist yet.

- [ ] **Step 3: Commit**

```bash
git add tests/Feature/OutletScanTest.php
git commit -m "test: add failing tests for outlet QR scan feature"
```

---

### Task 3: Implement ScanController and routes

**Files:**
- Create: `app/Http/Controllers/Outlet/ScanController.php`
- Modify: `routes/web.php`

- [ ] **Step 1: Create ScanController**

```php
<?php

namespace App\Http\Controllers\Outlet;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ScanController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('outlet/scan');
    }

    public function lookup(Request $request, string $order_code): JsonResponse
    {
        $outlet = $request->user()->outlet;

        if (! $outlet) {
            return response()->json(['found' => false, 'error' => 'Outlet tidak ditemukan.']);
        }

        // P0-5: Filter pickup-only orders
        // P1-2: Use direct comparison (order_code stored uppercase)
        // P1-3: Eager load items
        $order = Order::query()
            ->where('outlet_id', $outlet->id)
            ->where('fulfillment_type', 'pickup')
            ->where('order_code', strtoupper($order_code))
            ->with('items')
            ->first();

        if (! $order) {
            return response()->json(['found' => false]);
        }

        // P1-1: Handle cancelled explicitly
        if (in_array($order->status, [
            Order::STATUS_CANCELLED_BY_CUSTOMER,
            Order::STATUS_CANCELLED_BY_OUTLET,
            Order::STATUS_REJECTED_BY_OUTLET,
        ], true)) {
            return response()->json([
                'found' => false,
                'error' => 'Pesanan sudah dibatalkan.',
            ]);
        }

        if (in_array($order->status, [
            Order::STATUS_PENDING_CONFIRMATION,
            Order::STATUS_CONFIRMED,
            Order::STATUS_PREPARING,
        ], true)) {
            return response()->json([
                'found' => false,
                'error' => 'Pesanan belum siap diambil.',
            ]);
        }

        if ($order->status === Order::STATUS_COMPLETED) {
            return response()->json([
                'found' => false,
                'error' => 'Pesanan sudah selesai.',
            ]);
        }

        if ($order->status === Order::STATUS_EXPIRED) {
            return response()->json([
                'found' => false,
                'error' => 'Pesanan sudah kadaluarsa.',
            ]);
        }

        if ($order->status !== Order::STATUS_READY_FOR_PICKUP) {
            return response()->json([
                'found' => false,
                'error' => 'Status pesanan tidak valid untuk pengambilan.',
            ]);
        }

        return response()->json([
            'found' => true,
            'order' => [
                'id' => $order->id,
                'order_code' => $order->order_code,
                'status' => $order->status,
                'customer_name' => $order->customer_name,
                'total' => (float) $order->total,
                'items' => $order->items->map(fn ($item) => [
                    'product_name' => $item->product_name,
                    'quantity' => $item->quantity,
                ]),
            ],
        ]);
    }
}
```

- [ ] **Step 2: Add routes to web.php**

In `routes/web.php`, inside the outlet middleware group (after line 269), add:

```php
Route::get('/scan', [OutletScanController::class, 'index'])->name('scan');
Route::get('/scan/{order_code}', [OutletScanController::class, 'lookup'])->name('scan.lookup');
```

Add the import at the top of the file (after line 25):

```php
use App\Http\Controllers\Outlet\ScanController as OutletScanController;
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
php artisan test tests/Feature/OutletScanTest.php
```

Expected: All 13 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/Outlet/ScanController.php routes/web.php
git commit -m "feat: add ScanController with pickup filter, status guards, eager loading"
```

---

### Task 4: Create outlet scan page (frontend)

**Files:**
- Create: `resources/js/pages/outlet/scan.tsx`

- [ ] **Step 1: Create the scan page component**

```tsx
import { Head, router } from '@inertiajs/react';
import { Camera, Keyboard, Loader2, QrCode, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import OutletLayout from '@/layouts/outlet-layout';

type ScanResult = {
    found: boolean;
    order?: {
        id: number;
        order_code: string;
        status: string;
        customer_name: string;
        total: number;
        items: { product_name: string; quantity: number }[];
    };
    error?: string;
};

export default function OutletScanPage() {
    const [scanning, setScanning] = useState(false);
    const [manualCode, setManualCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const scannerRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    // P0-3: Prevent race condition double-scan
    const hasScannedRef = useRef(false);

    const lookupOrder = useCallback(async (orderCode: string) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/outlet/scan/${encodeURIComponent(orderCode)}`, {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            const data: ScanResult = await response.json();

            if (data.found && data.order) {
                router.visit(`/outlet/orders/${data.order.id}`);
            } else {
                setError(data.error ?? 'Pesanan tidak ditemukan.');
                // P0-3: Reset on failure so user can scan again
                hasScannedRef.current = false;
            }
        } catch {
            setError('Gagal memeriksa pesanan. Periksa koneksi Anda.');
            hasScannedRef.current = false;
        } finally {
            setLoading(false);
        }
    }, []);

    const handleScanResult = useCallback(async (decodedText: string) => {
        // P0-3: Guard against double-fire
        if (hasScannedRef.current) return;
        hasScannedRef.current = true;

        await stopScanner();

        let orderCode = decodedText;

        // Accept both plain code and URL (backward-compatible)
        try {
            const url = new URL(decodedText);
            const pathParts = url.pathname.split('/');
            const scanIndex = pathParts.indexOf('scan');
            if (scanIndex !== -1 && pathParts[scanIndex + 1]) {
                orderCode = pathParts[scanIndex + 1];
            }
        } catch {
            // Not a URL, use as-is (plain order code)
        }

        lookupOrder(orderCode);
    }, [lookupOrder]);

    const stopScanner = useCallback(async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
                scannerRef.current.clear();
                scannerRef.current = null;
            } catch {
                // Scanner may already be stopped
            }
        }
        setScanning(false);
    }, []);

    const startScanner = useCallback(async () => {
        if (!containerRef.current) return;

        // P0-3: Reset guard when starting fresh scan
        hasScannedRef.current = false;
        setScanning(true);
        setError(null);

        try {
            const { Html5Qrcode } = await import('html5-qrcode');

            const scanner = new Html5Qrcode('qr-reader');
            scannerRef.current = scanner;

            await scanner.start(
                { facingMode: 'environment' },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                },
                (decodedText) => {
                    handleScanResult(decodedText);
                },
                () => {},
            );
        } catch {
            setError('Gagal mengakses kamera. Pastikan izin kamera sudah diberikan.');
            setScanning(false);
        }
    }, [handleScanResult]);

    useEffect(() => {
        return () => {
            stopScanner();
        };
    }, [stopScanner]);

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (manualCode.trim()) {
            hasScannedRef.current = true;
            lookupOrder(manualCode.trim());
        }
    };

    return (
        <OutletLayout title="Scan QR Code" backHref="/outlet/dashboard" hideNav>
            <Head title="Scan QR Code" />

            <div className="mx-auto max-w-lg">
                {/* Scanner Area */}
                <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-black">
                    <div
                        ref={containerRef}
                        id="qr-reader"
                        className="relative aspect-square w-full"
                    >
                        {!scanning && !loading && (
                            <div className="flex h-full flex-col items-center justify-center gap-4 bg-zinc-900 p-6 text-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
                                    <Camera className="h-8 w-8 text-white" />
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-white">Arahkan kamera ke QR code</div>
                                    <div className="mt-1 text-xs text-zinc-400">QR code akan ter-scan otomatis</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={startScanner}
                                    aria-label="Mulai scan QR code"
                                    className="flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-white active:bg-primary-hover"
                                >
                                    <Camera className="h-4 w-4" />
                                    Mulai Scan
                                </button>
                            </div>
                        )}

                        {loading && (
                            <div className="flex h-full flex-col items-center justify-center gap-3 bg-zinc-900">
                                <Loader2 className="h-8 w-8 animate-spin text-white" />
                                <div className="text-sm text-white">Memeriksa pesanan...</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Stop Scanner Button */}
                {scanning && (
                    <button
                        type="button"
                        onClick={stopScanner}
                        aria-label="Berhenti scan"
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-semibold text-text active:bg-surface-muted"
                    >
                        <XCircle className="h-4 w-4" />
                        Berhenti Scan
                    </button>
                )}

                {/* Error */}
                {error && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-500" />
                            <div className="text-sm font-semibold text-red-800">{error}</div>
                        </div>
                    </div>
                )}

                {/* Divider */}
                <div className="my-6 flex items-center gap-3">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs font-semibold text-text-subtle">ATAU</span>
                    <div className="h-px flex-1 bg-border" />
                </div>

                {/* Manual Input */}
                <div className="rounded-2xl border border-border bg-white p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Keyboard className="h-4 w-4 text-text-muted" />
                        <span className="text-sm font-semibold text-text">Input Kode Manual</span>
                    </div>
                    <form onSubmit={handleManualSubmit} className="flex gap-2">
                        <input
                            type="text"
                            value={manualCode}
                            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                            placeholder="Masukkan kode pesanan"
                            aria-label="Kode pesanan"
                            className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold uppercase tracking-wider text-text placeholder:normal-case placeholder:tracking-normal placeholder:text-text-subtle focus:border-primary focus:ring-1 focus:ring-primary/20"
                        />
                        <button
                            type="submit"
                            disabled={!manualCode.trim() || loading}
                            aria-label="Cari pesanan"
                            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white active:bg-primary-hover disabled:bg-surface-muted disabled:text-text-subtle"
                        >
                            Cari
                        </button>
                    </form>
                </div>

                {/* Instructions */}
                <div className="mt-6 rounded-xl border border-border bg-surface-muted p-4">
                    <div className="text-xs font-semibold text-text-subtle mb-2">Cara Menggunakan:</div>
                    <ol className="space-y-1.5 text-xs text-text-muted">
                        <li className="flex items-start gap-2">
                            <span className="font-semibold text-text">1.</span>
                            <span>Minta customer menunjukkan QR code di halaman tracking pesanan</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="font-semibold text-text">2.</span>
                            <span>Arahkan kamera ke QR code</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="font-semibold text-text">3.</span>
                            <span>Anda akan diarahkan ke halaman pesanan untuk konfirmasi</span>
                        </li>
                    </ol>
                </div>
            </div>
        </OutletLayout>
    );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run types:check
```

Expected: No errors.

- [ ] **Step 3: Run lint check**

```bash
npm run lint:check
```

Expected: No hooks warnings, no errors.

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/outlet/scan.tsx
git commit -m "feat: add outlet scan page with double-scan guard and design tokens"
```

---

### Task 5: Add QR code to customer tracking page

**Files:**
- Modify: `resources/js/pages/track.tsx`

- [ ] **Step 1: Add QRCodeSVG import**

At the top of `track.tsx`, add the import (after line 3):

```tsx
import { QRCodeSVG } from 'qrcode.react';
```

- [ ] **Step 2: Modify PickupHero to show QR code**

Replace the `PickupHero` function (lines 289-330) with:

```tsx
function PickupHero({ status, orderCode, statusConfig, isTerminal }: {
    status: string;
    orderCode: string;
    statusConfig: any;
    isTerminal: boolean;
}) {
    if (isTerminal) return null;

    if (status === 'ready_for_pickup') {
        return (
            <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-white p-5">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                        <QrCode className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                        <div className="text-xs font-medium text-text-subtle">Siap Diambil</div>
                        <div className="mt-0.5 text-lg font-bold text-text">Pesanan Sudah Siap</div>
                    </div>
                </div>

                {/* QR Code — P0-2: encode plain order_code, not URL */}
                <div className="mt-4 rounded-xl bg-surface-muted p-4 flex flex-col items-center">
                    <QRCodeSVG
                        value={orderCode}
                        size={200}
                        bgColor="#f4f4f5"
                        fgColor="#1e40af"
                        level="M"
                        marginSize={0}
                    />
                    <div className="mt-3 text-center">
                        <div className="text-lg font-bold tracking-wider text-blue-700">{orderCode}</div>
                        <div className="mt-1 text-[11px] text-text-subtle">Tunjukkan QR ini ke kasir</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-4 rounded-2xl border border-border bg-white p-4">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                    <statusConfig.icon className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                    <div className="text-sm font-semibold text-text">{statusConfig.label}</div>
                    <div className="text-xs text-text-muted">{statusConfig.description}</div>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Update PickupInfoCard instructions**

In the `PickupInfoCard` function (lines 471-552), update the instructions section (lines 522-538) to mention QR:

```tsx
{/* Pickup Instructions */}
<div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3">
    <div className="text-xs font-semibold text-blue-800 mb-2">Cara Mengambil:</div>
    <ol className="space-y-1.5 text-xs text-blue-700">
        <li className="flex items-start gap-2">
            <span className="font-semibold text-blue-800">1.</span>
            <span>Datang ke outlet yang tertera di atas</span>
        </li>
        <li className="flex items-start gap-2">
            <span className="font-semibold text-blue-800">2.</span>
            <span>Tunjukkan <span className="font-bold">QR code</span> di atas ke kasir</span>
        </li>
        <li className="flex items-start gap-2">
            <span className="font-semibold text-blue-800">3.</span>
            <span>Ambil pesanan Anda</span>
        </li>
    </ol>
</div>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run types:check
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/track.tsx
git commit -m "feat: show QR code with plain order_code on tracking page"
```

---

### Task 6: Add scan button to outlet dashboard

**Files:**
- Modify: `resources/js/pages/outlet/dashboard.tsx`

- [ ] **Step 1: Add scan card to dashboard**

In `resources/js/pages/outlet/dashboard.tsx`, add a prominent scan card. Find an appropriate location (near the top of the dashboard content, after any summary stats) and add:

```tsx
import { QrCode, Camera } from 'lucide-react';
```

Then add the card component in the dashboard JSX:

```tsx
{/* QR Scan Card */}
<Link
    href="/outlet/scan"
    className="mt-4 flex items-center gap-4 rounded-2xl bg-gradient-to-br from-primary to-primary-hover p-5 text-white transition-all active:scale-[0.99]"
>
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
        <QrCode className="h-7 w-7" />
    </div>
    <div className="flex-1">
        <div className="text-lg font-bold">Scan QR untuk Ambil Pesanan</div>
        <div className="mt-0.5 text-sm text-white/80">Arahkan kamera ke QR code customer</div>
    </div>
    <Camera className="h-5 w-5 text-white/60" />
</Link>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run types:check
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add resources/js/pages/outlet/dashboard.tsx
git commit -m "feat: add QR scan card to outlet dashboard"
```

---

### Task 7: Run full test suite and verify

- [ ] **Step 1: Run PHP tests**

```bash
php artisan test tests/Feature/OutletScanTest.php
```

Expected: All 13 tests PASS.

- [ ] **Step 2: Run TypeScript check**

```bash
npm run types:check
```

Expected: No errors.

- [ ] **Step 3: Run lint**

```bash
npm run lint:check
```

Expected: No errors, no hooks warnings.

- [ ] **Step 4: Run build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address lint/type issues from QR pickup feature"
```

---

## P2 — Backlog (not in this plan)

- Throttle endpoint `/outlet/scan/{order_code}` (e.g. `throttle:30,1`)
- A11y: `aria-label` on icon buttons (partially done in Task 4)
- Future: if scan becomes auto-confirm, replace `order_code` with signed token + expiry (prevent replay)
