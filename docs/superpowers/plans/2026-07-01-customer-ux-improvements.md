# Customer UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve customer-facing UX so customers don't get confused, understand information clearly, know what they're doing, and aren't lost after checkout/payment.

**Architecture:** 5 independent improvements across the customer journey: order success page (new), order status clarity, pickup overlay improvements, home page cleanup, and product pricing + time estimates. Each task is self-contained and can be reviewed independently.

**Tech Stack:** React, TypeScript, Tailwind CSS v4, Inertia.js, Laravel

## Global Constraints

- Follow existing patterns: `CustomerMobileLayout`, `SectionCard`, `StatusBadge` components
- Use `formatCurrency` from `@/lib/format` for all currency display
- Min touch target: `min-h-11` (44px)
- Border radius: `rounded-xl` for cards, `rounded-lg` for buttons
- Design tokens: `text-text`, `text-text-muted`, `text-text-subtle`, `bg-surface`, `border-border`
- Indonesian language for all UI text

---

### Task 1: Order Success Confirmation Page

**Files:**
- Create: `resources/js/pages/customer/orders/confirm.tsx`
- Modify: `app/Http/Controllers/Customer/OrderController.php:82-94` (add confirm method)
- Modify: `routes/web.php:108` (add confirm route)
- Modify: `app/Http/Controllers/Customer/CheckoutController.php:495-504` (change redirect)

**Interfaces:**
- Consumes: `order` object with `order_code`, `items`, `total`, `fulfillment_type`, `recovery_token`
- Produces: New route `customer.orders.confirm` accessible via `{order_code}`

- [ ] **Step 1: Add confirm method to OrderController**

In `app/Http/Controllers/Customer/OrderController.php`, add after the `confirmation` method (after line 94):

```php
public function confirm(Request $request, string $orderCode): Response
{
    $order = Order::where('order_code', $orderCode)->firstOrFail();

    // Verify the user owns this order (or has valid recovery token)
    $user = $request->user();
    if ($user && $order->customer_id && $order->customer_id !== $user->getCustomerOrCreate()->id) {
        abort(403);
    }

    return Inertia::render('customer/orders/confirm', [
        'order' => [
            'id' => $order->id,
            'order_code' => $order->order_code,
            'items' => $order->items->map(fn ($item) => [
                'product_name' => $item->product_name,
                'variant_name' => $item->variant_name,
                'quantity' => $item->quantity,
                'subtotal' => $item->subtotal,
            ]),
            'total' => $order->total,
            'fulfillment_type' => $order->fulfillment_type,
            'recovery_token' => $order->recovery_token,
            'outlet' => $order->outlet ? [
                'name' => $order->outlet->name,
            ] : null,
        ],
    ]);
}
```

- [ ] **Step 2: Add confirm route to web.php**

In `routes/web.php`, add after line 108 (after the confirmation route):

```php
Route::get('/orders/confirm/{orderCode}', [CustomerOrderController::class, 'confirm'])->name('orders.confirm');
```

- [ ] **Step 3: Create confirm.tsx page**

Create `resources/js/pages/customer/orders/confirm.tsx`:

