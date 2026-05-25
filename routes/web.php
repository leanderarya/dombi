<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Courier\DeliveryController as CourierDeliveryController;
use App\Http\Controllers\Customer\AddressController as CustomerAddressController;
use App\Http\Controllers\Customer\HomeController as CustomerHomeController;
use App\Http\Controllers\Customer\OrderController as CustomerOrderController;
use App\Http\Controllers\Customer\ProductController as CustomerProductController;
use App\Http\Controllers\DashboardRedirectController;
use App\Http\Controllers\Outlet\DashboardController;
use App\Http\Controllers\Outlet\InventoryController as OutletInventoryController;
use App\Http\Controllers\Outlet\OrderController as OutletOrderController;
use App\Http\Controllers\Outlet\RestockController as OutletRestockController;
use App\Http\Controllers\Owner\DashboardController as OwnerDashboardController;
use App\Http\Controllers\Owner\DeliveryController as OwnerDeliveryController;
use App\Http\Controllers\Owner\InventoryController as OwnerInventoryController;
use App\Http\Controllers\Owner\OrderController as OwnerOrderController;
use App\Http\Controllers\Owner\OutletController as OwnerOutletController;
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
        : redirect()->route('login');
})->name('home');

// System endpoints
Route::get('/api/health', [SystemController::class, 'health'])->name('health');
Route::get('/api/version', [SystemController::class, 'version'])->name('version');
Route::get('/api/status', [SystemController::class, 'status'])
    ->middleware(['auth', 'role:owner'])
    ->name('system.status');

Route::middleware('guest')->group(function (): void {
    Route::get('/login', [AuthenticatedSessionController::class, 'create'])->name('login');
    Route::post('/login', [AuthenticatedSessionController::class, 'store'])->middleware('throttle:login');
});

Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])
    ->middleware('auth')
    ->name('logout');

Route::get('/dashboard', DashboardRedirectController::class)
    ->middleware('auth')
    ->name('dashboard');

Route::middleware(['auth', 'role:owner'])->prefix('owner')->name('owner.')->group(function (): void {
    Route::get('/dashboard', OwnerDashboardController::class)->name('dashboard');
    Route::resource('outlets', OwnerOutletController::class)->except(['show']);
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

Route::middleware(['auth', 'role:customer'])->prefix('customer')->name('customer.')->group(function (): void {
    Route::get('/home', CustomerHomeController::class)->name('home');
    Route::get('/profile', [\App\Http\Controllers\Customer\ProfileController::class, 'index'])->name('profile');
    Route::get('/help', fn () => \Inertia\Inertia::render('customer/help'))->name('help');
    Route::get('/about', fn () => \Inertia\Inertia::render('customer/about'))->name('about');
    Route::get('/products', [CustomerProductController::class, 'index'])->name('products.index');
    Route::resource('addresses', CustomerAddressController::class)->except(['show']);
    Route::post('/addresses/{address}/set-default', [CustomerAddressController::class, 'setDefault'])->name('addresses.set-default');
    Route::get('/checkout', [CustomerProductController::class, 'checkout'])->name('checkout');
    Route::post('/orders', [CustomerOrderController::class, 'store'])->middleware('throttle:checkout')->name('orders.store');
    Route::get('/orders', [CustomerOrderController::class, 'index'])->name('orders.index');
    Route::get('/orders/{order}', [CustomerOrderController::class, 'show'])->name('orders.show');
    Route::post('/orders/{order}/repeat', [CustomerOrderController::class, 'repeat'])->name('orders.repeat');
});

Route::middleware(['auth', 'role:outlet'])->prefix('outlet')->name('outlet.')->group(function (): void {
    Route::get('/dashboard', DashboardController::class)->name('dashboard');
    Route::get('/inventory', OutletInventoryController::class)->name('inventory');
    Route::get('/orders', [OutletOrderController::class, 'index'])->name('orders.index');
    Route::get('/orders/{order}', [OutletOrderController::class, 'show'])->name('orders.show');
    Route::post('/orders/{order}/status', [OutletOrderController::class, 'updateStatus'])->name('orders.status');
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
