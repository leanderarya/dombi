<?php

namespace Tests\Feature;

use App\Models\Outlet;
use App\Models\RestockRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RestockCheckStuckTest extends TestCase
{
    use RefreshDatabase;

    public function test_notifies_owners_about_restocks_shipped_past_the_window(): void
    {
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $outlet = Outlet::factory()->create();

        $restock = RestockRequest::create([
            'outlet_id' => $outlet->id,
            'status' => 'shipped',
            'sent_at' => now()->subDays(5),
        ]);

        $this->artisan('restock:check-stuck')->assertExitCode(0);

        $this->assertDatabaseHas('notifications', [
            'user_type' => 'owner',
            'user_id' => $owner->id,
            'type' => 'system.restock_stuck',
            'entity_type' => 'restock_request',
            'entity_id' => $restock->id,
        ]);
    }

    public function test_ignores_restocks_still_within_the_window(): void
    {
        User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $outlet = Outlet::factory()->create();

        RestockRequest::create([
            'outlet_id' => $outlet->id,
            'status' => 'shipped',
            'sent_at' => now()->subDay(),
        ]);

        $this->artisan('restock:check-stuck')->assertExitCode(0);

        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_ignores_restocks_that_were_never_shipped(): void
    {
        User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $outlet = Outlet::factory()->create();

        RestockRequest::create([
            'outlet_id' => $outlet->id,
            'status' => 'requested',
            'sent_at' => now()->subDays(5),
        ]);

        $this->artisan('restock:check-stuck')->assertExitCode(0);

        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_honours_the_days_option(): void
    {
        User::factory()->create(['role' => 'owner', 'is_active' => true]);
        $outlet = Outlet::factory()->create();

        RestockRequest::create([
            'outlet_id' => $outlet->id,
            'status' => 'shipped',
            'sent_at' => now()->subDays(5),
        ]);

        $this->artisan('restock:check-stuck', ['--days' => 10])->assertExitCode(0);

        $this->assertDatabaseCount('notifications', 0);
    }
}
