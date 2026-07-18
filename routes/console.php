<?php

use App\Support\SchedulerHeartbeat;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// ─── ORDER MANAGEMENT ───────────────────────────────────────────────

Schedule::command('orders:expire-pending')
    ->everyMinute()
    ->withoutOverlapping()
    ->onOneServer()
    ->after(function () {
        \Illuminate\Support\Facades\Log::info('orders:expire-pending completed');
    })
    ->onFailure(function () {
        \Illuminate\Support\Facades\Log::alert('orders:expire-pending FAILED');
    })
    ->appendOutputTo(storage_path('logs/expire-pending.log'));

Schedule::command('orders:resolve-stale')
    ->daily()
    ->at('03:30')
    ->withoutOverlapping()
    ->onOneServer()
    ->after(function () {
        \Illuminate\Support\Facades\Log::info('orders:resolve-stale completed');
    })
    ->onFailure(function () {
        \Illuminate\Support\Facades\Log::alert('orders:resolve-stale FAILED');
    })
    ->appendOutputTo(storage_path('logs/resolve-stale.log'));

// ─── COURIER MANAGEMENT ─────────────────────────────────────────────

Schedule::command('couriers:auto-offline')
    ->everyFourHours()
    ->withoutOverlapping()
    ->onOneServer()
    ->appendOutputTo(storage_path('logs/auto-offline.log'));

// ─── SETTLEMENT REMINDERS ─────────────────────────────────────────

Schedule::command('settlement:send-reminders')
    ->daily()
    ->at('08:00')
    ->withoutOverlapping()
    ->onOneServer()
    ->appendOutputTo(storage_path('logs/settlement-reminders.log'));

// ─── BACKUPS ────────────────────────────────────────────────────────

Schedule::command('backup:clean')
    ->daily()
    ->at('02:00')
    ->withoutOverlapping()
    ->onOneServer();

Schedule::command('backup:run')
    ->daily()
    ->at('02:30')
    ->withoutOverlapping()
    ->onOneServer();

Schedule::command('backup:monitor')
    ->daily()
    ->at('03:00')
    ->withoutOverlapping()
    ->onOneServer();

// ─── RETURN AUTO-CONFIRM ──────────────────────────────────────────

Schedule::command('deliveries:auto-confirm-return')
    ->hourly()
    ->withoutOverlapping()
    ->onOneServer()
    ->appendOutputTo(storage_path('logs/auto-confirm-return.log'));

// ─── RESTOCK STUCK CHECK ────────────────────────────────────────────

Schedule::command('restock:check-stuck')
    ->daily()
    ->at('08:30')
    ->withoutOverlapping()
    ->onOneServer()
    ->appendOutputTo(storage_path('logs/restock-stuck.log'));

// ─── SCHEDULER HEARTBEAT ────────────────────────────────────────────

Schedule::call(function () {
    SchedulerHeartbeat::record();
})->everyMinute()->name('scheduler-heartbeat');
