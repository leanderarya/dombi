# Outlet Order Notifications — Implementation Plan

## Phase 1: Backend Foundation

### Step 1.1 — Install web-push package
```bash
composer require web-push/php
```

### Step 1.2 — Add VAPID config
**File:** `config/services.php`
- Add `vapid` key with `public_key`, `private_key`, `subject` from env

**File:** `.env.example`
- Add `VAPID_PUBLIC_KEY=`, `VAPID_PRIVATE_KEY=`, `VAPID_SUBJECT=`

### Step 1.3 — Create push subscriptions table
**File:** `database/migrations/2026_06_29_xxxxxx_create_outlet_push_subscriptions_table.php`
```php
Schema::create('outlet_push_subscriptions', function (Blueprint $table) {
    $table->id();
    $table->foreignId('outlet_id')->constrained()->cascadeOnDelete();
    $table->string('endpoint')->unique();
    $table->string('p256dh');
    $table->string('auth');
    $table->timestamps();
});
```

### Step 1.4 — Create OutletPushSubscription model
**File:** `app/Models/OutletPushSubscription.php`
- Fillable: `outlet_id`, `endpoint`, `p256dh`, `auth`
- BelongsTo: `outlet()`

### Step 1.5 — Add pendingCount endpoint
**File:** `app/Http/Controllers/Outlet/OrderController.php`
- Add `pendingCount()` method:
  ```php
  public function pendingCount(Request $request): JsonResponse
  {
      $outlet = $request->user()->outlet;
      abort_unless($outlet, 403);

      $count = Cache::remember(
          "outlet:{$outlet->id}:pending_orders",
          5,
          fn () => Order::where('outlet_id', $outlet->id)
              ->where('status', 'pending_confirmation')
              ->count()
      );

      return response()->json(['pending_count' => $count]);
  }
  ```

**File:** `routes/web.php`
- Add inside outlet middleware group:
  ```php
  Route::get('/orders/pending-count', [OutletOrderController::class, 'pendingCount'])->name('orders.pending-count');
  ```

### Step 1.6 — Create PushController
**File:** `app/Http/Controllers/Outlet/PushController.php`
- `subscribe(Request $request)`:
  - Validate: `endpoint` (required, url), `keys.p256dh` (required), `keys.auth` (required)
  - Upsert to `outlet_push_subscriptions` by `endpoint`
  - Return 200

**File:** `routes/web.php`
- Add: `Route::post('/push-subscribe', [PushController::class, 'subscribe'])->name('push-subscribe');`

### Step 1.7 — Create NewOrderNotification
**File:** `app/Notifications/NewOrderNotification.php`
- Implements `ShouldQueue`
- Channels: `database`, custom webpush channel
- `via()`: returns `['database', WebPushChannel::class]`
- `toDatabase()`: returns order data
- `toWebPush()`: returns `WebPushMessage` with title "Pesanan Baru", body "Pesanan #{order_code} dari {customer_name}", click_action `/outlet/orders/{id}`

### Step 1.8 — Dispatch notification on order creation
**File:** `app/Services/OrderService.php` (or wherever orders are created)
- After order is created and saved:
  ```php
  $outlet->user->notify(new NewOrderNotification($order));
  ```
- Also clear the cache: `Cache::forget("outlet:{$outlet->id}:pending_orders");`

### Step 1.9 — Create sound asset
**File:** `public/sounds/new-order.mp3`
- Source from: https://pixabay.com/sound-effects/search/notification/ (royalty-free)
- Or generate a simple chime using an online tone generator
- ~1 second, pleasant, not jarring

---

## Phase 2: Frontend — Polling + Badge + Sound

### Step 2.1 — Create useOrderAlert hook
**File:** `resources/js/hooks/use-order-alert.ts`
```ts
import { useEffect, useRef, useState } from 'react';

export function useOrderAlert() {
    const [pendingCount, setPendingCount] = useState(0);
    const prevCount = useRef(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        audioRef.current = new Audio('/sounds/new-order.mp3');
        audioRef.current.volume = 0.7;
    }, []);

    useEffect(() => {
        const fetchCount = async () => {
            try {
                const res = await fetch('/outlet/orders/pending-count');
                if (!res.ok) return;
                const data = await res.json();
                const count = data.pending_count;

                // Play sound if count increased and not on order detail page
                const isOrderDetail = /^\/outlet\/orders\/\d+/.test(window.location.pathname);
                if (count > prevCount.current && !isOrderDetail) {
                    audioRef.current?.play().catch(() => {});
                }

                prevCount.current = count;
                setPendingCount(count);
            } catch {}
        };

        fetchCount();
        const interval = setInterval(fetchCount, 10_000);
        return () => clearInterval(interval);
    }, []);

    return { pendingCount };
}
```

### Step 2.2 — Add badge to OutletBottomNav
**File:** `resources/js/components/outlet-bottom-nav.tsx`
- Accept `pendingCount` prop (default 0)
- In the Pesanan tab, render badge when `pendingCount > 0`:
  ```tsx
  {pendingCount > 0 && (
      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
          {pendingCount > 99 ? '99+' : pendingCount}
      </span>
  )}
  ```