```tsx
import { Head, Link } from '@inertiajs/react';
import { CheckCircle2, ChevronRight, Home, MapPin, Package, Truck } from 'lucide-react';
import CustomerMobileLayout from '@/layouts/customer-mobile-layout';
import { formatCurrency } from '@/lib/format';

interface OrderItem {
    product_name: string;
    variant_name: string | null;
    quantity: number;
    subtotal: number;
}

interface Order {
    id: number;
    order_code: string;
    items: OrderItem[];
    total: number;
    fulfillment_type: string;
    recovery_token: string;
    outlet: { name: string } | null;
}

interface Props {
    order: Order;
}

export default function OrderConfirm({ order }: Props) {
    const isPickup = order.fulfillment_type === 'pickup';
    const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const estimatedTime = isPickup ? '15-30 menit' : '30-60 menit';

    return (
        <CustomerMobileLayout hideTopBar hideCartBar hideBottomNav>
            <Head title="Pesanan Berhasil" />

            <div className="flex flex-col items-center pt-8 text-center">
                {/* Animated Checkmark */}
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 animate-[scaleIn_0.5s_ease-out]">
                    <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </div>

                <h1 className="mt-5 text-xl font-bold text-text">Pesanan Berhasil!</h1>

                {/* Order Code */}
                <div className="mt-3 rounded-xl bg-surface-muted px-4 py-2">
                    <span className="text-xs text-text-muted">Kode Pesanan</span>
                    <div className="mt-0.5 text-lg font-bold tabular-nums tracking-wider text-text">
                        {order.order_code}
                    </div>
                </div>

                {/* Summary Card */}
                <div className="mt-6 w-full max-w-sm rounded-xl border border-border bg-white p-4 text-left">
                    <div className="space-y-2.5">
                        <div className="flex items-center gap-3 text-sm">
                            <Package className="h-4 w-4 shrink-0 text-text-subtle" />
                            <span className="text-text-muted">{itemCount} Produk</span>
                            <span className="ml-auto font-semibold tabular-nums text-text">{formatCurrency(order.total)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            {isPickup ? (
                                <MapPin className="h-4 w-4 shrink-0 text-text-subtle" />
                            ) : (
                                <Truck className="h-4 w-4 shrink-0 text-text-subtle" />
                            )}
                            <span className="text-text-muted">
                                {isPickup ? 'Ambil di Outlet' : 'Kurir Dombi'}
                            </span>
                            {order.outlet && (
                                <span className="ml-auto text-xs text-text-subtle">{order.outlet.name}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <span className="h-4 w-4 shrink-0 text-center text-xs">⏱</span>
                            <span className="text-text-muted">Estimasi</span>
                            <span className="ml-auto font-medium text-text">{estimatedTime}</span>
                        </div>
                    </div>
                </div>

                {/* CTAs */}
                <div className="mt-8 w-full max-w-sm space-y-3">
                    <Link
                        href={`/customer/orders/${order.id}`}
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white active:opacity-80"
                    >
                        Lacak Pesanan
                        <ChevronRight className="h-4 w-4" />
                    </Link>
                    <Link
                        href="/customer/home"
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold text-text active:opacity-80"
                    >
                        <Home className="h-4 w-4" />
                        Kembali ke Beranda
                    </Link>
                </div>

                {/* Helper text */}
                <p className="mt-6 px-8 text-xs leading-relaxed text-text-subtle">
                    Simpan kode pelacakan untuk cek pesanan nanti.
                </p>
            </div>
        </CustomerMobileLayout>
    );
}
```

- [ ] **Step 4: Add CSS animation for checkmark**

In `resources/css/app.css`, add before the SweetAlert section:

```css
@keyframes scaleIn {
    from { transform: scale(0); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}
```

- [ ] **Step 5: Update checkout redirect to use confirm page**

In `app/Http/Controllers/Customer/CheckoutController.php`, replace lines 495-504:

```php
        // All orders go to confirmation page (except pickup guests who use track page)
        if ($fulfillmentType === 'pickup' && ! $request->user()) {
            $redirect = redirect()->route('track', [
                'token' => $order->recovery_token,
            ])->with('success', 'Order berhasil dibuat.');
        } else {
            $redirect = redirect()->route('customer.orders.confirm', [
                'orderCode' => $order->order_code,
            ]);
        }
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "confirm\|checkout\|order" | head -5`
Expected: No errors related to new files

- [ ] **Step 7: Commit**

```bash
git add resources/js/pages/customer/orders/confirm.tsx resources/css/app.css app/Http/Controllers/Customer/OrderController.php app/Http/Controllers/Customer/CheckoutController.php routes/web.php
git commit -m "feat: add order success confirmation page with animated checkmark and summary"
```

---

### Task 2: Order Status "What's Next" Section

