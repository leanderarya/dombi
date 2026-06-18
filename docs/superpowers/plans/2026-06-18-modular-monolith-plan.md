# Modular Monolith - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split Dombi into 2 frontend bundles (Customer App + Internal App) while keeping single Laravel backend

**Architecture:** Modular Monolith - 1 Laravel backend, 2 Vite entry points, 2 Blade templates

**Tech Stack:** Laravel 13, React 19, Inertia.js, Vite 8, Tailwind CSS 4

---

## Overview

Split the frontend into two separate bundles:
- **Customer App**: Welcome, products, checkout, orders, tracking (PWA)
- **Internal App**: Owner, Outlet, Courier management (Admin)

Benefits:
- Smaller bundle size for customer PWA
- Better caching and performance
- Security: internal pages not bundled with customer code
- Independent deployments possible

---

### Task 1: Create Customer App Entry Point

**Files:**
- Create: `resources/js/customer-app.tsx`

- [ ] **Step 1: Create customer-app.tsx**

```tsx
import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';

const appName = import.meta.env.VITE_APP_NAME || 'Dombi';

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    progress: {
        color: '#047857',
    },
    resolve: (name) => {
        const pages = import.meta.glob('./pages/customer/**/*.tsx', { eager: true });
        const page = pages[`./pages/${name}.tsx`];
        if (!page) {
            throw new Error(`Page not found: ${name}`);
        }
        return page;
    },
    setup({ el, App, props }) {
        const root = createRoot(el!);
        root.render(
            <>
                <App {...props} />
                <Toaster position="top-center" richColors closeButton />
            </>
        );
    },
});

// Register service worker for PWA
if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {
            // SW registration failed - non-critical
        });
    });
}
```

- [ ] **Step 2: Test build**

Run: `npm run build`
Expected: Build successful

- [ ] **Step 3: Commit**

```bash
git add resources/js/customer-app.tsx
git commit -m "feat: create customer app entry point for modular monolith"
```

---

### Task 2: Create Internal App Entry Point

**Files:**
- Create: `resources/js/internal-app.tsx`

- [ ] **Step 1: Create internal-app.tsx**

```tsx
import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import DevToolbar from '@/components/dev-toolbar';

const appName = import.meta.env.VITE_APP_NAME || 'Dombi';

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName} Admin` : `${appName} Admin`),
    progress: {
        color: '#047857',
    },
    resolve: (name) => {
        const pages = import.meta.glob('./pages/{owner,outlet,courier,auth}/**/*.tsx', { eager: true });
        const page = pages[`./pages/${name}.tsx`];
        if (!page) {
            throw new Error(`Page not found: ${name}`);
        }
        return page;
    },
    setup({ el, App, props }) {
        const root = createRoot(el!);
        root.render(
            <>
                <App {...props} />
                <Toaster position="top-center" richColors closeButton />
                {(props.initialPage.props.dev as Record<string, unknown>)?.isLocal && (
                    <DevToolbar
                        currentRole={(props.initialPage.props.dev as Record<string, unknown>).currentRole as string | null}
                        env={(props.initialPage.props.dev as Record<string, unknown>).env as string}
                    />
                )}
            </>
        );
    },
});
```

- [ ] **Step 2: Test build**

Run: `npm run build`
Expected: Build successful

- [ ] **Step 3: Commit**

```bash
git add resources/js/internal-app.tsx
git commit -m "feat: create internal app entry point for modular monolith"
```

---

### Task 3: Create Blade Templates

**Files:**
- Create: `resources/views/customer-app.blade.php`
- Create: `resources/views/internal-app.blade.php`

- [ ] **Step 1: Create customer-app.blade.php**

```blade
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    
    {{-- PWA Meta Tags --}}
    <meta name="theme-color" content="#047857">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Dombi">
    <link rel="manifest" href="/manifest.json">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">

    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/customer-app.tsx', "resources/js/pages/{$page['component']}.tsx"])
    
    @inertiaHead
</head>
<body class="font-sans antialiased bg-[#fbf9f7]">
    @inertia
</body>
</html>
```

- [ ] **Step 2: Create internal-app.blade.php**

```blade
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">

    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/internal-app.tsx', "resources/js/pages/{$page['component']}.tsx"])
    
    @inertiaHead
</head>
<body class="font-sans antialiased bg-slate-50">
    @inertia