- Add `relative` to the icon container

### Step 2.3 — Wire hook into OutletLayout
**File:** `resources/js/layouts/outlet-layout.tsx`
- Import `useOrderAlert`
- Call `const { pendingCount } = useOrderAlert()`
- Pass `pendingCount` to `<OutletBottomNav pendingCount={pendingCount} />`

### Step 2.4 — Add urgency banner to orders page
**File:** `resources/js/pages/outlet/orders/index.tsx`
- Import `useOrderAlert`
- Call `const { pendingCount } = useOrderAlert()`
- Render banner above order list when `pendingCount > 0`:
  ```tsx
  {pendingCount > 0 && (
      <button
          onClick={() => handleFilterChange('pending_confirmation')}
          className="mb-3 w-full rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-left text-sm transition-colors hover:bg-amber-100"
      >
          <span className="font-semibold text-amber-800">
              {pendingCount} pesanan menunggu konfirmasi
          </span>
          <span className="ml-1 text-amber-600">→</span>
      </button>
  )}
  ```

---

## Phase 3: Push Notifications

### Step 3.1 — Create usePushNotification hook
**File:** `resources/js/hooks/use-push-notification.ts`
```ts
import { useEffect } from 'react';

export function usePushNotification() {
    useEffect(() => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

        const subscribe = async () => {
            const registration = await navigator.serviceWorker.ready;

            // Check if already subscribed
            const existing = await registration.pushManager.getSubscription();
            if (existing) return;

            // Subscribe
            const vapidKey = document.querySelector('meta[name="vapid-public-key"]')?.getAttribute('content');
            if (!vapidKey) return;

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey),
            });

            // Send to backend
            await fetch('/outlet/push-subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getCsrfToken() },
                body: JSON.stringify(subscription.toJSON()),
            });
        };

        subscribe().catch(() => {});
    }, []);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function getCsrfToken(): string {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
}
```

### Step 3.2 — Add VAPID public key to HTML
**File:** `resources/views/app.blade.php` (or layout that renders Inertia)
- Add meta tag: `<meta name="vapid-public-key" content="{{ config('services.vapid.public_key') }}">`

### Step 3.3 — Wire push hook into OutletLayout
**File:** `resources/js/layouts/outlet-layout.tsx`
- Import `usePushNotification`
- Call `usePushNotification()` inside the component

### Step 3.4 — Update service worker with push handler
**File:** `public/sw.js`
- Add at the end:
  ```js
  // Push notification handler
  self.addEventListener('push', (event) => {
      if (!event.data) return;

      const data = event.data.json();
      const options = {
          body: data.body,
          icon: data.icon || '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          data: { url: data.click_action || '/outlet/orders' },
          vibrate: [200, 100, 200],
          tag: 'new-order',
          renotify: true,
      };

      event.waitUntil(self.registration.showNotification(data.title, options));
  });

  self.addEventListener('notificationclick', (event) => {
      event.notification.close();
      const url = event.notification.data?.url || '/outlet/orders';
      event.waitUntil(clients.openWindow(url));
  });
  ```

---

## Phase 4: Verification

### Step 4.1 — Generate VAPID keys
```bash
php artisan webpush:vapid
# Copy output to .env
```

### Step 4.2 — Run migration
```bash
php artisan migrate
```

### Step 4.3 — Test end-to-end
1. Open outlet app in browser
2. Place a test order as customer
3. Verify: badge appears on Pesanan tab within 10s
4. Verify: sound plays (if tab is active)
5. Verify: push notification arrives (if tab is inactive)
6. Verify: urgency banner shows on orders page
7. Verify: clicking banner filters to "Menunggu"
8. Verify: confirming order removes badge and decrements count

---

## File Summary

| # | File | Action |
|---|------|--------|
| 1 | `config/services.php` | Modify — add VAPID config |
| 2 | `.env.example` | Modify — add VAPID env vars |
| 3 | `database/migrations/xxx_create_outlet_push_subscriptions_table.php` | Create |
| 4 | `app/Models/OutletPushSubscription.php` | Create |
| 5 | `app/Http/Controllers/Outlet/OrderController.php` | Modify — add pendingCount |
| 6 | `app/Http/Controllers/Outlet/PushController.php` | Create |
| 7 | `app/Notifications/NewOrderNotification.php` | Create |
| 8 | `app/Services/OrderService.php` | Modify — dispatch notification |
| 9 | `routes/web.php` | Modify — add 2 routes |
| 10 | `public/sounds/new-order.mp3` | Create |
| 11 | `public/sw.js` | Modify — add push handler |
| 12 | `resources/views/app.blade.php` | Modify — add VAPID meta tag |
| 13 | `resources/js/hooks/use-order-alert.ts` | Create |
| 14 | `resources/js/hooks/use-push-notification.ts` | Create |
| 15 | `resources/js/components/outlet-bottom-nav.tsx` | Modify — add badge |
| 16 | `resources/js/layouts/outlet-layout.tsx` | Modify — wire hooks |
| 17 | `resources/js/pages/outlet/orders/index.tsx` | Modify — add urgency banner |