**Files:**
- Modify: `resources/js/pages/customer/orders/show.tsx:176-179` (add section below StatusBadge)

**Interfaces:**
- Consumes: `order.status` (string), `order.outlet` (with latitude/longitude), `order.fulfillment_type`
- Produces: Inline `StatusGuidance` component rendered below StatusBadge

- [ ] **Step 1: Add STATUS_GUIDANCE map and StatusGuidance component**

In `resources/js/pages/customer/orders/show.tsx`, add after the `CANCELLABLE_STATUSES` constant (after line 27):

```tsx
const STATUS_GUIDANCE: Record<string, { description: string; nextStep?: string; cta?: { label: string; href?: string; action?: string } }> = {
    pending_confirmation: {
        description: 'Menunggu outlet mengkonfirmasi pesanan Anda',
        nextStep: 'Biasanya dikonfirmasi dalam beberapa menit',
    },
    confirmed: {
        description: 'Pesanan sudah dikonfirmasi oleh outlet',
        nextStep: 'Outlet sedang menyiapkan pesanan Anda',
    },
    preparing: {
        description: 'Pesanan sedang disiapkan',
        nextStep: 'Pesanan akan segera siap',
    },
    ready_for_pickup: {
        description: 'Pesanan sudah siap diambil!',
        nextStep: 'Silakan ambil di outlet sebelum jam tutup',
        cta: { label: 'Navigasi ke Outlet', action: 'navigate' },
    },
    out_for_delivery: {
        description: 'Kurir sedang dalam perjalanan',
        nextStep: 'Pesanan akan diantar ke lokasi Anda',
    },
    completed: {
        description: 'Pesanan telah selesai',
        nextStep: 'Terima kasih sudah pesan di Dombi!',
        cta: { label: 'Pesan Lagi', href: '/customer/products' },
    },
    rejected_by_outlet: {
        description: 'Outlet tidak dapat memproses pesanan',
        nextStep: 'Silakan coba pesan dari outlet lain',
        cta: { label: 'Pesan Lagi', href: '/customer/products' },
    },
    cancelled_by_customer: {
        description: 'Pesanan telah Anda batalkan',
        cta: { label: 'Pesan Lagi', href: '/customer/products' },
    },
    cancelled_by_outlet: {
        description: 'Pesanan dibatalkan oleh outlet',
        nextStep: 'Silakan coba pesan lagi',
        cta: { label: 'Pesan Lagi', href: '/customer/products' },
    },
    failed_delivery: {
        description: 'Pengiriman gagal',
        nextStep: 'Silakan hubungi kami untuk bantuan',
        cta: { label: 'Hubungi WhatsApp', href: 'https://wa.me/6281111111111' },
    },
    expired: {
        description: 'Pesanan kadaluarsa',
        nextStep: 'Outlet tidak konfirmasi dalam batas waktu',
        cta: { label: 'Pesan Lagi', href: '/customer/products' },
    },
};
```

- [ ] **Step 2: Add StatusGuidance rendering below StatusBadge**

In `resources/js/pages/customer/orders/show.tsx`, after the StatusBadge div (after line 179), add:

```tsx
                {/* What's Next Guidance */}
                {STATUS_GUIDANCE[order.status] && (() => {
                    const guidance = STATUS_GUIDANCE[order.status];
                    const isPickupReady = order.status === 'ready_for_pickup' && order.outlet?.latitude && order.outlet?.longitude;

                    return (
                        <div className="mt-3 rounded-xl border border-border bg-white p-4">
                            <div className="text-sm font-semibold text-text">{guidance.description}</div>
                            {guidance.nextStep && (
                                <div className="mt-1 text-xs text-text-muted">{guidance.nextStep}</div>
                            )}
                            {guidance.cta && (
                                <div className="mt-3">
                                    {isPickupReady && guidance.cta.action === 'navigate' ? (
                                        <a
                                            href={`https://www.google.com/maps/dir/?api=1&destination=${order.outlet.latitude},${order.outlet.longitude}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-white active:opacity-80"
                                        >
                                            <MapPin className="h-4 w-4" />
                                            {guidance.cta.label}
                                        </a>
                                    ) : guidance.cta.href ? (
                                        <Link
                                            href={guidance.cta.href}
                                            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-white active:opacity-80"
                                        >
                                            {guidance.cta.label}
                                        </Link>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    );
                })()}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "orders/show" | head -5`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/customer/orders/show.tsx
git commit -m "feat: add 'What's Next' guidance section below order status badge"
```

