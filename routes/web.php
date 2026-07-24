<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\PasswordChangeController;
use App\Http\Controllers\Auth\SocialAuthController;
use App\Http\Controllers\Courier\CourierAvailabilityController;
use App\Http\Controllers\Courier\DeliveryController as CourierDeliveryController;
use App\Http\Controllers\Courier\LocationController;
use App\Http\Controllers\Customer\AccountPromotionController;
use App\Http\Controllers\Customer\AddressController as CustomerAddressController;
use App\Http\Controllers\Customer\CartController;
use App\Http\Controllers\Customer\CheckoutController as CustomerCheckoutController;
use App\Http\Controllers\Customer\CustomerOutletController;
use App\Http\Controllers\Customer\CustomerProductApiController;
use App\Http\Controllers\Customer\FavoriteController;
use App\Http\Controllers\CustomerOfflineController;
use App\Http\Controllers\Customer\GuestOrderController;
use App\Http\Controllers\Customer\GuestOrderRecoveryController;
use App\Http\Controllers\Customer\HomeController as CustomerHomeController;
use App\Http\Controllers\Customer\OrderController as CustomerOrderController;
use App\Http\Controllers\Customer\OrderReportController;
use App\Http\Controllers\Customer\ProductController as CustomerProductController;
use App\Http\Controllers\Customer\ProfileController;
use App\Http\Controllers\Customer\RecipientController;
use App\Http\Controllers\DashboardRedirectController;
use App\Http\Controllers\DevRoleSwitcherController;
use App\Http\Controllers\DokuPaymentController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PushController as UnifiedPushController;
use App\Http\Controllers\Outlet\AnalyticsController as OutletAnalyticsController;
use App\Http\Controllers\Outlet\DashboardController;
use App\Http\Controllers\Outlet\DeliveryController as OutletDeliveryController;
use App\Http\Controllers\Outlet\ExchangeController as OutletExchangeController;
use App\Http\Controllers\Outlet\InventoryController as OutletInventoryController;
use App\Http\Controllers\Outlet\OfflineSaleController;
use App\Http\Controllers\Outlet\OrderController as OutletOrderController;
use App\Http\Controllers\Outlet\PushController;
use App\Http\Controllers\Outlet\ReportController as OutletReportController;
use App\Http\Controllers\Outlet\RestockController as OutletRestockController;
use App\Http\Controllers\Outlet\ReturnController as OutletReturnController;
use App\Http\Controllers\Outlet\ScanController as OutletScanController;
use App\Http\Controllers\Outlet\CourierController as OutletCourierController;
use App\Http\Controllers\Outlet\SettlementController;
use App\Http\Controllers\Owner\AnalyticsController as OwnerAnalyticsController;
use App\Http\Controllers\Owner\DeliveryTierController;
use App\Http\Controllers\Owner\DashboardController as OwnerDashboardController;
use App\Http\Controllers\Owner\DeliveryController as OwnerDeliveryController;
use App\Http\Controllers\Owner\ExchangeController as OwnerExchangeController;
use App\Http\Controllers\Owner\FinanceSettlementController;
use App\Http\Controllers\Owner\InventoryController as OwnerInventoryController;
use App\Http\Controllers\Owner\OrderController as OwnerOrderController;
use App\Http\Controllers\Owner\OutletController as OwnerOutletController;
use App\Http\Controllers\Owner\OutletHolidayController;
use App\Http\Controllers\Owner\OutletOperatingHoursController;
use App\Http\Controllers\Owner\OutletProductController;
use App\Http\Controllers\Owner\PaymentAccountController;
use App\Http\Controllers\Owner\PricingController;
use App\Http\Controllers\Owner\ProductController as OwnerProductController;
use App\Http\Controllers\Owner\ProductFamilyController;
use App\Http\Controllers\Owner\ProductVariantController;
use App\Http\Controllers\Owner\ProfileController as OwnerProfileController;
use App\Http\Controllers\Owner\ReportController;
use App\Http\Controllers\Owner\RestockController as OwnerRestockController;
use App\Http\Controllers\Owner\RefundController;
use App\Http\Controllers\Owner\ReturnController as OwnerReturnController;
use App\Http\Controllers\Owner\SettlementPaymentController;

use App\Http\Controllers\SystemController;

use App\Models\Outlet;

