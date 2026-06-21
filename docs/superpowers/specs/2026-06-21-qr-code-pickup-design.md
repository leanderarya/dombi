# QR Code Pickup Flow — Design Spec

**Date**: 2026-06-21
**Status**: Draft
**Author**: Arya

## Overview

Implement QR code-based pickup verification for Dombi App. When a customer picks up their order at an outlet, they show a QR code on their phone. The outlet scans the QR code to view order details and confirm handover.

## Motivation

Current pickup flow requires the customer to verbally provide their order code to the outlet staff. This is error-prone and slow. QR code scanning provides:
- Faster verification at the counter
- Reduced human error (no mistyped codes)
- Better audit trail

## Context

- **Tech stack**: Laravel 12 + Inertia.js + React 19 + TailwindCSS v4
- **Platform**: Web app wrapped with Capacitor for native Android (outlet, owner, courier). Customer has a separate Capacitor bundle.
- **Current state**: Order code displayed as text on tracking page. Outlet manually clicks "Serahkan ke Customer" button.
- **Capacitor status**: Not yet set up. QR scanning library: `@capacitor-mlkit/barcode-scanning` (recommended for native). Browser fallback: `html5-qrcode`.

## Architecture

### Data Flow

```
Customer (Mobile)                Outlet (Mobile/Tablet)
       │                                │
       │  Order → ready_for_pickup      │
       │                                │
       │  ← QR Code muncul ←           │
       │  (URL: /outlet/scan/{code})    │
       │                                │
       │  Show QR to outlet staff →     │
       │                                │  Open /outlet/scan
       │                                │  → Camera activates
       │                                │  → Scan QR
       │                                │  → Redirect to /outlet/orders/{id}
       │                                │  → Order detail displayed
       │                                │  → Click "Serahkan ke Customer"
       │                                │  → Order → completed
```

### QR Code Content

The QR code encodes a URL: `{APP_URL}/outlet/scan/{order_code}`

Using `order_code` (not `recovery_token`) because:
- Human-readable for manual fallback
- Already unique per order
- Easier to debug

### Dual-Environment Strategy

The same codebase runs in both browser and Capacitor. Detection logic:

```
if (Capacitor.isNativePlatform()) {
  // Use @capacitor-mlkit/barcode-scanning (native camera)
} else {
  // Use html5-qrcode (browser WebRTC fallback)
}
```

## Components

### 1. Customer Side — QR Code Display

**File**: `resources/js/pages/track.tsx`
**Component**: `PickupHero` (modified)

Changes:
- When `status === 'ready_for_pickup'`, render QR code image instead of text order code
- QR encodes: `{APP_URL}/outlet/scan/{order_code}`
- Below QR: show order code as fallback text
- Instruction text: "Tunjukkan QR ini ke kasir outlet"

**New dependency**: `qrcode.react` (npm)

### 2. Outlet Side — Scan Page

**Route**: `GET /outlet/scan`
**Controller**: `App\Http\Controllers\Outlet\ScanController`
**Page**: `resources/js/pages/outlet/scan.tsx`

**UI Structure:**
```
OutletScanPage
├── Header: "Scan QR Code"
├── Scanner Area
│   ├── Camera view (native or browser)
│   ├── Viewfinder overlay
│   └── Status text
├── Manual Input (fallback)
│   ├── Text input for order code
│   └── Submit button
└── Error states (permission denied, order not found, etc.)
```

**Flow:**
1. Outlet opens `/outlet/scan`
2. Camera activates (requests permission)
3. QR scanned → extract order_code from URL
4. API call to `GET /outlet/scan/{order_code}` to validate
5. If valid → redirect to `/outlet/orders/{order_id}`
6. If invalid → show appropriate error message

**New dependencies**:
- `html5-qrcode` — browser fallback scanner
- `@capacitor-mlkit/barcode-scanning` — native scanner (installed when Capacitor is set up)

### 3. Outlet Side — Scan Button on Dashboard

**File**: `resources/js/pages/outlet/dashboard.tsx`

Add a prominent card/button: "Scan QR untuk Ambil Pesanan"
- Large, easy-to-tap target for cashiers
- Links to `/outlet/scan`
- Icon: QR code or camera

### 4. Backend — Scan Controller

**File**: `app/Http/Controllers/Outlet/ScanController.php`

```php
class ScanController extends Controller
{
    // Render scan page (Inertia)
    public function index(): Response

    // Lookup order by code (API, returns JSON)
    public function lookup(string $order_code): JsonResponse
}
```

**`lookup()` validation:**
1. Find order by `order_code`
2. Verify order belongs to the logged-in outlet
3. Verify order status is `ready_for_pickup`
4. Return order data (id, customer_name, items, total) as JSON
5. Frontend redirects to `/outlet/orders/{order_id}`

**Routes:**
```php
Route::get('/scan', [ScanController::class, 'index'])->name('scan');
Route::get('/scan/{order_code}', [ScanController::class, 'lookup'])->name('scan.lookup');
```

### 5. Existing Flow — No Changes

- `Outlet\OrderController::completePickup()` — unchanged, already works
- `OrderStatusService::completePickup()` — unchanged
- Customer order detail page — unchanged (QR only on tracking page)

## Error Handling

| Scenario | UX |
|----------|-----|
| Camera permission denied | Show message + manual input form |
| QR scan fails repeatedly | Show manual input form prominently |
| Order not found | Error: "Pesanan tidak ditemukan" |
| Order belongs to different outlet | Error: "Pesanan bukan milik outlet Anda" |
| Order not in `ready_for_pickup` status | Error: "Pesanan belum siap diambil" or "Pesanan sudah selesai" |
| Customer has no QR (phone dead) | Outlet types order code manually in scan page |
| Duplicate scan | Safe — only redirects, no side effects |

## Security

- Scan URL contains no sensitive data (only `order_code`)
- Backend validates outlet ownership before returning order data
- Rate limiting on scan lookup endpoint (existing `throttle` middleware)
- Camera permission handled by OS/browser (no custom security needed)

## Dependencies

### npm (new)
- `qrcode.react` — QR code generation for customer
- `html5-qrcode` — browser-based QR scanning fallback

### npm (future, when Capacitor is set up)
- `@capacitor-mlkit/barcode-scanning` — native Android QR scanning

### No new Laravel packages required

## Files to Create/Modify

### New files:
- `app/Http/Controllers/Outlet/ScanController.php`
- `resources/js/pages/outlet/scan.tsx`

### Modified files:
- `resources/js/pages/track.tsx` — add QR code in `PickupHero`
- `resources/js/pages/outlet/dashboard.tsx` — add scan card
- `routes/web.php` — add scan routes
- `package.json` — add `qrcode.react` and `html5-qrcode`

## Out of Scope

- Capacitor setup and configuration (separate task)
- Native camera integration (depends on Capacitor setup)
- Customer-side Capacitor bundle (separate concern)
- Analytics/tracking for scan events