---

### Task 3: Pickup Loading Overlay Improvement

**Files:**
- Modify: `resources/js/pages/customer/home.tsx:434-481` (overlay section)

**Interfaces:**
- Consumes: `pickupLoading`, `pickupError`, `foundOutletName`, `nearestOutlet` state
- Produces: Updated overlay with hint text, distance, and retry button

- [ ] **Step 1: Update default state in overlay**

In `resources/js/pages/customer/home.tsx`, replace the default state text (line 475):

```tsx
                                <div className="text-sm font-medium text-emerald-100">Mencari outlet terdekat dari lokasi Anda</div>
```

With:

```tsx
                                <>
                                    <div className="text-sm font-medium text-emerald-100">Mencari outlet terdekat dari lokasi Anda</div>
                                    <div className="mt-2 text-xs text-emerald-200/70">Pastikan GPS aktif untuk hasil terbaik</div>
                                </>
```

- [ ] **Step 2: Update found state with distance**

In `resources/js/pages/customer/home.tsx`, replace the found state block (lines 468-473):

```tsx
                                    <>
                                        <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-200">Outlet Terdekat</div>
                                        <div className="mt-2 text-2xl font-bold text-white">{foundOutletName}</div>
                                        <div className="mt-3 text-sm text-emerald-100">Mengarahkan...</div>
                                    </>
```

With:

```tsx
                                    <>
                                        <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-200">Outlet Terdekat</div>
                                        <div className="mt-2 text-2xl font-bold text-white">{foundOutletName}</div>
                                        {nearestOutlet?.distance_km && (
                                            <div className="mt-1 text-sm text-emerald-200">{nearestOutlet.distance_km.toFixed(1)} km dari lokasi Anda</div>
                                        )}
                                        <div className="mt-3 text-sm text-emerald-100">Mengarahkan ke daftar produk...</div>
                                    </>
```

- [ ] **Step 3: Add "Coba lagi" button to error state**

In `resources/js/pages/customer/home.tsx`, replace the error state close button (lines 451-460):

```tsx
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPickupLoading(false);
                                        setPickupError(null);
                                        setFoundOutletName(null);
                                    }}
                                    className="mt-5 min-h-[44px] rounded-full bg-white/20 px-6 text-sm font-bold text-white active:opacity-80"
                                >
                                    Tutup
                                </button>
```

With:

```tsx
                                <div className="mt-5 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPickupError(null);
                                            setFoundOutletName(null);
                                            handlePickup();
                                        }}
                                        className="min-h-[44px] rounded-full bg-white/20 px-6 text-sm font-bold text-white active:opacity-80"
                                    >
                                        Coba Lagi
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPickupLoading(false);
                                            setPickupError(null);
                                            setFoundOutletName(null);
                                        }}
                                        className="min-h-[44px] rounded-full bg-white/10 px-6 text-sm font-medium text-white/80 active:opacity-80"
                                    >
                                        Tutup
                                    </button>
                                </div>
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/customer/home.tsx
git commit -m "feat: improve pickup loading overlay with GPS hint, distance, and retry button"
```

---

### Task 4: Home Page Improvements

**Files:**
- Modify: `resources/js/pages/customer/home.tsx:178-229` (hero carousel)
- Modify: `resources/js/pages/customer/home.tsx:327-395` ("Yang Menarik" section)
- Modify: `resources/js/pages/customer/home.tsx:397-414` (remove "Bantuan" section)

