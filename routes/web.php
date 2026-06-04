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
use App\Http\Controllers\SystemController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return auth()->check()
        ? redirect()->route('dashboard')
        : app(CustomerHomeController::class)();
})->name('home');

Route::get('/track/{token}', \App\Http\Controllers\TrackController::class)->name('track');

// System endpoints
Route::get('/api/health', [SystemController::class, 'health'])->name('health');
Route::get('/api/version', [SystemController::class, 'version'])->name('version');
Route::get('/api/status', [SystemController::class, 'status'])
    ->middleware(['auth', 'role:owner'])
    ->name('system.status');

Route::get('/login', [AuthenticatedSessionController::class, 'create'])->name('login');
Route::post('/login', [AuthenticatedSessionController::class, 'store'])->middleware('throttle:login');

Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])
    ->middleware('auth')
    ->name('logout');

Route::middleware('auth')->group(function (): void {
    Route::get('/password/change', [PasswordChangeController::class, 'edit'])->name('password.change');
    Route::put('/password/change', [PasswordChangeController::class, 'update'])->name('password.update');
});

Route::get('/dashboard', DashboardRedirectController::class)
    ->middleware(['auth', 'password.changed'])
    ->name('dashboard');

Route::middleware(['auth', 'role:owner'])->prefix('owner')->name('owner.')->group(function (): void {
    Route::get('/dashboard', OwnerDashboardController::class)->name('dashboard');
    Route::get('/profile', OwnerProfileController::class)->name('profile');
    Route::resource('outlets', OwnerOutletController::class);
    Route::resource('products', OwnerProductController::class)->except(['show']);
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
});

Route::middleware('guest.or.customer')->prefix('customer')->name('customer.')->group(function (): void {
    Route::get('/home', CustomerHomeController::class)->name('home');
    Route::post('/location', [CustomerCheckoutController::class, 'storeLocationDraft'])->name('location.store');
    Route::get('/help', fn () => \Inertia\Inertia::render('customer/help'))->name('help');
    Route::get('/about', fn () => \Inertia\Inertia::render('customer/about'))->name('about');
    Route::get('/products', [CustomerProductController::class, 'index'])->name('products.index');
    Route::get('/checkout', [CustomerCheckoutController::class, 'index'])->name('checkout');
    Route::post('/checkout', [CustomerCheckoutController::class, 'storeIndex'])->name('checkout.store');
    Route::get('/checkout/pickup-outlets', [CustomerCheckoutController::class, 'pickupOutlets'])->name('checkout.pickup-outlets');
    Route::get('/checkout/customer', [CustomerCheckoutController::class, 'customer'])->name('checkout.customer');
    Route::post('/checkout/customer', [CustomerCheckoutController::class, 'storeCustomer'])->name('checkout.customer.store');
    Route::get('/checkout/customer-lookup', [CustomerCheckoutController::class, 'lookupCustomer'])->name('checkout.customer.lookup');
    Route::get('/checkout/payment', [CustomerCheckoutController::class, 'payment'])->name('checkout.payment');
    Route::post('/checkout/payment', [CustomerCheckoutController::class, 'submit'])->name('checkout.submit');
    Route::post('/orders', [CustomerOrderController::class, 'store'])->middleware('throttle:checkout')->name('orders.store');
    Route::post('/orders/recovery', \App\Http\Controllers\Customer\GuestOrderRecoveryController::class)->name('orders.recovery');
    Route::get('/orders', [CustomerOrderController::class, 'index'])->name('orders.index');
    Route::get('/profile', [\App\Http\Controllers\Customer\ProfileController::class, 'index'])->name('profile');
});

Route::middleware(['auth', 'role:customer'])->prefix('customer')->name('customer.')->group(function (): void {
    Route::resource('addresses', CustomerAddressController::class)->except(['show']);
    Route::post('/addresses/{address}/set-default', [CustomerAddressController::class, 'setDefault'])->name('addresses.set-default');
    Route::get('/orders/{order}', [CustomerOrderController::class, 'show'])->name('orders.show');
    Route::post('/orders/{order}/cancel', [CustomerOrderController::class, 'cancel'])->name('orders.cancel');
    Route::post('/orders/{order}/repeat', [CustomerOrderController::class, 'repeat'])->name('orders.repeat');
});

Route::middleware(['auth', 'role:outlet', 'password.changed'])->prefix('outlet')->name('outlet.')->group(function (): void {
    Route::get('/dashboard', DashboardController::class)->name('dashboard');
    Route::get('/inventory', OutletInventoryController::class)->name('inventory');
    Route::get('/deliveries', [OutletDeliveryController::class, 'index'])->name('deliveries.index');
    Route::get('/deliveries/{delivery}', [OutletDeliveryController::class, 'show'])->name('deliveries.show');
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
});

Route::middleware(['auth', 'role:courier'])->prefix('courier')->name('courier.')->group(function (): void {
    Route::get('/dashboard', App\Http\Controllers\Courier\DashboardController::class)->name('dashboard');
    Route::get('/deliveries', [CourierDeliveryController::class, 'index'])->name('deliveries.index');
    Route::get('/deliveries/{delivery}', [CourierDeliveryController::class, 'show'])->name('deliveries.show');
    Route::post('/deliveries/{delivery}/confirm-pickup', [CourierDeliveryController::class, 'confirmPickup'])->name('deliveries.confirm-pickup');
    Route::post('/deliveries/{delivery}/start-delivery', [CourierDeliveryController::class, 'startDelivery'])->name('deliveries.start-delivery');
    Route::post('/deliveries/{delivery}/complete', [CourierDeliveryController::class, 'complete'])->name('deliveries.complete');
    Route::post('/deliveries/{delivery}/fail', [CourierDeliveryController::class, 'fail'])->name('deliveries.fail');
});
