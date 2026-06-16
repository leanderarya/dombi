<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\Outlet;
use App\Models\Settlement;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SettlementReminderTest extends TestCase
{
    use RefreshDatabase;

    public function test_sends_reminders_for_settlements_due_tomorrow(): void
    {
        $outlet = Outlet::factory()->create();
        $user = User::factory()->create(['role' => 'outlet', 'outlet_id' => $outlet->id]);

        $settlement = Settlement::factory()->create([
            'outlet_id' => $outlet->id,
            'due_date' => Carbon::tomorrow(),
            'status' => Settlement::STATUS_PENDING,
        ]);

        $this->artisan('settlement:send-reminders')
            ->assertExitCode(0);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $user->id,
            'type' => 'settlement.reminder',
            'entity_type' => 'settlement',
            'entity_id' => $settlement->id,
        ]);

        $settlement->refresh();
        $this->assertNotNull($settlement->last_invoice_sent_at);
    }

    public function test_skips_paid_settlements(): void
    {
        $outlet = Outlet::factory()->create();
        $user = User::factory()->create(['role' => 'outlet', 'outlet_id' => $outlet->id]);

        Settlement::factory()->create([
            'outlet_id' => $outlet->id,
            'due_date' => Carbon::tomorrow(),
            'status' => Settlement::STATUS_PAID,
        ]);

        $this->artisan('settlement:send-reminders')
            ->assertExitCode(0);

        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_skips_already_reminded_today(): void
    {
        $outlet = Outlet::factory()->create();
        $user = User::factory()->create(['role' => 'outlet', 'outlet_id' => $outlet->id]);

        Settlement::factory()->create([
            'outlet_id' => $outlet->id,
            'due_date' => Carbon::tomorrow(),
            'status' => Settlement::STATUS_PENDING,
            'last_invoice_sent_at' => now(),
        ]);

        $this->artisan('settlement:send-reminders')
            ->assertExitCode(0);

        $this->assertDatabaseCount('notifications', 0);
    }
}
