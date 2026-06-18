# Dombi UX Improvement - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Dombi UX based on Jakob's Law principles to match competitor standards (GrabFood, GoFood, ShopeeFood)

**Architecture:** Enhance existing pages with better UX patterns, add missing features

**Tech Stack:** Laravel 13, React 19, Inertia.js, Tailwind CSS

---

## Priority Matrix

| Priority | Area | Impact | Effort |
|----------|------|--------|--------|
| P0 | Product Search | High | 2d |
| P0 | Remove forced fulfillment choice | High | 1d |
| P0 | Add product images (placeholder) | High | 1d |
| P1 | Real-time order tracking | High | 2d |
| P1 | Estimated delivery time | Medium | 1d |
| P1 | Courier contact button | Medium | 0.5d |
| P1 | Customer notification center | Medium | 2d |
| P2 | Simplify checkout (1-page) | High | 3d |
| P2 | Address autocomplete | Medium | 2d |
| P2 | Promo code input | Medium | 1d |
| P3 | Profile editing | Low | 1d |
| P3 | Ratings/reviews | Low | 3d |

**Total: ~20 days**

---

## Sprint 1: Customer UX (P0 fixes) - 4 days

### Task 1: Add Product Search

**Files:**
- Modify: `resources/js/pages/customer/products.tsx`
- Modify: `app/Http/Controllers/Customer/ProductController.php`

- [ ] **Step 1: Add search state and input to products page**

```tsx
const [search, setSearch] = useState('');

// Add search input at top of page
<div className="sticky top-0 z-10 bg-[#fbf9f7] px-4 py-3">
    <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari produk..."
            className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm"
        />
    </div>
</div>
```

- [ ] **Step 2: Add client-side filtering**

```tsx
const filteredFamilies = useMemo(() => {
    if (!search) return families;
    const q = search.toLowerCase();
    return families.filter(f => 
        f.name.toLowerCase().includes(q) ||
        f.variants.some(v => v.name.toLowerCase().includes(q))
    );
}, [families, search]);
```

- [ ] **Step 3: Test and commit**

Run: `npm run build && php artisan test`
Expected: PASS

---

### Task 2: Remove Forced Fulfillment Choice

**Files:**
- Modify: `resources/js/pages/customer/home.tsx`
- Modify: `resources/js/pages/customer/checkout/index.tsx`

- [ ] **Step 1: Change home page CTA**

Replace Pickup/Delivery choice cards with single "Pesan Sekarang" button:

```tsx
// Before: Two cards for Pickup and Delivery
// After: Single button
<button 
    onClick={() => router.get('/customer/products')} 
    className="w-full rounded-xl bg-emerald-600 py-4 text-sm font-bold text-white active:bg-emerald-700"
>
    Pesan Sekarang
</button>
```

- [ ] **Step 2: Add fulfillment toggle to checkout Step 1**

```tsx
<div className="flex gap-2 mb-4">
    <button 
        onClick={() => setFulfillment('pickup')} 
        className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
            fulfillment === 'pickup' 
                ? 'bg-emerald-600 text-white' 
                : 'bg-zinc-100 text-zinc-600'
        }`}
    >
        Pickup
    </button>
    <button 
        onClick={() => setFulfillment('delivery')}
        className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
            fulfillment === 'delivery' 
                ? 'bg-emerald-600 text-white' 
                : 'bg-zinc-100 text-zinc-600'
        }`}
    >
        Delivery
    </button>
</div>
```

- [ ] **Step 3: Test and commit**

---

### Task 3: Add Product Image Placeholders

**Files:**
- Create: `resources/js/components/customer/product-image.tsx`
- Modify: `resources/js/pages/customer/products.tsx`
- Modify: `resources/js/components/customer/variant-list-item.tsx`

- [ ] **Step 1: Create ProductImage component**

```tsx
interface ProductImageProps {
    name: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export default function ProductImage({ name, size = 'md', className = '' }: ProductImageProps) {
    const colors = [
        'from-emerald-100 to-emerald-200',
        'from-amber-100 to-amber-200',
        'from-blue-100 to-blue-200',
        'from-rose-100 to-rose-200',
        'from-purple-100 to-purple-200',
    ];
    const colorIndex = name.length % colors.length;
    const sizeClasses = { sm: 'h-12 w-12', md: 'h-16 w-16', lg: 'h-24 w-24' };
    
    return (
        <div className={`flex items-center justify-center rounded-xl bg-gradient-to-br ${colors[colorIndex]} ${sizeClasses[size]} ${className}`}>
            <span className={size === 'sm' ? 'text-lg' : size === 'md' ? 'text-2xl' : 'text-3xl'}>🐐</span>
        </div>
    );
}
```

- [ ] **Step 2: Replace all placeholder divs with ProductImage**

- [ ] **Step 3: Test and commit**

---

## Sprint 2: Order Tracking (P1) - 7 days

### Task 4: Add Real-Time Order Tracking

**Files:**
- Create: `resources/js/hooks/use-order-polling.ts`
- Modify: `resources/js/pages/customer/orders/show.tsx`

