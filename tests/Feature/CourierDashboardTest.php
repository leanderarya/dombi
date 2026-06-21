<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CourierDashboardTest extends TestCase
{
    use RefreshDatabase;

    private User $courier;

    protected function setUp(): void
    {
        parent::setUp();
        $this->courier = User::factory()->create(['role' => 'courier']);
    }

    public function test_dashboard_loads_for_courier(): void
    {
        $response = $this->actingAs($this->courier)->get('/courier/dashboard');
        $response->assertStatus(200);
    }

    public function test_toggle_availability(): void
    {
        $this->assertFalse($this->courier->is_online);

        $response = $this->actingAs($this->courier)->post('/courier/availability/toggle');
        $response->assertRedirect();
        $this->courier->refresh();
        $this->assertTrue($this->courier->is_online);

        $response = $this->actingAs($this->courier)->post('/courier/availability/toggle');
        $response->assertRedirect();
        $this->courier->refresh();
        $this->assertFalse($this->courier->is_online);
    }

    public function test_start_shift(): void
    {
        $response = $this->actingAs($this->courier)->post('/courier/shift/start');
        $response->assertRedirect();
        $this->courier->refresh();
        $this->assertNotNull($this->courier->shift_started_at);
        $this->assertTrue($this->courier->is_online);
    }

    public function test_end_shift(): void
    {
        $this->courier->startShift();

        $response = $this->actingAs($this->courier)->post('/courier/shift/end');
        $response->assertRedirect();
        $this->courier->refresh();
        $this->assertNotNull($this->courier->shift_ended_at);
        $this->assertFalse($this->courier->is_online);
    }

    public function test_non_courier_is_redirected_from_dashboard(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $response = $this->actingAs($user)->get('/courier/dashboard');
        $response->assertRedirect('/customer/home');
    }
}
