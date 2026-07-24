<?php

namespace Tests\Feature;

use App\Http\Requests\Customer\UpdateRefundDestinationRequest;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class RefundDestinationRequestTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_update_destination_for_own_order(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $order = Order::factory()->create(['customer_id' => $user->getCustomerOrCreate()->id]);

        $this->assertTrue($this->requestFor($user, $order)->authorize());
    }

    public function test_customer_cannot_update_destination_for_another_customers_order(): void
    {
        $user = User::factory()->create(['role' => 'customer']);
        $order = Order::factory()->create();

        $this->assertFalse($this->requestFor($user, $order)->authorize());
    }

    public function test_valid_bank_destination_passes_validation(): void
    {
        $validator = Validator::make([
            'destination_type' => 'bank',
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'account_holder' => 'Arya',
        ], (new UpdateRefundDestinationRequest)->rules());

        $this->assertTrue($validator->passes());
    }

    public function test_valid_ewallet_destination_passes_validation(): void
    {
        $validator = Validator::make([
            'destination_type' => 'ewallet',
            'ewallet_provider' => 'GoPay',
            'ewallet_number' => '081234567890',
            'ewallet_holder' => 'Arya',
        ], (new UpdateRefundDestinationRequest)->rules());

        $this->assertTrue($validator->passes());
    }

    public function test_incomplete_destination_fails_validation(): void
    {
        $validator = Validator::make([
            'destination_type' => 'bank',
            'bank_name' => 'BCA',
        ], (new UpdateRefundDestinationRequest)->rules());

        $this->assertTrue($validator->fails());
        $this->assertTrue($validator->errors()->has('account_number'));
        $this->assertTrue($validator->errors()->has('account_holder'));
    }

    public function test_mixed_destination_methods_fail_validation(): void
    {
        $validator = Validator::make([
            'destination_type' => 'bank',
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'account_holder' => 'Arya',
            'ewallet_provider' => 'GoPay',
            'ewallet_number' => '081234567890',
            'ewallet_holder' => 'Arya',
        ], (new UpdateRefundDestinationRequest)->rules());

        $this->assertTrue($validator->fails());
        $this->assertTrue($validator->errors()->has('ewallet_provider'));
        $this->assertTrue($validator->errors()->has('ewallet_number'));
        $this->assertTrue($validator->errors()->has('ewallet_holder'));
    }

    private function requestFor(User $user, Order $order): UpdateRefundDestinationRequest
    {
        $request = new UpdateRefundDestinationRequest;
        $request->setUserResolver(fn () => $user);
        $request->setRouteResolver(fn () => new class($order)
        {
            public function __construct(private readonly Order $order) {}

            public function parameter(string $key): ?Order
            {
                return $key === 'order' ? $this->order : null;
            }
        });

        return $request;
    }
}
