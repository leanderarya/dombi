<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\PasswordChangeController;
use App\Http\Controllers\Courier\DeliveryController as CourierDeliveryController;
use App\Http\Controllers\Customer\AddressController as CustomerAddressController;
use App\Http\Controllers\Customer\CheckoutController as CustomerCheckoutController;
use App\Http\Controllers\Customer\HomeController as CustomerHomeController;
use App\Http\Controllers\Customer\OrderController as CustomerOrderController;
use App\Http\Controllers\Customer\ProductController as CustomerProductController;
use App\Http\Controllers\DashboardRedirectController;
use App\Http\Controllers\Outlet\DashboardController;
use App\Http\Controllers\Outlet\InventoryController as OutletInventoryController;
use App\Http\Controllers\Outlet\DeliveryController as OutletDeliveryController;
use App\Http\Controllers\Outlet\OrderController as OutletOrderController;
use App\Http\Controllers\Outlet\RestockController as OutletRestockController;
use App\Http\Controllers\Owner\DashboardController as OwnerDashboardController;
use App\Http\Controllers\Owner\DeliveryBoardController;
use App\Http\Controllers\Owner\DeliveryController as OwnerDeliveryController;
use App\Http\Controllers\Owner\InventoryController as OwnerInventoryController;
use App\Http\Controllers\Owner\OrderController as OwnerOrderController;
use App\Http\Controllers\Owner\OutletController as OwnerOutletController;
use App\Http\Controllers\Owner\ProfileController as OwnerProfileController;
use App\Http\Controllers\Owner\ProductController as OwnerProductController;
use App\Http\Controllers\Owner\ReportController;
use App\Http\Controllers\Owner\RestockController as OwnerRestockController;
use App\Http\Controllers\Owner\StockDistributionController as OwnerStockDistributionController;
use App\Http\Controllers\Owner\StockMovementController;
use App\Http\Controllers\Owner\ReturnController as OwnerReturnController;
use App\Http\Controllers\Owner\ExchangeController as OwnerExchangeController;
use App\Http\Controllers\Outlet\ReturnController as OutletReturnController;
use App\Http\Controllers\Outlet\ExchangeController as OutletExchangeController;
use App\Http\Controllers\SystemController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    if (auth()->check()) {
        return redirect()->route('dashboard');
    }

    if (session('guest_mode')) {
        return app(CustomerHomeController::class)();
    }

    return \Inertia\Inertia::render('customer/welcome');
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

Route::get('/track/{token}', \App\Http\Controllers\TrackController::class)->middleware('throttle:track')->name('track');

// System endpoints
Route::get('/api/health', [SystemController::class, 'health'])->name('health');
Route::get('/api/version', [SystemController::class, 'version'])->name('version');
Route::get('/api/status', [SystemController::class, 'status'])
    ->middleware(['auth', 'role:owner'])
    ->name('system.status');

Route::get('/login', [AuthenticatedSessionController::class, 'create'])->name('login');
Route::post('/login', [AuthenticatedSessionController::class, 'store'])->middleware('throttle:login');

// Google OAuth
Route::get('/auth/google', [\App\Http\Controllers\Auth\SocialAuthController::class, 'redirect'])->name('google.redirect');
Route::get('/auth/google/callback', [\App\Http\Controllers\Auth\SocialAuthController::class, 'callback'])->name('google.callback');

Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])
    ->middleware('auth')
    ->name('logout');

Route::middleware('auth')->group(function (): void {
    Route::get('/password/change', [PasswordChangeController::class, 'edit'])->name('password.change');
    Route::put('/password/change', [PasswordChangeController::class, 'update'])->name('password.update');

    // Notifications
    Route::get('/notifications', [\App\Http\Controllers\NotificationController::class, 'index'])->name('notifications.index');
    Route::get('/notifications/unread-count', [\App\Http\Controllers\NotificationController::class, 'unreadCount'])->name('notifications.unread-count');
    Route::post('/notifications/{notification}/read', [\App\Http\Controllers\NotificationController::class, 'markAsRead'])->name('notifications.read');
    Route::post('/notifications/read-all', [\App\Http\Controllers\NotificationController::class, 'markAllAsRead'])->name('notifications.read-all');
});