- [ ] **Step 1: Create polling hook**

```tsx
import { router } from '@inertiajs/react';
import { useEffect, useRef } from 'react';

export function useOrderPolling(orderId: number, intervalMs = 30000) {
    const timerRef = useRef<NodeJS.Timeout>();

    useEffect(() => {
        timerRef.current = setInterval(() => {
            router.reload({ only: ['order'] });
        }, intervalMs);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [orderId, intervalMs]);
}
```

- [ ] **Step 2: Add polling to order detail**

```tsx
useOrderPolling(order.id, 30000);
```

- [ ] **Step 3: Add last updated timestamp**

```tsx
<div className="text-[10px] text-zinc-400 mt-2">
    Diperbarui: {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
</div>
```

- [ ] **Step 4: Test and commit**

---

### Task 5: Add Estimated Delivery Time

**Files:**
- Create: `database/migrations/2026_06_18_000002_add_estimated_delivery_at_to_deliveries.php`
- Modify: `app/Services/DeliveryService.php`
- Modify: `resources/js/pages/customer/orders/show.tsx`

- [ ] **Step 1: Create migration**

```php
Schema::table('deliveries', function (Blueprint $table) {
    $table->timestamp('estimated_delivery_at')->nullable()->after('assigned_at');
});
```

- [ ] **Step 2: Set estimate when courier assigned**

```php
// In DeliveryService::assignCourier()
$delivery->update([
    'estimated_delivery_at' => now()->addMinutes(30),
]);
```

- [ ] **Step 3: Display on order page**

```tsx
{order.delivery?.estimated_delivery_at && (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="text-[11px] font-medium text-emerald-600">Estimasi Tiba</div>
        <div className="mt-1 text-lg font-bold text-emerald-700">
            {formatDate(order.delivery.estimated_delivery_at)}
        </div>
    </div>
)}
```

- [ ] **Step 4: Test and commit**

---

### Task 6: Add Courier Contact Button

**Files:**
- Modify: `resources/js/pages/customer/orders/show.tsx`

- [ ] **Step 1: Add contact buttons after courier card**

```tsx
{order.delivery?.courier && (
    <div className="flex gap-2 mt-3">
        <a 
            href={`tel:${order.delivery.courier.phone}`}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-sm font-bold text-white"
        >
            <Phone className="h-4 w-4" />
            Telepon
        </a>
        <a 
            href={`https://wa.me/${order.delivery.courier.phone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-600 py-3 text-sm font-bold text-emerald-600"
        >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
        </a>
    </div>
)}
```

- [ ] **Step 2: Test and commit**

---

### Task 7: Add Customer Notification Center

**Files:**
- Create: `app/Http/Controllers/Customer/NotificationController.php`
- Create: `resources/js/pages/customer/notifications.tsx`
- Modify: `resources/js/components/customer/bottom-nav.tsx`
- Modify: `app/Services/NotificationService.php`

- [ ] **Step 1: Create controller**

```php
class NotificationController extends Controller
{
    public function index(Request $request): Response
    {
        $customer = $request->user()->customer;
        
        $notifications = Notification::where('customer_id', $customer?->id)
            ->latest()
            ->paginate(20);

        return Inertia::render('customer/notifications', [
            'notifications' => $notifications,
        ]);
    }

    public function markRead(Request $request, Notification $notification): RedirectResponse
    {
        $notification->update(['read_at' => now()]);
        return back();
    }
}
```

- [ ] **Step 2: Add notification constants and methods**

```php
// In NotificationService
public const CUSTOMER_ORDER_STATUS = 'customer.order_status';

public function notifyCustomerOrderStatusChanged(Order $order, string $status): void
{
    if (!$order->customer_id) return;

    $this->create(
        userType: 'customer',
        userId: null,
        customerId: $order->customer_id,
        type: self::CUSTOMER_ORDER_STATUS,
        title: 'Status Pesanan',
        message: "Pesanan {$order->order_code} berstatus: {$status}",
        data: ['order_id' => $order->id, 'status' => $status],
        entityType: 'order',
        entityId: $order->id
    );
}
```

- [ ] **Step 3: Create notifications page**

```tsx
export default function CustomerNotifications({ notifications }: Props) {
    return (
        <CustomerLayout title="Notifikasi">
            {notifications.data.length === 0 ? (
                <EmptyState icon={<Bell className="h-8 w-8 text-slate-400" />} title="Belum ada notifikasi" />
            ) : (
                <div className="space-y-2">
                    {notifications.data.map((n) => (
                        <div key={n.id} className={`rounded-xl border p-4 ${n.read_at ? 'bg-white border-zinc-200' : 'bg-emerald-50 border-emerald-200'}`}>
                            <div className="text-sm font-semibold text-slate-900">{n.title}</div>
                            <div className="text-xs text-zinc-500 mt-0.5">{n.message}</div>
                            <div className="text-[10px] text-zinc-400 mt-1">{formatDate(n.created_at)}</div>
                        </div>
                    ))}
                </div>
            )}
        </CustomerLayout>
    );
}
```

- [ ] **Step 4: Add to bottom nav**

```tsx
{ href: '/customer/notifications', label: 'Notifikasi', icon: Bell },
```

- [ ] **Step 5: Test and commit**

---

## Sprint 3: Checkout UX Improvement (P2) - 5 days

### Task 8: Improve Checkout Step 2 UX

**Goal:** Reduce friction in the customer info/address step for delivery users

**Files:**
- Modify: `resources/js/pages/customer/checkout/customer.tsx`
- Modify: `resources/js/components/customer/location-search-panel.tsx`
- Modify: `resources/js/components/customer/pickup-outlet-selector.tsx`

**Current Issues:**
1. `LocationSearchPanel` terlalu kompleks (search + map + detail + landmark dalam 1 view)
2. Guest tidak bisa delivery (diblock login sheet)
3. Returning customer harus isi ulang jika location belum tersimpan

- [ ] **Step 1: Auto-advance untuk returning user**

Jika name, phone, dan location sudah tersimpan, tampilkan summary card dengan tombol "Edit" untuk expand:

```tsx
// Di customer.tsx, tambah logic auto-advance
const isReturningUser = customerName && phoneNumber && savedLocation;