use App\Http\Controllers\TrackController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::middleware(['customer.inertia', 'enforce.session'])->group(function (): void {
    Route::get('/', function () {
        if (auth()->check()) {
            return redirect()->route('dashboard');
        }

        // Always show welcome page for unauthenticated users
        return Inertia::render('customer/welcome');
    })->name('home');

    Route::post('/guest-mode', function () {
        session(['guest_mode' => true]);

        return redirect()->route('customer.home');
    })->name('guest-mode');

    if (app()->isLocal()) {
        Route::get('/reset-guest-mode', function () {
            session()->forget('guest_mode');

            return redirect('/');
        })->name('reset-guest-mode');
    }

    Route::get('/track/{token}', TrackController::class)->middleware('throttle:track')->name('track');
    Route::get('/offline', [\App\Http\Controllers\CustomerOfflineController::class, 'index'])->name('offline');

    // Customer routes
    Route::middleware('guest.or.customer')->prefix('customer')->name('customer.')->group(function (): void {
        // --- Read routes — no store-open check (browsing allowed when closed) ---
        Route::get('/home', CustomerHomeController::class)->name('home');
        Route::post('/fulfillment-draft', [CustomerHomeController::class, 'setFulfillmentDraft'])->name('fulfillment-draft');
        Route::post('/location', [CustomerCheckoutController::class, 'storeLocationDraft'])->name('location.store');
        Route::get('/help', fn () => Inertia::render('customer/help'))->name('help');
        Route::get('/about', fn () => Inertia::render('customer/about'))->name('about');
        Route::get('/outlets', [CustomerOutletController::class, 'index'])->name('outlets.index');
        Route::get('/products', [CustomerProductController::class, 'index'])->name('products.index');
        Route::get('/products/api', [CustomerProductApiController::class, 'index'])->name('products.api');
        Route::get('/products/{family}', [CustomerProductController::class, 'show'])->name('products.show');
        Route::get('/orders', [CustomerOrderController::class, 'index'])->name('orders.index');
        Route::get('/profile', [ProfileController::class, 'index'])->name('profile');
        Route::post('/select-outlet', [CartController::class, 'selectOutlet'])->name('select-outlet');
        Route::get('/checkout', [CustomerCheckoutController::class, 'index'])->name('checkout.index');
        Route::get('/checkout/customer', [CustomerCheckoutController::class, 'customer'])->name('checkout.customer');
        Route::get('/checkout/customer-lookup', [CustomerCheckoutController::class, 'lookupCustomer'])->middleware('throttle:lookup')->name('checkout.customer.lookup');
        Route::get('/checkout/login-prompt', fn () => Inertia::render('customer/checkout/login-prompt'))->name('checkout.login-prompt');
        Route::get('/checkout/payment', [CustomerCheckoutController::class, 'payment'])->name('checkout.payment');
        Route::get('/checkout/validate-stock', [CustomerCheckoutController::class, 'validateStock'])->name('checkout.validate-stock');
        Route::get('/checkout/pickup-outlets', [CustomerCheckoutController::class, 'pickupOutlets'])->name('checkout.pickup-outlets');
        Route::get('/orders/{order}/confirmation/{token}', [CustomerOrderController::class, 'confirmation'])->name('orders.confirmation');
        Route::get('/orders/confirm/{orderCode}', [CustomerOrderController::class, 'confirm'])->name('orders.confirm');
        Route::post('/orders/recovery', GuestOrderRecoveryController::class)->middleware('throttle:recovery')->name('orders.recovery');

        // --- Mutation routes — store-open checked (blocked when closed) ---
        Route::middleware('store.open')->group(function (): void {
            Route::post('/cart/add', [CartController::class, 'addItem'])->name('cart.add');
            Route::post('/cart/remove', [CartController::class, 'removeItem'])->name('cart.remove');
            Route::post('/cart/quantity', [CartController::class, 'setQuantity'])->name('cart.quantity');
            Route::post('/checkout', [CustomerCheckoutController::class, 'storeIndex'])->name('checkout.store');
            Route::post('/checkout/customer', [CustomerCheckoutController::class, 'storeCustomer'])->name('checkout.customer.store');
            Route::post('/checkout/payment', [CustomerCheckoutController::class, 'submit'])->middleware('throttle:payment-submit')->name('checkout.process-payment');
            Route::post('/orders', [CustomerOrderController::class, 'store'])->name('orders.store');
            Route::post('/register', [AccountPromotionController::class, 'register'])->middleware('throttle:3,1')->name('register');
        });
    });

    Route::middleware(['auth', 'role:customer'])->prefix('customer')->name('customer.')->group(function (): void {
        // Phone verification (Google OAuth users without phone)
        Route::get('/verify-phone', [SocialAuthController::class, 'showVerifyPhone'])->name('verify-phone.show');

        Route::post('/verify-phone', [SocialAuthController::class, 'verifyPhone'])->name('verify-phone');

        Route::get('/orders/{order}', [CustomerOrderController::class, 'show'])->name('orders.show');
        Route::patch('orders/{order}/refund-destination', [CustomerOrderController::class, 'updateRefundDestination'])
            ->name('orders.refund-destination.update');
        Route::post('/orders/{order}/cancel', [CustomerOrderController::class, 'cancel'])->name('orders.cancel');
        Route::post('/orders/{order}/report', [OrderReportController::class, 'store'])->name('orders.report')->middleware('throttle:order-report');
        Route::get('/addresses', [CustomerAddressController::class, 'index'])->name('addresses.index');
        Route::get('/addresses/api', [CustomerAddressController::class, 'apiIndex'])->name('addresses.api');
        Route::get('/addresses/create', [CustomerAddressController::class, 'create'])->name('addresses.create');
        Route::post('/addresses', [CustomerAddressController::class, 'store'])->name('addresses.store');
        Route::post('/addresses/from-checkout', [CustomerAddressController::class, 'storeFromCheckout'])->name('addresses.store-from-checkout');
        Route::get('/addresses/{address}/edit', [CustomerAddressController::class, 'edit'])->name('addresses.edit');
        Route::put('/addresses/{address}', [CustomerAddressController::class, 'update'])->name('addresses.update');
        Route::delete('/addresses/{address}', [CustomerAddressController::class, 'destroy'])->name('addresses.destroy');
        Route::post('/addresses/{address}/set-default', [CustomerAddressController::class, 'setDefault'])->name('addresses.set-default');
        Route::get('/recipients', [RecipientController::class, 'index'])->name('recipients.index');
        Route::post('/recipients', [RecipientController::class, 'store'])->name('recipients.store');
        Route::put('/recipients/{recipient}', [RecipientController::class, 'update'])->name('recipients.update');
        Route::delete('/recipients/{recipient}', [RecipientController::class, 'destroy'])->name('recipients.destroy');

        // Favorites (server-persisted per account)
        Route::get('/favorites', [FavoriteController::class, 'index'])->name('favorites.index');
        Route::post('/favorites/toggle', [FavoriteController::class, 'toggle'])->name('favorites.toggle');
        Route::post('/favorites/merge', [FavoriteController::class, 'merge'])->name('favorites.merge');
    });

    Route::middleware('customer.or.recovered')->prefix('customer')->name('customer.')->group(function (): void {
        Route::post('/orders/{order}/repeat', [CustomerOrderController::class, 'repeat'])->name('orders.repeat');
        Route::get('/orders/{order}/restore-cart', [CustomerOrderController::class, 'restoreCart'])->name('orders.restore-cart');
        Route::post('/cart/restore', [CartController::class, 'restore'])->name('cart.restore');
    });
});