Route::get('/dashboard', DashboardRedirectController::class)
    ->middleware(['auth', 'password.changed'])
    ->name('dashboard');

Route::middleware(['auth', 'role:owner', 'password.changed'])->prefix('owner')->name('owner.')->group(function (): void {
    Route::get('/dashboard', OwnerDashboardController::class)->name('dashboard');
    Route::get('/profile', OwnerProfileController::class)->name('profile');
    Route::resource('outlets', OwnerOutletController::class);
    Route::resource('products', OwnerProductController::class)->except(['show']);

    // Product Families & Variants
    Route::resource('product-families', App\Http\Controllers\Owner\ProductFamilyController::class)->except(['create', 'edit', 'destroy']);
    Route::post('product-families/{family}/variants', [App\Http\Controllers\Owner\ProductVariantController::class, 'store'])->name('product-families.variants.store');
    Route::put('variants/{variant}', [App\Http\Controllers\Owner\ProductVariantController::class, 'update'])->name('variants.update');

    Route::get('inventories', [OwnerInventoryController::class, 'index'])->name('inventories.index');
    Route::get('inventories/create', [OwnerInventoryController::class, 'create'])->name('inventories.create');
    Route::post('inventories', [OwnerInventoryController::class, 'store'])->name('inventories.store');
    Route::get('inventories/{inventory}/edit', [OwnerInventoryController::class, 'edit'])->name('inventories.edit');
    Route::put('inventories/{inventory}', [OwnerInventoryController::class, 'update'])->name('inventories.update');
    Route::get('orders', [OwnerOrderController::class, 'index'])->name('orders.index');
    Route::get('orders/{order}', [OwnerOrderController::class, 'show'])->name('orders.show');
    Route::post('orders/{order}/assign-courier', [OwnerDeliveryController::class, 'assignCourier'])->name('orders.assign-courier');
    Route::get('deliveries', [OwnerDeliveryController::class, 'index'])->name('deliveries.index');
    Route::get('deliveries/board', [DeliveryBoardController::class, 'index'])->name('deliveries.board');
    Route::get('deliveries/{delivery}', [OwnerDeliveryController::class, 'show'])->name('deliveries.show');
    Route::post('deliveries/{delivery}/resolve', [OwnerDeliveryController::class, 'resolve'])->middleware('throttle:sensitive')->name('deliveries.resolve');
    Route::get('stock-movements', [StockMovementController::class, 'index'])->name('stock-movements.index');
    Route::get('reports', [ReportController::class, 'index'])->name('reports.index');
    Route::get('reports/export-csv', [ReportController::class, 'exportCsv'])->middleware('throttle:export')->name('reports.export-csv');
    Route::get('restocks', [OwnerRestockController::class, 'index'])->name('restocks.index');
    Route::get('restocks/{restockRequest}', [OwnerRestockController::class, 'show'])->name('restocks.show');
    Route::post('restocks/{restockRequest}/approve', [OwnerRestockController::class, 'approve'])->name('restocks.approve');
    Route::post('restocks/{restockRequest}/reject', [OwnerRestockController::class, 'reject'])->name('restocks.reject');
    Route::get('distributions', [OwnerStockDistributionController::class, 'index'])->name('distributions.index');
    Route::get('distributions/{distribution}', [OwnerStockDistributionController::class, 'show'])->name('distributions.show');
    Route::post('distributions/{distribution}/mark-shipped', [OwnerStockDistributionController::class, 'markShipped'])->name('distributions.mark-shipped');

    // Settlement
    Route::get('settlement', [App\Http\Controllers\Owner\SettlementController::class, 'index'])->name('settlement.index');
    Route::get('settlement/collection', [App\Http\Controllers\Owner\SettlementController::class, 'collection'])->name('settlement.collection');
    Route::get('settlement/outlet/{outletId}', [App\Http\Controllers\Owner\SettlementController::class, 'outlet'])->name('settlement.outlet');

    // Settlement Payments
    Route::get('settlement-payments', [App\Http\Controllers\Owner\SettlementPaymentController::class, 'index'])->name('settlement-payments.index');
    Route::post('settlement-payments/{payment}/verify', [App\Http\Controllers\Owner\SettlementPaymentController::class, 'verify'])->name('settlement-payments.verify');
    Route::post('settlement-payments/{payment}/reject', [App\Http\Controllers\Owner\SettlementPaymentController::class, 'reject'])->name('settlement-payments.reject');

    // Returns
    Route::get('returns', [OwnerReturnController::class, 'index'])->name('returns.index');
    Route::get('returns/{returnRequest}', [OwnerReturnController::class, 'show'])->name('returns.show');
    Route::post('returns/{returnRequest}/approve', [OwnerReturnController::class, 'approve'])->name('returns.approve');
    Route::post('returns/{returnRequest}/reject', [OwnerReturnController::class, 'reject'])->name('returns.reject');
    Route::post('returns/{returnRequest}/mark-received', [OwnerReturnController::class, 'markReceived'])->name('returns.mark-received');
    Route::post('returns/{returnRequest}/complete', [OwnerReturnController::class, 'complete'])->name('returns.complete');

    // Exchanges
    Route::get('exchanges', [OwnerExchangeController::class, 'index'])->name('exchanges.index');
    Route::get('exchanges/{exchangeRequest}', [OwnerExchangeController::class, 'show'])->name('exchanges.show');
    Route::post('exchanges/{exchangeRequest}/approve', [OwnerExchangeController::class, 'approve'])->name('exchanges.approve');
    Route::post('exchanges/{exchangeRequest}/reject', [OwnerExchangeController::class, 'reject'])->name('exchanges.reject');
    Route::post('exchanges/{exchangeRequest}/mark-preparing', [OwnerExchangeController::class, 'markPreparing'])->name('exchanges.mark-preparing');
    Route::post('exchanges/{exchangeRequest}/mark-shipped', [OwnerExchangeController::class, 'markShipped'])->name('exchanges.mark-shipped');
    Route::post('exchanges/{exchangeRequest}/complete', [OwnerExchangeController::class, 'complete'])->name('exchanges.complete');
});