**Interfaces:**
- Consumes: `nearestOutlet` state, `activeOrder` prop, `isLoggedIn` state
- Produces: Updated hero CTA, improved cards, removed standalone bantuan section

- [ ] **Step 1: Update hero carousel height and CTA**

In `resources/js/pages/customer/home.tsx`, replace the carousel container (line 181):

```tsx
                    className="relative flex h-[320px] items-center justify-center transition-all duration-700"
```

With:

```tsx
                    className="relative flex h-[260px] items-center justify-center transition-all duration-700"
```

Replace the CTA link (lines 203-209):

```tsx
                        {HERO_SLIDES[slideIndex].cta && (
                            <Link
                                href={HERO_SLIDES[slideIndex].ctaHref!}
                                className="mt-4 inline-flex min-h-[44px] items-center px-2 text-sm font-semibold text-white/80 active:text-white"
                            >
                                Lihat Produk →
                            </Link>
                        )}
```

With:

```tsx
                        {HERO_SLIDES[slideIndex].cta && (
                            <Link
                                href={HERO_SLIDES[slideIndex].ctaHref!}
                                className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-white/20 backdrop-blur-sm px-6 text-sm font-bold text-white active:bg-white/30"
                            >
                                {HERO_SLIDES[slideIndex].cta}
                            </Link>
                        )}
```

- [ ] **Step 2: Update "Yang Menarik di Dombi" cards**

In `resources/js/pages/customer/home.tsx`, replace the second card "Outlet Terdekat" (lines 344-355):

```tsx
                    <Link
                        href="/customer/products"
                        className="group flex items-start gap-3 rounded-2xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm active:opacity-80"
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 transition-transform duration-200 group-hover:scale-105">
                            <MapPinned className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-text">Outlet Terdekat</div>
                            <div className="mt-0.5 text-xs leading-relaxed text-text-muted">Pesanan diproses dari outlet terbaik</div>
                        </div>
                    </Link>
```

With:

```tsx
                    <Link
                        href="/customer/products"
                        className="group flex items-start gap-3 rounded-2xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm active:opacity-80"
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 transition-transform duration-200 group-hover:scale-105">
                            <MapPinned className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-text">Outlet Terdekat</div>
                            <div className="mt-0.5 text-xs leading-relaxed text-text-muted">
                                {nearestOutlet?.name ? nearestOutlet.name : 'Pesanan diproses dari outlet terbaik'}
                            </div>
                        </div>
                    </Link>
```

Replace the third card "Riwayat Pesanan" (lines 357-383):

```tsx
                    {isLoggedIn ? (
                        <Link
                            href="/customer/orders"
                            className="group flex items-start gap-3 rounded-2xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm active:opacity-80"
                        >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 transition-transform duration-200 group-hover:scale-105">
                                <Package className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-text">Riwayat Pesanan</div>
                                <div className="mt-0.5 text-xs leading-relaxed text-text-muted">Lihat pesanan sebelumnya</div>
                            </div>
                        </Link>
                    ) : (
                        <a
                            href="/oauth/google"
                            className="group flex items-start gap-3 rounded-2xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm active:opacity-80"
                        >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 transition-transform duration-200 group-hover:scale-105">
                                <Package className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-text">Riwayat Pesanan</div>
                                <div className="mt-0.5 text-xs leading-relaxed text-text-muted">Login untuk melihat pesanan</div>
                            </div>
                        </a>
                    )}
```

With:

```tsx
                    {isLoggedIn ? (
                        <Link
                            href={activeOrder ? `/customer/orders/${activeOrder.id}` : '/customer/orders'}
                            className="group flex items-start gap-3 rounded-2xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm active:opacity-80"
                        >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 transition-transform duration-200 group-hover:scale-105">
                                <Package className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-text">{activeOrder ? 'Pesanan Aktif' : 'Riwayat Pesanan'}</div>
                                <div className="mt-0.5 text-xs leading-relaxed text-text-muted">
                                    {activeOrder ? activeOrder.order_code : 'Lihat pesanan sebelumnya'}
                                </div>
                            </div>
                        </Link>
                    ) : (
                        <a
                            href="/oauth/google"
                            className="group flex items-start gap-3 rounded-2xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm active:opacity-80"
                        >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 transition-transform duration-200 group-hover:scale-105">
                                <Package className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-text">Riwayat Pesanan</div>
                                <div className="mt-0.5 text-xs leading-relaxed text-text-muted">Login untuk melihat pesanan</div>
                            </div>
                        </a>
                    )}
```

Replace the fourth card "Kualitas Terjamin" (lines 385-393):

```tsx
                    <div className="group flex items-start gap-3 rounded-2xl border border-border bg-white p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50">
                            <ShieldCheck className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-text">Kualitas Terjamin</div>
                            <div className="mt-0.5 text-xs leading-relaxed text-text-muted">Diproses dengan standar kualitas Dombi</div>
                        </div>
                    </div>
```

With:

```tsx
                    <a
                        href="https://wa.me/6281111111111"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-start gap-3 rounded-2xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-sm active:opacity-80"
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 transition-transform duration-200 group-hover:scale-105">
                            <MessageCircle className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-text">Butuh Bantuan?</div>
                            <div className="mt-0.5 text-xs leading-relaxed text-text-muted">Hubungi tim Dombi via WhatsApp</div>
                        </div>
                    </a>
```

- [ ] **Step 3: Remove standalone "Bantuan" section**

In `resources/js/pages/customer/home.tsx`, delete the entire "SECTION 5 — BANTUAN" block (lines 397-414):

```tsx
            {/* SECTION 5 — BANTUAN */}
            <section className="mt-6">
                <a
                    href="https://wa.me/6281111111111"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-4 rounded-2xl border border-border bg-white px-4 py-4 transition-all duration-200 hover:shadow-sm active:opacity-80"
                >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 transition-transform duration-200 group-hover:scale-105">
                        <MessageCircle className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-text">Butuh Bantuan?</div>
                        <div className="mt-0.5 text-xs text-text-muted">Hubungi tim Dombi via WhatsApp</div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-text-subtle" />
                </a>
            </section>
```

- [ ] **Step 4: Remove unused ShieldCheck import**

In `resources/js/pages/customer/home.tsx`, update the import line to remove `ShieldCheck`:

```tsx
import { ChevronRight, MapPinned, MessageCircle, Milk, Package, Store, Truck, User } from 'lucide-react';
```

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/customer/home.tsx
git commit -m "feat: improve home page — hero CTA button, smarter cards, remove redundant bantuan section"
```

---

### Task 5: Product Pricing & Time Estimates

**Files:**
- Modify: `resources/js/pages/customer/products.tsx:265-280` (pass displayPrice)
- Modify: `resources/js/components/customer/variant-list-item.tsx:117-133` (show "Mulai dari" label)
- Modify: `resources/js/pages/customer/checkout/index.tsx:199-241` (add time estimates)

**Interfaces:**
- Consumes: `group.lowestPrice` (number) from products.tsx
- Produces: `displayPrice` prop shows "Mulai dari RpX" in VariantListItem; time estimates in FulfillmentCard

- [ ] **Step 1: Update VariantListItem to show "Mulai dari" label**

In `resources/js/components/customer/variant-list-item.tsx`, replace the price display (lines 126-128):

```tsx
                <div className="mt-1 text-base font-semibold text-zinc-900 tabular-nums">
                    {formatCurrency(displayPrice)}
                </div>
```

With:

```tsx
                <div className="mt-1 text-base font-semibold text-zinc-900 tabular-nums">
                    <span className="text-xs font-normal text-zinc-400">Mulai dari </span>
                    {formatCurrency(displayPrice)}
                </div>