// Pay — must be accessible to guest (no auth required, ownership checked in controller)
Route::post('/customer/orders/{order}/pay', [CustomerOrderController::class, 'pay'])->middleware('throttle:pay-token')->name('orders.pay');

// Payment status polling — accessible to guest (same ownership check as pay)
Route::get('/customer/orders/{order}/payment-status', [CustomerOrderController::class, 'paymentStatus'])->middleware('throttle:60,1')->name('orders.payment-status');

// Guest cancel — no auth, token-validated via GuestCancelOrderRequest
Route::prefix('guest')->middleware(['throttle:guest-cancel'])->group(function () {
    Route::get('/orders/{order}/cancel/{token}', [App\Http\Controllers\Customer\GuestOrderController::class, 'showCancelPage'])
        ->name('guest.orders.cancel-page');
    Route::post('/orders/{order}/cancel/{token}', [App\Http\Controllers\Customer\GuestOrderController::class, 'cancel'])
        ->middleware('throttle:guest-cancel-token')
        ->name('guest.orders.cancel');
});

// DOKU payment — no auth, signature-verified (called by DOKU servers)
Route::match(['get', 'post'], '/payment/doku/notify', [DokuPaymentController::class, 'notify'])->name('doku.notify');
Route::match(['get', 'post'], '/payment/doku/redirect', [DokuPaymentController::class, 'redirect'])->name('doku.redirect');

// Courier invitation — no auth required
Route::middleware('internal.inertia')->group(function (): void {
    Route::get('/courier/invite/{token}', [App\Http\Controllers\CourierInvitationController::class, 'show'])->name('courier.invite.show');
    Route::post('/courier/invite/{token}', [App\Http\Controllers\CourierInvitationController::class, 'accept'])->name('courier.invite.accept');
});