Route::middleware('guest.or.customer')->prefix('customer')->name('customer.')->group(function (): void {
    Route::get('/home', CustomerHomeController::class)->name('home');
    Route::post('/fulfillment-draft', [CustomerHomeController::class, 'setFulfillmentDraft'])->name('fulfillment-draft');
    Route::post('/location', [CustomerCheckoutController::class, 'storeLocationDraft'])->name('location.store');
    Route::get('/help', fn () => \Inertia\Inertia::render('customer/help'))->name('help');
    Route::get('/about', fn () => \Inertia\Inertia::render('customer/about'))->name('about');
    Route::get('/products', [CustomerProductController::class, 'index'])->name('products.index');
    Route::get('/products/{family}', [CustomerProductController::class, 'show'])->name('products.show');
    Route::post('/cart/add', [\App\Http\Controllers\Customer\CartController::class, 'addItem'])->name('cart.add');
    Route::post('/cart/remove', [\App\Http\Controllers\Customer\CartController::class, 'removeItem'])->name('cart.remove');
    Route::post('/cart/quantity', [\App\Http\Controllers\Customer\CartController::class, 'setQuantity'])->name('cart.quantity');
    Route::get('/checkout', [CustomerCheckoutController::class, 'index'])->name('checkout');
    Route::post('/checkout', [CustomerCheckoutController::class, 'storeIndex'])->name('checkout.store');
    Route::get('/checkout/pickup-outlets', [CustomerCheckoutController::class, 'pickupOutlets'])->name('checkout.pickup-outlets');
    Route::get('/checkout/customer', [CustomerCheckoutController::class, 'customer'])->name('checkout.customer');
    Route::post('/checkout/customer', [CustomerCheckoutController::class, 'storeCustomer'])->name('checkout.customer.store');
    Route::get('/checkout/customer-lookup', [CustomerCheckoutController::class, 'lookupCustomer'])->middleware('throttle:lookup')->name('checkout.customer.lookup');
    Route::get('/checkout/login-prompt', fn () => \Inertia\Inertia::render('customer/checkout/login-prompt'))->name('checkout.login-prompt');
    Route::get('/checkout/verify-otp', [CustomerCheckoutController::class, 'verifyOtp'])->name('checkout.verify-otp');
    Route::post('/checkout/verify-otp', [CustomerCheckoutController::class, 'verifyOtpSubmit'])->name('checkout.verify-otp.submit');
    Route::post('/checkout/send-otp', [CustomerCheckoutController::class, 'sendOtp'])->name('checkout.send-otp');
    Route::get('/checkout/payment', [CustomerCheckoutController::class, 'payment'])->name('checkout.payment');
    Route::post('/checkout/payment', [CustomerCheckoutController::class, 'submit'])->name('checkout.submit');
    Route::post('/orders', [CustomerOrderController::class, 'store'])->middleware('throttle:checkout')->name('orders.store');
    Route::post('/orders/recovery', \App\Http\Controllers\Customer\GuestOrderRecoveryController::class)->middleware('throttle:recovery')->name('orders.recovery');
    Route::get('/orders', [CustomerOrderController::class, 'index'])->name('orders.index');
    Route::get('/profile', [\App\Http\Controllers\Customer\ProfileController::class, 'index'])->name('profile');
    Route::post('/register', \App\Http\Controllers\Customer\AccountPromotionController::class)->name('register');

    // Phone verification for Google Sign-In users
    Route::get('/verify-phone', [\App\Http\Controllers\Auth\SocialAuthController::class, 'showVerifyPhone'])->name('verify-phone');
    Route::post('/verify-phone/send-otp', [\App\Http\Controllers\Auth\SocialAuthController::class, 'sendPhoneOtp'])->name('verify-phone.send-otp');
    Route::post('/verify-phone/verify', [\App\Http\Controllers\Auth\SocialAuthController::class, 'verifyPhone'])->name('verify-phone.verify');
});