```

- [ ] **Step 2: Add time estimates to FulfillmentCard in checkout**

In `resources/js/pages/customer/checkout/index.tsx`, update the FulfillmentCard component. In the `description` prop for each card, add the time estimate.

Replace the Pickup card (lines 153-164):

```tsx
                    <FulfillmentCard
                        active={fulfillmentType === 'pickup'}
                        title="Ambil di Outlet"
                        icon={<Store className="h-5 w-5 text-text-muted" />}
                        description="Ambil langsung di outlet terdekat."
                        onClick={() => setFulfillmentType('pickup')}
                        detail={nearestOutlet ? {
                            outletName: nearestOutlet.name,
                            distanceKm: nearestOutlet.distance_km,
                            stockAvailable: nearestOutlet.stock_available,
                        } : undefined}
                    />
```

With:

```tsx
                    <FulfillmentCard
                        active={fulfillmentType === 'pickup'}
                        title="Ambil di Outlet"
                        icon={<Store className="h-5 w-5 text-text-muted" />}
                        description="Ambil langsung di outlet terdekat."
                        estimate="Siap dalam 15-30 menit"
                        onClick={() => setFulfillmentType('pickup')}
                        detail={nearestOutlet ? {
                            outletName: nearestOutlet.name,
                            distanceKm: nearestOutlet.distance_km,
                            stockAvailable: nearestOutlet.stock_available,
                        } : undefined}
                    />
```

Replace the Delivery card (lines 165-183):

```tsx
                    <FulfillmentCard
                        active={fulfillmentType === 'delivery_dombi'}
                        title="Kurir Dombi"
                        icon={<Truck className="h-5 w-5 text-text-muted" />}
                        description="Diantar oleh kurir Dombi."
                        onClick={() => {
                            if (!isLoggedIn) {
                                setDeliverySheetOpen(true);

                                return;
                            }

                            setFulfillmentType('delivery_dombi');
                        }}
                        detail={deliveryPreview?.is_serviceable ? {
                            deliveryFee: deliveryPreview.delivery_fee,
                        } : undefined}
                    />
```

With:

```tsx
                    <FulfillmentCard
                        active={fulfillmentType === 'delivery_dombi'}
                        title="Kurir Dombi"
                        icon={<Truck className="h-5 w-5 text-text-muted" />}
                        description="Diantar oleh kurir Dombi."
                        estimate="Diantar dalam 30-60 menit"
                        onClick={() => {
                            if (!isLoggedIn) {
                                setDeliverySheetOpen(true);

                                return;
                            }

                            setFulfillmentType('delivery_dombi');
                        }}
                        detail={deliveryPreview?.is_serviceable ? {
                            deliveryFee: deliveryPreview.delivery_fee,
                        } : undefined}
                    />
```

- [ ] **Step 3: Update FulfillmentCard interface and rendering**

In `resources/js/pages/customer/checkout/index.tsx`, update the FulfillmentCard function signature and rendering. Replace the function signature (line 199):

```tsx
function FulfillmentCard({ active, title, icon, description, onClick, detail }: { active: boolean; title: string; icon: ReactNode; description: string; onClick: () => void; detail?: FulfillmentDetail }) {
```

With:

```tsx
function FulfillmentCard({ active, title, icon, description, estimate, onClick, detail }: { active: boolean; title: string; icon: ReactNode; description: string; estimate?: string; onClick: () => void; detail?: FulfillmentDetail }) {
```

Add the estimate rendering after the description div (after line 214):

```tsx
                    <div className="mt-1 text-xs leading-relaxed text-text-muted">{description}</div>
```

With:

```tsx
                    <div className="mt-1 text-xs leading-relaxed text-text-muted">{description}</div>
                    {estimate && (
                        <div className="mt-1.5 text-xs font-medium text-emerald-700">⏱ {estimate}</div>
                    )}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "products\|variant-list\|checkout" | head -5`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/customer/products.tsx resources/js/components/customer/variant-list-item.tsx resources/js/pages/customer/checkout/index.tsx
git commit -m "feat: add 'Mulai dari' price label in product list and time estimates in checkout fulfillment cards"
```