{isReturningUser && !showFullForm ? (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between">
            <div>
                <div className="text-sm font-semibold text-slate-900">{customerName}</div>
                <div className="text-xs text-zinc-500">{phoneNumber}</div>
                <div className="text-xs text-zinc-400 mt-1">{savedLocation.address}</div>
            </div>
            <button onClick={() => setShowFullForm(true)} className="text-xs font-medium text-emerald-600">
                Edit
            </button>
        </div>
    </div>
) : (
    // Full form with LocationSearchPanel
)}
```

- [ ] **Step 2: Merge address detail fields**

Gabungkan "Detail Alamat" dan "Patokan" ke dalam 1 card yang sama dengan map pin, bukan card terpisah:

```tsx
// Di location-search-panel.tsx, setelah map pin section
<div className="rounded-xl border border-zinc-200 bg-white p-4 mt-3">
    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Detail Lokasi</div>
    <div className="space-y-3">
        <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Detail Alamat</label>
            <input ... />
        </div>
        <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Patokan / Ciri Rumah</label>
            <input ... />
        </div>
    </div>
</div>
```

- [ ] **Step 3: Guest delivery flow**

Hapus blocking login sheet. Biarkan guest isi form delivery, login diminta di payment step:

```tsx
// Di customer.tsx, hapus DeliveryLoginSheet blocking
// Guest bisa isi form delivery, tapi saat submit ke payment:
if (!user && fulfillment === 'delivery') {
    // Show login prompt di payment step, bukan di Step 2
}
```

- [ ] **Step 4: Test and commit**

---

### Task 9: Add Address Autocomplete

**Files:**
- Modify: `resources/js/components/customer/address-form.tsx`

- [ ] **Step 1: Add Nominatim search function**

```tsx
const searchAddress = async (query: string) => {
    if (query.length < 3) return [];
    const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=id&limit=5`
    );
    return response.json();
};
```

- [ ] **Step 2: Add search input with dropdown results**

```tsx
<div className="relative">
    <input
        type="text"
        value={addressSearch}
        onChange={(e) => {
            setAddressSearch(e.target.value);
            debouncedSearch(e.target.value);
        }}
        placeholder="Ketik alamat untuk mencari..."
        className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm"
    />
    {searchResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-lg border border-zinc-200 bg-white shadow-lg max-h-48 overflow-y-auto">
            {searchResults.map((result) => (
                <button
                    key={result.place_id}
                    onClick={() => selectAddress(result)}
                    className="w-full px-3 py-2.5 text-left text-sm hover:bg-zinc-50 border-b border-zinc-100 last:border-0"
                >
                    <div className="font-medium text-slate-900">{result.display_name.split(',')[0]}</div>
                    <div className="text-xs text-zinc-500">{result.display_name.split(',').slice(1, 3).join(',')}</div>
                </button>
            ))}
        </div>
    )}
</div>
```

- [ ] **Step 3: Auto-fill fields from selection**

```tsx
const selectAddress = (result: any) => {
    const parts = result.display_name.split(',').map((s: string) => s.trim());
    setData(prev => ({
        ...prev,
        address: result.display_name,
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
    }));
    setSearchResults([]);
    setAddressSearch('');
};
```

- [ ] **Step 4: Test and commit**

---

## Verification

After completing all tasks:

1. Run full test suite: `php artisan test`
2. Run linter: `./vendor/bin/pint --test`
3. Build frontend: `npm run build`
4. Test all customer flows manually
5. Verify mobile responsiveness

## Summary

| Sprint | Tasks | Est. |
|--------|-------|------|
| Sprint 1 (P0) | Search, fulfillment choice, product images | 4d |
| Sprint 2 (P1) | Real-time tracking, ETA, courier contact, notifications | 7d |
| Sprint 3 (P2) | Checkout Step 2 UX, address autocomplete | 5d |
| **Total** | | **16d** |