Route::middleware(['auth', 'role:customer'])->prefix('customer')->name('customer.')->group(function (): void {
    Route::resource('addresses', CustomerAddressController::class)->except(['show']);
    Route::post('/addresses/{address}/set-default', [CustomerAddressController::class, 'setDefault'])->name('addresses.set-default');
    Route::get('/orders/{order}', [CustomerOrderController::class, 'show'])->name('orders.show');
    Route::post('/orders/{order}/cancel', [CustomerOrderController::class, 'cancel'])->name('orders.cancel');
});

Route::middleware(['customer.or.recovered'])->prefix('customer')->name('customer.')->group(function (): void {
    Route::post('/orders/{order}/repeat', [CustomerOrderController::class, 'repeat'])->name('orders.repeat');
    Route::get('/orders/{order}/restore-cart', [CustomerOrderController::class, 'restoreCart'])->name('orders.restore-cart');
});

Route::middleware(['auth', 'role:outlet', 'password.changed'])->prefix('outlet')->name('outlet.')->group(function (): void {
    Route::get('/dashboard', DashboardController::class)->name('dashboard');
    Route::get('/more', [DashboardController::class, 'more'])->name('more');
    Route::get('/inventory', OutletInventoryController::class)->name('inventory');
    Route::get('/deliveries', [OutletDeliveryController::class, 'index'])->name('deliveries.index');
    Route::get('/deliveries/{delivery}', [OutletDeliveryController::class, 'show'])->name('deliveries.show');
    Route::post('/deliveries/{delivery}/confirm-return', [OutletDeliveryController::class, 'confirmReturn'])->name('deliveries.confirm-return');
    Route::get('/orders', [OutletOrderController::class, 'index'])->name('orders.index');
    Route::get('/orders/{order}', [OutletOrderController::class, 'show'])->name('orders.show');
    Route::post('/orders/{order}/status', [OutletOrderController::class, 'updateStatus'])->name('orders.status');
    Route::post('/orders/{order}/reject', [OutletOrderController::class, 'reject'])->name('orders.reject');
    Route::post('/orders/{order}/assign-courier', [OutletOrderController::class, 'assignCourier'])->name('orders.assign-courier');
    Route::get('/restocks', [OutletRestockController::class, 'index'])->name('restocks.index');
    Route::get('/restocks/create', [OutletRestockController::class, 'create'])->name('restocks.create');
    Route::post('/restocks', [OutletRestockController::class, 'store'])->name('restocks.store');
    Route::get('/restocks/{restockRequest}', [OutletRestockController::class, 'show'])->name('restocks.show');
    Route::post('/distributions/{distribution}/confirm-received', [OutletRestockController::class, 'confirmReceived'])->name('distributions.confirm-received');

    // Settlement
    Route::get('/settlement', [App\Http\Controllers\Outlet\SettlementController::class, 'index'])->name('settlement.index');

    // Settlement Payments
    Route::get('/settlement-payments', [App\Http\Controllers\Outlet\SettlementPaymentController::class, 'index'])->name('settlement-payments.index');
    Route::post('/settlement-payments', [App\Http\Controllers\Outlet\SettlementPaymentController::class, 'store'])->name('settlement-payments.store');

    // Returns
    Route::get('/returns', [OutletReturnController::class, 'index'])->name('returns.index');
    Route::get('/returns/create', [OutletReturnController::class, 'create'])->name('returns.create');
    Route::post('/returns', [OutletReturnController::class, 'store'])->name('returns.store');
    Route::get('/returns/{returnRequest}', [OutletReturnController::class, 'show'])->name('returns.show');

    // Exchanges
    Route::get('/exchanges', [OutletExchangeController::class, 'index'])->name('exchanges.index');
    Route::get('/exchanges/create', [OutletExchangeController::class, 'create'])->name('exchanges.create');
    Route::post('/exchanges', [OutletExchangeController::class, 'store'])->name('exchanges.store');
    Route::get('/exchanges/{exchangeRequest}', [OutletExchangeController::class, 'show'])->name('exchanges.show');
    Route::post('/exchanges/{exchangeRequest}/confirm-received', [OutletExchangeController::class, 'confirmReceived'])->name('exchanges.confirm-received');
});

