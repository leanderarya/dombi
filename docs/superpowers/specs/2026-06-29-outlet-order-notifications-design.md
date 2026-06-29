# Outlet Order Notifications Design

## Problem

Outlet staff don't realize when new orders come in. Customers wait too long for confirmation. The existing auto-expire (15 minutes) works, but the outlet should be proactively notified so they can act before orders expire.

## Current State

- **Auto-expire exists**: `confirmation_expires_at` set to 15 min on order creation. `orders:expire-pending` command runs scheduled.
- **No notification**: Outlet has no badge, sound, or push alert for new orders.
- **Polling exists**: `NotificationBell` polls `/notifications/unread-count` every 30s. Service worker registered.
- **Bottom nav**: 4 tabs (Dashboard, Pesanan, Scan, Inventaris) — no badge on any tab.

## Solution: Polling + Badge + Sound + Push Notification

### Data Flow

```
Customer places order
       │
       ▼
OrderController::store()
  → status: pending_confirmation
  → confirmation_expires_at: now() + 15min
  → dispatch NewOrderNotification to outlet user
       │
       ▼
Outlet app polls GET /outlet/orders/pending-count (every 10s)
       │
       ├── Badge merah di tab "Pesanan" (count > 0)
       ├── Sound alert (count naik dari sebelumnya)
       └── Push notification (jika tab tidak aktif)
```

### Components

#### 1. Badge on Pesanan Tab (`OutletBottomNav`)

- Red badge with count above the Pesanan icon
- Same style as `NotificationBell` badge: `bg-red-500 text-white rounded-full h-5 min-w-5`
- Shows when `pendingCount > 0`, hidden when `0`
- Max display: `99+`

#### 2. Sound Alert (`useOrderAlert` hook)

- Audio file: `/sounds/new-order.mp3` (short chime, ~1 second)
- Trigger: when `pendingCount` increases (prev < current)
- Does not play when outlet is on the order detail page (URL starts with `/outlet/orders/` followed by an ID)
- Volume: 0.7
- Fallback: `Audio` API, skip if browser blocks autoplay
- Hook returns `{ pendingCount, isLoading }` — used by `OutletBottomNav` and orders page

#### 3. Push Notification (`usePushNotification` hook)

- Register VAPID public key via `PushManager.subscribe()`
- Send subscription to backend `POST /outlet/push-subscribe`
- Backend sends push via `web-push` PHP package when new order arrives
- Title: "Pesanan Baru"
- Body: "Pesanan #ORD-001 dari Customer Name"
- Click: opens `/outlet/orders/{id}`

#### 4. Urgency Banner on Orders Page

- Yellow/red banner at top of order list: "3 pesanan menunggu konfirmasi"
- Only shows when `pending_confirmation` orders exist
- Click → auto-filter to "Menunggu" status

### Backend

#### Endpoint: `GET /outlet/orders/pending-count`

```
Route: GET /outlet/orders/pending-count
Controller: Outlet\OrderController@pendingCount
Auth: outlet user
Response: { pending_count: int }
Cache: 5 seconds (small TTL, polling every 10s)
```

#### Endpoint: `POST /outlet/push-subscribe`

```
Route: POST /outlet/push-subscribe
Controller: Outlet\PushController@subscribe
Body: { endpoint, keys: { p256dh, auth } }
Action: Save to outlet_push_subscriptions table
```

#### Database: `outlet_push_subscriptions` table

```
- id
- outlet_id (FK)
- endpoint (string, unique)
- p256dh (string)
- auth (string)
- created_at, updated_at
```

#### Notification: `NewOrderNotification`

- Trigger: When new order is created for an outlet
- Channels: database + webpush
- Data: order_id, order_code, customer_name, total
- WebPush payload: title, body, icon, click_action

#### Config: `config/services.php`

```php
'vapid' => [
    'public_key' => env('VAPID_PUBLIC_KEY'),
    'private_key' => env('VAPID_PRIVATE_KEY'),
    'subject' => env('VAPID_SUBJECT', 'mailto:dombi@example.com'),
],
```

#### Package: `web-push/php`

```
composer require web-push/php
```

#### Sound file: `public/sounds/new-order.mp3`

- Short chime, ~1 second, not annoying

#### Service Worker: `public/sw.js`

- Handle `push` event → show notification
- Handle `notificationclick` → open URL

### Integration Pattern

`useOrderAlert` is a global hook that lives in the outlet layout. It:
1. Polls `GET /outlet/orders/pending-count` every 10 seconds
2. Tracks `prevCount` vs `currentCount` to detect increases
3. Plays sound on increase (unless on order detail page)
4. Returns `{ pendingCount }` to consumers

`OutletLayout` calls `useOrderAlert()` and passes `pendingCount` to `OutletBottomNav` via props. The orders page also calls `useOrderAlert()` for the urgency banner (or receives it via Inertia shared props).

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `app/Http/Controllers/Outlet/OrderController.php` | Modify | Add `pendingCount()` method |
| `app/Http/Controllers/Outlet/PushController.php` | Create | `subscribe()` method |
| `app/Notifications/NewOrderNotification.php` | Create | WebPush notification |
| `app/Models/OutletPushSubscription.php` | Create | Model for push subs |
| `database/migrations/xxx_create_outlet_push_subscriptions_table.php` | Create | Table |
| `config/services.php` | Modify | Add VAPID config |
| `routes/web.php` | Modify | Add 2 new routes |
| `public/sounds/new-order.mp3` | Create | Sound asset |
| `public/sw.js` | Modify | Add push handler |
| `resources/js/hooks/use-order-alert.ts` | Create | Sound + polling hook |
| `resources/js/hooks/use-push-notification.ts` | Create | Push subscription hook |
| `resources/js/components/outlet-bottom-nav.tsx` | Modify | Add badge |
| `resources/js/pages/outlet/orders/index.tsx` | Modify | Add urgency banner |
| `resources/js/layouts/outlet-layout.tsx` | Modify | Pass pendingCount |

### VAPID Key Generation

```bash
# Generate VAPID keys (one-time)
php artisan webpush:vapid
# Or manually:
# openssl ecparam -name prime256v1 -genkey -noout -out vapid_private.pem
# openssl ec -in vapid_private.pem -pubout -out vapid_public.pem
```

### Success Criteria

1. Badge appears on Pesanan tab within 10 seconds of order placement
2. Sound plays when new order arrives (if tab is active)
3. Push notification delivered when tab is inactive
4. Urgency banner shows on orders page when pending orders exist
5. All existing order flow (confirm, reject, expire) unchanged
