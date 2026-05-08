<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Customer\AddressController as CustomerAddressController;
use App\Http\Controllers\Customer\HomeController as CustomerHomeController;
use App\Http\Controllers\Customer\OrderController as CustomerOrderController;
use App\Http\Controllers\Customer\ProductController as CustomerProductController;
use App\Http\Controllers\DashboardRedirectController;
use App\Http\Controllers\Outlet\DashboardController;
use App\Http\Controllers\Outlet\OrderController as OutletOrderController;
use App\Http\Controllers\Owner\DashboardController as OwnerDashboardController;
use App\Http\Controllers\Owner\InventoryController as OwnerInventoryController;
use App\Http\Controllers\Owner\OrderController as OwnerOrderController;
use App\Http\Controllers\Owner\OutletController as OwnerOutletController;
use App\Http\Controllers\Owner\ProductController as OwnerProductController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return auth()->check()
        ? redirect()->route('dashboard')
        : redirect()->route('login');
})->name('home');

Route::middleware('guest')->group(function (): void {
    Route::get('/login', [AuthenticatedSessionController::class, 'create'])->name('login');
    Route::post('/login', [AuthenticatedSessionController::class, 'store']);
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
});

Route::middleware(['auth', 'role:customer'])->prefix('customer')->name('customer.')->group(function (): void {
    Route::get('/home', CustomerHomeController::class)->name('home');
    Route::get('/products', [CustomerProductController::class, 'index'])->name('products.index');
    Route::resource('addresses', CustomerAddressController::class)->except(['show']);
    Route::get('/checkout', [CustomerProductController::class, 'checkout'])->name('checkout');
    Route::post('/orders', [CustomerOrderController::class, 'store'])->name('orders.store');
    Route::get('/orders', [CustomerOrderController::class, 'index'])->name('orders.index');
    Route::get('/orders/{order}', [CustomerOrderController::class, 'show'])->name('orders.show');
    Route::post('/orders/{order}/repeat', [CustomerOrderController::class, 'repeat'])->name('orders.repeat');
});

Route::middleware(['auth', 'role:outlet'])->prefix('outlet')->name('outlet.')->group(function (): void {
    Route::get('/dashboard', DashboardController::class)->name('dashboard');
    Route::get('/orders', [OutletOrderController::class, 'index'])->name('orders.index');
    Route::get('/orders/{order}', [OutletOrderController::class, 'show'])->name('orders.show');
    Route::post('/orders/{order}/status', [OutletOrderController::class, 'updateStatus'])->name('orders.status');
});

Route::middleware(['auth', 'role:courier'])->get('/courier/dashboard', App\Http\Controllers\Courier\DashboardController::class)
    ->name('courier.dashboard');
