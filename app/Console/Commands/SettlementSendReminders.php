<?php

namespace App\Console\Commands;

use App\Models\Settlement;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class SettlementSendReminders extends Command
{
    protected $signature = 'settlement:send-reminders';
    protected $description = 'Send payment reminders for settlements due tomorrow';

    public function handle(NotificationService $notificationService): int
    {
        $tomorrow = Carbon::tomorrow();

        $settlements = Settlement::query()
            ->where('due_date', $tomorrow)
            ->whereNotIn('status', [Settlement::STATUS_PAID])
            ->where(function ($query) {
                $query->whereNull('last_invoice_sent_at')
                    ->orWhereDate('last_invoice_sent_at', '!=', now());
            })
            ->with('outlet')
            ->get();

        $sent = 0;
        foreach ($settlements as $settlement) {
            $notificationService->notifySettlementReminder($settlement);
            $settlement->update(['last_invoice_sent_at' => now()]);
            $sent++;
        }

        $this->info("Sent {$sent} payment reminders.");

        return self::SUCCESS;
    }
}