Route::middleware(['internal.inertia', 'enforce.session'])->group(function (): void {
    // System endpoints
    Route::get('/api/health', [SystemController::class, 'health'])->name('health');
    Route::get('/api/version', [SystemController::class, 'version'])->name('version');
    Route::get('/api/status', [SystemController::class, 'status'])
        ->middleware(['auth', 'role:owner'])
        ->name('system.status');

    Route::get('/login', [AuthenticatedSessionController::class, 'create'])->name('login');
    Route::post('/login', [AuthenticatedSessionController::class, 'store'])->middleware('throttle:login');

    // Google OAuth
    Route::get('/oauth/google', [SocialAuthController::class, 'redirect'])->name('google.redirect');
    Route::get('/oauth/google/callback', [SocialAuthController::class, 'callback'])->name('google.callback');
    Route::post('/oauth/exchange-token', [SocialAuthController::class, 'exchangeToken'])->name('oauth.exchange-token');
    Route::post('/api/auth/google-token', [SocialAuthController::class, 'googleToken'])->name('api.auth.google-token');

    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])
        ->middleware('auth')
        ->name('logout');

    Route::middleware('auth')->group(function (): void {
        Route::get('/password/change', [PasswordChangeController::class, 'edit'])->name('password.change');
        Route::put('/password/change', [PasswordChangeController::class, 'update'])->name('password.update');

        // Notifications
        Route::get('/notifications', [NotificationController::class, 'index'])->name('notifications.index');
        Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount'])->name('notifications.unread-count');
        Route::post('/notifications/{notification}/read', [NotificationController::class, 'markAsRead'])->name('notifications.read');
        Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead'])->name('notifications.read-all');

        // Push subscriptions
        Route::post('/push/subscribe', [UnifiedPushController::class, 'subscribe'])->name('push.subscribe');
        Route::post('/push/fcm-token', [UnifiedPushController::class, 'fcmToken'])->name('push.fcm-token');
        Route::delete('/push/subscribe', [UnifiedPushController::class, 'unsubscribe'])->name('push.unsubscribe');
    });

    Route::get('/dashboard', DashboardRedirectController::class)
        ->middleware(['auth', 'password.changed'])
        ->name('dashboard');

    // Owner routes
    Route::middleware(['auth', 'role:owner', 'password.changed'])->prefix('owner')->name('owner.')->group(function (): void {
        Route::get('/dashboard', OwnerDashboardController::class)->name('dashboard');
        Route::get('/analytics', [OwnerAnalyticsController::class, 'index'])->name('analytics.index');
        Route::get('/profile', OwnerProfileController::class)->name('profile');
        Route::resource('outlets', OwnerOutletController::class);
        Route::put('outlets/{outlet}/archive', [OwnerOutletController::class, 'archive'])->name('outlets.archive');
        Route::post('outlets/{outlet}/reset-password', [OwnerOutletController::class, 'resetPassword'])
            ->middleware('throttle:10,1')
            ->name('outlets.reset-password');
        Route::get('outlets/{outlet}/operating-hours', [OutletOperatingHoursController::class, 'index'])->name('outlets.operating-hours.index');
        Route::put('outlets/{outlet}/operating-hours', [OutletOperatingHoursController::class, 'bulkUpdate'])->name('outlets.operating-hours.bulk-update');
        Route::post('outlets/{outlet}/holidays', [OutletHolidayController::class, 'store'])->name('outlets.holidays.store');
        Route::put('outlets/{outlet}/holidays/{holiday}', [OutletHolidayController::class, 'update'])->name('outlets.holidays.update');
        Route::delete('outlets/{outlet}/holidays/{holiday}', [OutletHolidayController::class, 'destroy'])->name('outlets.holidays.destroy');
        Route::get('outlets/{outlet}/products', [OutletProductController::class, 'index'])->name('outlets.products.index');
        Route::get('outlets/{outlet}/products/available', [OutletProductController::class, 'availableProducts'])->name('outlets.products.available');
        Route::post('outlets/{outlet}/products', [OutletProductController::class, 'addProducts'])->name('outlets.products.add');
        Route::put('outlets/{outlet}/products/{variantId}/toggle', [OutletProductController::class, 'toggle'])->name('outlets.products.toggle');
        Route::delete('outlets/{outlet}/products/{variantId}', [OutletProductController::class, 'remove'])->name('outlets.products.remove');
        Route::post('outlets/{outlet}/products/bulk-assign', [OutletProductController::class, 'bulkAssign'])->name('outlets.products.bulk-assign');
        Route::post('outlets/{outlet}/restock', [OutletProductController::class, 'restock'])->name('outlets.products.restock');
        Route::resource('products', OwnerProductController::class)->except(['show']);
        Route::resource('product-families', ProductFamilyController::class)->parameters(['product-families' => 'family'])->except(['create', 'edit']);
        Route::post('product-families/{family}/variants', [ProductVariantController::class, 'store'])->name('product-families.variants.store');
        Route::post('product-families/{family}/variants/bulk-update', [ProductVariantController::class, 'bulkUpdate'])->name('product-families.variants.bulk-update');
        Route::put('variants/{variant}', [ProductVariantController::class, 'update'])->name('variants.update');
        Route::delete('variants/{variant}', [ProductVariantController::class, 'destroy'])->name('variants.destroy');
        Route::patch('variants/{variant}/toggle', [ProductVariantController::class, 'toggle'])->name('variants.toggle');
        Route::get('pricing/outlets/compare', [PricingController::class, 'compare'])->name('pricing.outlets.compare');
        Route::get('pricing', [PricingController::class, 'index'])->name('pricing.index');
        Route::get('pricing/outlets/{outlet}', [PricingController::class, 'show'])->name('pricing.outlets.show');
        Route::patch('pricing/variants/{variant}', [PricingController::class, 'updateGlobal'])->name('pricing.variants.update');
        Route::get('pricing/variants/{variant}/impact', [PricingController::class, 'getImpact'])->name('pricing.variants.impact');
        Route::patch('pricing/outlets/{outlet}/variants/{variant}', [PricingController::class, 'updateOutlet'])->name('pricing.outlets.variants.update');
        Route::delete('pricing/outlets/{outlet}/variants/{variant}', [PricingController::class, 'resetOutlet'])->name('pricing.outlets.variants.reset');
        Route::post('pricing/outlets/{outlet}/bulk-update', [PricingController::class, 'bulkUpdate'])->name('pricing.outlets.bulk-update');
        Route::post('pricing/outlets/{outlet}/copy', [PricingController::class, 'copy'])->name('pricing.outlets.copy');
        Route::get('inventories', [OwnerInventoryController::class, 'index'])->name('inventories.index');
        Route::get('inventories/create', [OwnerInventoryController::class, 'create'])->name('inventories.create');
        Route::post('inventories', [OwnerInventoryController::class, 'store'])->name('inventories.store');
        Route::get('inventories/{inventory}/edit', [OwnerInventoryController::class, 'edit'])->name('inventories.edit');
        Route::put('inventories/{inventory}', [OwnerInventoryController::class, 'update'])->name('inventories.update');
        Route::patch('inventories/central-stock/{variant}', [OwnerInventoryController::class, 'updateCenterStock'])->name('inventories.central-stock.update');
        Route::post('inventories/remind-stock', [OwnerInventoryController::class, 'remindStock'])->name('inventories.remind-stock');
        Route::get('orders', [OwnerOrderController::class, 'index'])->name('orders.index');
        Route::get('orders/{order}', [OwnerOrderController::class, 'show'])->name('orders.show');
        Route::get('order-reports/{report}', [App\Http\Controllers\Owner\OrderReportController::class, 'show'])->name('order-reports.show');
        Route::put('order-reports/{report}', [App\Http\Controllers\Owner\OrderReportController::class, 'update'])->name('order-reports.update');
        Route::post('orders/{order}/assign-courier', [OwnerDeliveryController::class, 'assignCourier'])->name('orders.assign-courier');
        Route::get('deliveries', [OwnerDeliveryController::class, 'index'])->name('deliveries.index');
        Route::get('deliveries/{delivery}', [OwnerDeliveryController::class, 'show'])->name('deliveries.show');
        Route::post('deliveries/{delivery}/resolve', [OwnerDeliveryController::class, 'resolve'])->middleware('throttle:sensitive')->name('deliveries.resolve');
        Route::resource('delivery-tiers', DeliveryTierController::class)->only(['index', 'store', 'update', 'destroy']);
        Route::patch('delivery-tiers/{tier}/toggle', [DeliveryTierController::class, 'toggle'])->name('delivery-tiers.toggle');
        Route::resource('couriers', \App\Http\Controllers\Owner\CourierController::class)->only(['index', 'create', 'store', 'show', 'update', 'destroy']);
        Route::get('reports/export-csv', [ReportController::class, 'exportCsv'])->middleware('throttle:export')->name('reports.export-csv');
        Route::get('reports/orders/export', [ReportController::class, 'exportOrders'])->name('reports.orders.export');
        Route::get('reports/settlements/export', [ReportController::class, 'exportSettlements'])->name('reports.settlements.export');
        Route::get('restocks', [OwnerRestockController::class, 'index'])->name('restocks.index');
        Route::get('restocks/{restockRequest}', [OwnerRestockController::class, 'show'])->name('restocks.show');
        Route::post('restocks/{restockRequest}/approve', [OwnerRestockController::class, 'approve'])->name('restocks.approve');
        Route::post('restocks/{restockRequest}/reject', [OwnerRestockController::class, 'reject'])->name('restocks.reject');
        Route::post('restocks/{restockRequest}/mark-shipped', [OwnerRestockController::class, 'markShipped'])->name('restocks.mark-shipped');
        Route::post('finance/settlement-payments/{payment}/verify', [SettlementPaymentController::class, 'verify'])->name('finance.settlement-payments.verify');
        Route::post('finance/settlement-payments/{payment}/reject', [SettlementPaymentController::class, 'reject'])->name('finance.settlement-payments.reject');
        Route::post('finance/settlement-payments/bulk-verify', [SettlementPaymentController::class, 'bulkVerify'])->name('finance.settlement-payments.bulk-verify');
        Route::get('finance', [FinanceSettlementController::class, 'dashboard'])->name('finance.dashboard');
        Route::get('finance/settlements/export', [FinanceSettlementController::class, 'export'])->name('finance.settlements.export');
        Route::get('finance/settlements/{outlet}', [FinanceSettlementController::class, 'outletDetail'])->name('finance.settlements.outlet');
        Route::post('finance/settlements/{outlet}/payments', [FinanceSettlementController::class, 'recordPayment'])->name('finance.settlements.payments');
        Route::post('finance/settlements/{outlet}/send-invoice', [FinanceSettlementController::class, 'sendInvoice'])->name('finance.settlements.send-invoice');
        Route::resource('finance/payment-accounts', PaymentAccountController::class)->only(['store', 'update', 'destroy']);
        Route::get('refunds', [RefundController::class, 'index'])->name('refunds.index');
        Route::post('refunds/{order}/start', [RefundController::class, 'start'])->name('refunds.start');
        Route::post('refunds/{order}/complete', [RefundController::class, 'complete'])->name('refunds.complete');
        Route::post('refunds/{order}/reject', [RefundController::class, 'reject'])->name('refunds.reject');
        Route::get('returns', [OwnerReturnController::class, 'index'])->name('returns.index');
        Route::get('returns/{returnRequest}', [OwnerReturnController::class, 'show'])->name('returns.show');
        Route::post('returns/{returnRequest}/approve', [OwnerReturnController::class, 'approve'])->name('returns.approve');
        Route::post('returns/{returnRequest}/reject', [OwnerReturnController::class, 'reject'])->name('returns.reject');
        Route::post('returns/{returnRequest}/mark-received', [OwnerReturnController::class, 'markReceived'])->name('returns.mark-received');
        Route::post('returns/{returnRequest}/complete', [OwnerReturnController::class, 'complete'])->name('returns.complete');
        Route::get('exchanges', [OwnerExchangeController::class, 'index'])->name('exchanges.index');
        Route::get('exchanges/{exchangeRequest}', [OwnerExchangeController::class, 'show'])->name('exchanges.show');
        Route::post('exchanges/{exchangeRequest}/approve', [OwnerExchangeController::class, 'approve'])->name('exchanges.approve');
        Route::post('exchanges/{exchangeRequest}/reject', [OwnerExchangeController::class, 'reject'])->name('exchanges.reject');
        Route::post('exchanges/{exchangeRequest}/mark-preparing', [OwnerExchangeController::class, 'markPreparing'])->name('exchanges.mark-preparing');
        Route::post('exchanges/{exchangeRequest}/mark-shipped', [OwnerExchangeController::class, 'markShipped'])->name('exchanges.mark-shipped');
        Route::post('exchanges/{exchangeRequest}/complete', [OwnerExchangeController::class, 'complete'])->name('exchanges.complete');
        Route::get('couriers/management', [\App\Http\Controllers\Owner\CourierManagementController::class, 'index'])->name('couriers.management.index');
        Route::post('couriers/{profile}/approve', [\App\Http\Controllers\Owner\CourierManagementController::class, 'approve'])->name('couriers.approve');
        Route::post('couriers/{profile}/reject', [\App\Http\Controllers\Owner\CourierManagementController::class, 'reject'])->name('couriers.reject');
        Route::put('couriers/{profile}/outlets', [\App\Http\Controllers\Owner\CourierManagementController::class, 'updateAssignments'])->name('couriers.outlets');
    });

    // Outlet routes
    Route::middleware(['auth', 'role:outlet', 'password.changed'])->prefix('outlet')->name('outlet.')->group(function (): void {
        Route::get('/dashboard', DashboardController::class)->name('dashboard');
        Route::get('/badge-counts', [DashboardController::class, 'badgeCounts'])->name('badge-counts');
        Route::get('/inventory', OutletInventoryController::class)->name('inventory');
        Route::post('/inventory/opname', [OutletInventoryController::class, 'opname'])->name('inventory.opname');
        Route::get('/deliveries', [OutletDeliveryController::class, 'index'])->name('deliveries.index');
        Route::get('/deliveries/{delivery}', [OutletDeliveryController::class, 'show'])->name('deliveries.show');
        Route::post('/deliveries/{delivery}/confirm-return', [OutletDeliveryController::class, 'confirmReturn'])->name('deliveries.confirm-return');
        Route::get('/orders', [OutletOrderController::class, 'index'])->name('orders.index');
        Route::get('/orders/pending-count', [OutletOrderController::class, 'pendingCount'])->name('orders.pending-count');
        Route::get('/orders/{order}', [OutletOrderController::class, 'show'])->name('orders.show');
        Route::post('/orders/{order}/status', [OutletOrderController::class, 'updateStatus'])->name('orders.status');
        Route::post('/orders/{order}/reject', [OutletOrderController::class, 'reject'])->name('orders.reject');
        Route::post('/orders/{order}/assign-courier', [OutletOrderController::class, 'assignCourier'])->name('orders.assign-courier');
        Route::post('/orders/{order}/complete-pickup', [OutletOrderController::class, 'completePickup'])->name('orders.complete-pickup');
        Route::get('/api/outlets/{outlet}/nearest-couriers', [OutletCourierController::class, 'nearestCouriers'])->name('outlets.nearest-couriers');
        Route::get('/order-reports', [App\Http\Controllers\Outlet\OrderReportController::class, 'index'])->name('order-reports.index');
        Route::get('/order-reports/{report}', [App\Http\Controllers\Outlet\OrderReportController::class, 'show'])->name('order-reports.show');
        Route::put('/order-reports/{report}', [App\Http\Controllers\Outlet\OrderReportController::class, 'update'])->name('order-reports.update');
        Route::post('/push-subscribe', [PushController::class, 'subscribe'])->name('push-subscribe');
        Route::get('/offline-sales', [OfflineSaleController::class, 'index'])->name('offline-sales.index');
        Route::post('/offline-sales', [OfflineSaleController::class, 'store'])->name('offline-sales.store');
        Route::delete('/offline-sales/{offlineSale}', [OfflineSaleController::class, 'destroy'])->name('offline-sales.destroy');
        Route::get('/scan', [OutletScanController::class, 'index'])->name('scan');
        Route::get('/scan/{order_code}', [OutletScanController::class, 'lookup'])->name('scan.lookup');
        Route::get('/restocks', [OutletRestockController::class, 'index'])->name('restocks.index');
        Route::get('/restocks/create', [OutletRestockController::class, 'create'])->name('restocks.create');
        Route::post('/restocks', [OutletRestockController::class, 'store'])->name('restocks.store');
        Route::get('/restocks/{restockRequest}', [OutletRestockController::class, 'show'])->name('restocks.show');
        Route::post('/restocks/{restockRequest}/cancel', [OutletRestockController::class, 'cancel'])->name('restocks.cancel');
        Route::post('restocks/{restockRequest}/confirm-received', [OutletRestockController::class, 'confirmReceived'])->name('restocks.confirm-received');
        Route::get('/settlement', [SettlementController::class, 'index'])->name('settlement.index');
        Route::get('/settlement-payments', [App\Http\Controllers\Outlet\SettlementPaymentController::class, 'index'])->name('settlement-payments.index');
        Route::post('/settlement-payments', [App\Http\Controllers\Outlet\SettlementPaymentController::class, 'store'])->name('settlement-payments.store');
        Route::get('/returns', [OutletReturnController::class, 'index'])->name('returns.index');
        Route::get('/returns/create', [OutletReturnController::class, 'create'])->name('returns.create');
        Route::post('/returns', [OutletReturnController::class, 'store'])->name('returns.store');
        Route::get('/returns/{returnRequest}', [OutletReturnController::class, 'show'])->name('returns.show');
        Route::post('/returns/{returnRequest}/cancel', [OutletReturnController::class, 'cancel'])->name('returns.cancel');
        Route::get('/exchanges', [OutletExchangeController::class, 'index'])->name('exchanges.index');
        Route::get('/exchanges/create', [OutletExchangeController::class, 'create'])->name('exchanges.create');
        Route::post('/exchanges', [OutletExchangeController::class, 'store'])->name('exchanges.store');
        Route::get('/exchanges/{exchangeRequest}', [OutletExchangeController::class, 'show'])->name('exchanges.show');
        Route::post('/exchanges/{exchangeRequest}/confirm-received', [OutletExchangeController::class, 'confirmReceived'])->name('exchanges.confirm-received');
        Route::post('/exchanges/{exchangeRequest}/cancel', [OutletExchangeController::class, 'cancel'])->name('exchanges.cancel');
        Route::get('/analytics', [OutletAnalyticsController::class, 'index'])->name('analytics.index');
        Route::get('/reports', [OutletReportController::class, 'index'])->name('reports.index');
        Route::get('/reports/sales/export', [OutletReportController::class, 'export'])->name('reports.sales.export');
        Route::get('/my-couriers', [\App\Http\Controllers\Outlet\MyCourierController::class, 'index'])->name('my-couriers.index');
        Route::post('/my-couriers/nominate', [\App\Http\Controllers\Outlet\MyCourierController::class, 'nominate'])->name('my-couriers.nominate');
    });

    // Courier routes
    Route::middleware(['auth', 'role:courier', 'password.changed'])->prefix('courier')->name('courier.')->group(function (): void {
        Route::get('/dashboard', App\Http\Controllers\Courier\DashboardController::class)->name('dashboard');
        Route::get('/deliveries', [CourierDeliveryController::class, 'index'])->name('deliveries.index');
        Route::get('/deliveries/optimized-route', [CourierDeliveryController::class, 'getOptimizedRoute'])->name('deliveries.optimized-route');
        Route::get('/deliveries/{delivery}', [CourierDeliveryController::class, 'show'])->name('deliveries.show');
        Route::post('/deliveries/{delivery}/confirm-pickup', [CourierDeliveryController::class, 'confirmPickup'])->name('deliveries.confirm-pickup');
        Route::post('/deliveries/{delivery}/start-delivery', [CourierDeliveryController::class, 'startDelivery'])->name('deliveries.start-delivery');
        Route::post('/deliveries/{delivery}/complete', [CourierDeliveryController::class, 'complete'])->name('deliveries.complete');
        Route::post('/deliveries/{delivery}/fail', [CourierDeliveryController::class, 'fail'])->name('deliveries.fail');
        Route::post('/deliveries/{delivery}/reject', [CourierDeliveryController::class, 'reject'])->name('deliveries.reject');
        Route::post('/deliveries/{delivery}/return-to-outlet', [CourierDeliveryController::class, 'returnToOutlet'])->name('deliveries.return-to-outlet');
        Route::post('/availability/toggle', [CourierAvailabilityController::class, 'toggleOnline'])->name('availability.toggle');
        Route::post('/shift/start', [CourierAvailabilityController::class, 'startShift'])->name('shift.start');
        Route::post('/shift/end', [CourierAvailabilityController::class, 'endShift'])->name('shift.end');
        Route::get('/availability/status', [CourierAvailabilityController::class, 'status'])->name('availability.status');
        Route::get('/profile', App\Http\Controllers\Courier\ProfileController::class)->name('profile');
        Route::post('/location', [LocationController::class, 'update'])->name('location.update');
    });

    // Dev routes
    if (app()->isLocal()) {
        Route::middleware('dev')->prefix('dev')->name('dev.')->group(function () {
            Route::get('/switch-role', [DevRoleSwitcherController::class, 'index'])->name('switch-role');
            Route::post('/switch-role', [DevRoleSwitcherController::class, 'switch'])->name('switch-role.do');
        });
    }
});

// ─── DEV ROLE SWITCHER (Local Environment Only) ─────────────────────
Route::middleware(['dev'])->prefix('dev')->name('dev.')->group(function (): void {
    Route::get('/switch/owner', [DevRoleSwitcherController::class, 'switchToOwner'])->name('switch.owner');
    Route::get('/switch/outlet', [DevRoleSwitcherController::class, 'switchToOutlet'])->name('switch.outlet');
    Route::get('/switch/courier', [DevRoleSwitcherController::class, 'switchToCourier'])->name('switch.courier');
    Route::get('/switch/customer', [DevRoleSwitcherController::class, 'switchToCustomer'])->name('switch.customer');
    Route::get('/switch/guest', [DevRoleSwitcherController::class, 'switchToGuest'])->name('switch.guest');
});