</body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add resources/views/customer-app.blade.php resources/views/internal-app.blade.php
git commit -m "feat: create separate Blade templates for customer and internal apps"
```

---

### Task 4: Create Middleware for Root View

**Files:**
- Create: `app/Http/Middleware/CustomerInertiaRoot.php`
- Create: `app/Http/Middleware/InternalInertiaRoot.php`

- [ ] **Step 1: Create CustomerInertiaRoot.php**

```php
<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class CustomerInertiaRoot extends Middleware
{
    protected $rootView = 'customer-app';

    public function share(Request $request): array
    {
        return array_merge(parent::share($request), [
            'auth' => [
                'user' => $request->user()?->only('id', 'name', 'email', 'role'),
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
        ]);
    }
}
```

- [ ] **Step 2: Create InternalInertiaRoot.php**

```php
<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class InternalInertiaRoot extends Middleware
{
    protected $rootView = 'internal-app';

    public function share(Request $request): array
    {
        return array_merge(parent::share($request), [
            'auth' => [
                'user' => $request->user()?->only('id', 'name', 'email', 'role'),
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
        ]);
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/Http/Middleware/CustomerInertiaRoot.php app/Http/Middleware/InternalInertiaRoot.php
git commit -m "feat: create Inertia middleware for customer and internal root views"
```

---

### Task 5: Update Bootstrap Configuration

**Files:**
- Modify: `bootstrap/app.php`

- [ ] **Step 1: Register new middleware aliases**

Add to the middleware alias array:

```php
'customer.inertia' => \App\Http\Middleware\CustomerInertiaRoot::class,
'internal.inertia' => \App\Http\Middleware\InternalInertiaRoot::class,
```

- [ ] **Step 2: Commit**

```bash
git add bootstrap/app.php
git commit -m "feat: register customer and internal Inertia middleware"
```

---

### Task 6: Update Routes

**Files:**
- Modify: `routes/web.php`

- [ ] **Step 1: Group routes by app**

```php
// Customer App Routes
Route::middleware(['customer.inertia'])->group(function () {
    // Welcome/Home
    Route::get('/', [CustomerHomeController::class, 'welcome'])->name('welcome');
    
    // Customer routes
    Route::prefix('customer')->name('customer.')->group(function () {
        // ... existing customer routes
    });
    
    // Public tracking
    Route::get('/track/{token}', [TrackController::class, 'show'])->name('track');
    
    // Guest mode
    Route::post('/guest-mode', [GuestModeController::class, 'activate'])->name('guest-mode');
});

// Internal App Routes
Route::middleware(['internal.inertia'])->group(function () {
    // Auth routes
    Route::get('/login', [LoginController::class, 'show'])->name('login');
    Route::post('/login', [LoginController::class, 'store']);
    Route::post('/logout', [LoginController::class, 'destroy'])->name('logout');
    
    // Dashboard redirect
    Route::get('/dashboard', [DashboardRedirectController::class, 'index'])->name('dashboard');
    
    // Password change
    Route::get('/password/change', [PasswordController::class, 'edit'])->name('password.edit');
    Route::post('/password/change', [PasswordController::class, 'update'])->name('password.update');
    
    // Owner routes
    Route::middleware(['auth', 'role:owner', 'password.changed'])
        ->prefix('owner')
        ->name('owner.')
        ->group(function () {
            // ... existing owner routes
        });
    
    // Outlet routes
    Route::middleware(['auth', 'role:outlet', 'password.changed'])
        ->prefix('outlet')
        ->name('outlet.')
        ->group(function () {
            // ... existing outlet routes
        });
    
    // Courier routes
    Route::middleware(['auth', 'role:courier', 'password.changed'])
        ->prefix('courier')
        ->name('courier.')
        ->group(function () {
            // ... existing courier routes
        });
    
    // Notifications (shared)
    Route::middleware(['auth'])->group(function () {
        Route::get('/notifications', [NotificationController::class, 'index'])->name('notifications.index');
        Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead'])->name('notifications.read');
    });
});
```

- [ ] **Step 2: Commit**

```bash
git add routes/web.php
git commit -m "feat: split routes into customer and internal app groups"
```

---

### Task 7: Update Vite Configuration

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Add two entry points**

```ts
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                'resources/css/app.css',
                'resources/js/customer-app.tsx',
                'resources/js/internal-app.tsx',
            ],
            refresh: true,
        }),
        react(),
        tailwindcss(),
    ],
});
```

- [ ] **Step 2: Test build**

Run: `npm run build`
Expected: Both bundles built successfully

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "feat: configure Vite with customer and internal app entry points"
```

---

### Task 8: Update HandleInertiaRequests (Remove Old)

**Files:**
- Delete: `resources/js/app.tsx` (old entry point)
- Keep: `resources/views/app.blade.php` (for backward compatibility)

- [ ] **Step 1: Verify new entry points work**

Run: `npm run build`
Expected: Build successful with both bundles

- [ ] **Step 2: Test both apps**

1. Visit `/` - should show customer welcome page
2. Visit `/login` - should show internal login page
3. Login as owner - should redirect to `/owner/dashboard`
4. Login as customer - should redirect to `/customer/home`

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: complete modular monolith split - customer and internal apps"
```

---

## Verification

After completing all tasks:

1. Run full test suite: `php artisan test`
2. Build frontend: `npm run build`
3. Test customer flow:
   - Visit `/` (welcome page)
   - Browse products
   - Add to cart
   - Checkout
4. Test internal flow:
   - Visit `/login`
   - Login as owner
   - Navigate dashboard
   - Login as outlet
   - Process orders

## Summary

| Task | Description | Est. |
|------|-------------|------|
| 1 | Create customer-app.tsx entry point | 0.5d |
| 2 | Create internal-app.tsx entry point | 0.5d |
| 3 | Create Blade templates | 0.5d |
| 4 | Create middleware for root view | 0.5d |
| 5 | Update bootstrap configuration | 0.5d |
| 6 | Update routes | 0.5d |
| 7 | Update Vite configuration | 0.5d |
| 8 | Test & verify | 1d |
| **Total** | | **4d** |
