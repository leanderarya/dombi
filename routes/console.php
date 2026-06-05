<?php

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
    ->appendOutputTo(storage_path('logs/expire-pending.log'));

Schedule::command('orders:resolve-stale')
    ->daily()
    ->at('03:30')
    ->withoutOverlapping()
    ->onOneServer()
    ->appendOutputTo(storage_path('logs/resolve-stale.log'));

// ─── COURIER MANAGEMENT ─────────────────────────────────────────────

Schedule::command('couriers:auto-offline')
    ->everyFourHours()
    ->withoutOverlapping()
    ->onOneServer()
    ->appendOutputTo(storage_path('logs/auto-offline.log'));

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

// ─── SCHEDULER HEARTBEAT ────────────────────────────────────────────

Schedule::call(function () {
    \App\Support\SchedulerHeartbeat::record();
})->everyMinute()->name('scheduler-heartbeat');
