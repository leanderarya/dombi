<?php

namespace Tests\Feature;

use App\Models\PaymentAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The owner's Rekening tab posts here. Every method used to redirect to
 * owner.finance.payment-accounts.index, a route that was never registered,
 * so all three returned 500 — and store/update had already committed by then.
 */
class OwnerPaymentAccountWriteTest extends TestCase
{
    use RefreshDatabase;

    private function owner(): User
    {
        return User::factory()->create(['role' => 'owner', 'is_active' => true]);
    }

    public function test_store_creates_the_account_and_redirects_to_the_rekening_tab(): void
    {
        $this->actingAs($this->owner())
            ->post('/owner/finance/payment-accounts', [
                'bank_name' => 'BCA',
                'account_number' => '1234567890',
                'account_holder' => 'PT Dombi Indonesia',
            ])
            ->assertRedirect('/owner/finance?tab=rekening');

        $this->assertDatabaseHas('payment_accounts', ['account_number' => '1234567890']);
    }

    public function test_update_saves_and_redirects_to_the_rekening_tab(): void
    {
        $account = PaymentAccount::create([
            'bank_name' => 'BCA',
            'account_number' => '123',
            'account_holder' => 'Lama',
        ]);

        $this->actingAs($this->owner())
            ->put("/owner/finance/payment-accounts/{$account->id}", [
                'bank_name' => 'Mandiri',
                'account_number' => '456',
                'account_holder' => 'Baru',
            ])
            ->assertRedirect('/owner/finance?tab=rekening');

        $this->assertDatabaseHas('payment_accounts', [
            'id' => $account->id,
            'bank_name' => 'Mandiri',
            'account_holder' => 'Baru',
        ]);
    }

    public function test_destroy_removes_the_account_and_redirects_to_the_rekening_tab(): void
    {
        $account = PaymentAccount::create([
            'bank_name' => 'BCA',
            'account_number' => '123',
            'account_holder' => 'Test',
        ]);

        $this->actingAs($this->owner())
            ->delete("/owner/finance/payment-accounts/{$account->id}")
            ->assertRedirect('/owner/finance?tab=rekening');

        $this->assertDatabaseMissing('payment_accounts', ['id' => $account->id]);
    }
}