Route::middleware(['auth', 'role:courier', 'password.changed'])->prefix('courier')->name('courier.')->group(function (): void {
    Route::get('/dashboard', App\Http\Controllers\Courier\DashboardController::class)->name('dashboard');
    Route::get('/deliveries', [CourierDeliveryController::class, 'index'])->name('deliveries.index');
    Route::get('/deliveries/{delivery}', [CourierDeliveryController::class, 'show'])->name('deliveries.show');
    Route::post('/deliveries/{delivery}/confirm-pickup', [CourierDeliveryController::class, 'confirmPickup'])->name('deliveries.confirm-pickup');
    Route::post('/deliveries/{delivery}/start-delivery', [CourierDeliveryController::class, 'startDelivery'])->name('deliveries.start-delivery');
    Route::post('/deliveries/{delivery}/complete', [CourierDeliveryController::class, 'complete'])->name('deliveries.complete');
    Route::post('/deliveries/{delivery}/fail', [CourierDeliveryController::class, 'fail'])->name('deliveries.fail');
    Route::post('/deliveries/{delivery}/reject', [CourierDeliveryController::class, 'reject'])->name('deliveries.reject');
    Route::post('/deliveries/{delivery}/return-to-outlet', [CourierDeliveryController::class, 'returnToOutlet'])->name('deliveries.return-to-outlet');

    // Availability & Shift
    Route::post('/availability/toggle', [App\Http\Controllers\Courier\CourierAvailabilityController::class, 'toggleOnline'])->name('availability.toggle');
    Route::post('/shift/start', [App\Http\Controllers\Courier\CourierAvailabilityController::class, 'startShift'])->name('shift.start');
    Route::post('/shift/end', [App\Http\Controllers\Courier\CourierAvailabilityController::class, 'endShift'])->name('shift.end');
    Route::get('/availability/status', [App\Http\Controllers\Courier\CourierAvailabilityController::class, 'status'])->name('availability.status');
});

// ─── DEV ROLE SWITCHER (Local Environment Only) ─────────────────────
Route::middleware(['dev'])->prefix('dev')->name('dev.')->group(function (): void {
    Route::get('/switch/owner', [App\Http\Controllers\DevRoleSwitcherController::class, 'switchToOwner'])->name('switch.owner');
    Route::get('/switch/outlet', [App\Http\Controllers\DevRoleSwitcherController::class, 'switchToOutlet'])->name('switch.outlet');
    Route::get('/switch/courier', [App\Http\Controllers\DevRoleSwitcherController::class, 'switchToCourier'])->name('switch.courier');
    Route::get('/switch/customer', [App\Http\Controllers\DevRoleSwitcherController::class, 'switchToCustomer'])->name('switch.customer');
    Route::get('/switch/guest', [App\Http\Controllers\DevRoleSwitcherController::class, 'switchToGuest'])->name('switch.guest');
});
