<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentAdminRecoveryTest extends TestCase
{
    use RefreshDatabase;

    public function test_non_owner_cannot_access_payment_recovery_read_endpoints(): void
    {
        $user = User::factory()->create(['role' => 'customer']);

        $this->actingAs($user)->get('/owner/finance/payments')->assertRedirect('/customer/home');
    }

    public function test_owner_can_read_payment_recovery_data(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);

        $response = $this->actingAs($owner)->get('/owner/finance/payments');

        $response->assertOk();
        $response->assertJsonStructure(['attempts', 'webhooks', 'refund_obligations']);
    }

    public function test_owner_payment_recovery_routes_are_registered(): void
    {
        $this->assertSame('/owner/finance/payments', route('owner.finance.payments.index', [], false));
        $this->assertSame('/owner/finance/payments/1/check-status', route('owner.finance.payments.check-status', ['attempt' => 1], false));
        $this->assertSame('/owner/finance/refund-obligations/1/needs-review', route('owner.finance.refund-obligations.needs-review', ['obligation' => 1], false));
    }
}
