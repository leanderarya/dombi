<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\CustomerAddress;
use App\Services\CustomerAddressService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerAddressTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_address_belongs_to_customer(): void
    {
        $customer = Customer::create(['name' => 'Test Customer', 'phone' => '6281234567890'.rand(1000, 9999)]);

        $address = CustomerAddress::create([
            'customer_id' => $customer->id,
            'label' => 'Rumah',
            'recipient_name' => 'Budi',
            'phone' => '08123456789',
            'address' => 'Jl. Sudirman No. 1',
            'is_default' => true,
        ]);

        $this->assertEquals($customer->id, $address->customer_id);
        $this->assertEquals($customer->id, $address->customer->id);
    }

    public function test_customer_can_have_multiple_addresses(): void
    {
        $customer = Customer::create(['name' => 'Test Customer', 'phone' => '6281234567890'.rand(1000, 9999)]);

        CustomerAddress::create([
            'customer_id' => $customer->id,
            'label' => 'Rumah',
            'recipient_name' => 'Budi',
            'phone' => '08123456789',
            'address' => 'Jl. Sudirman No. 1',
            'is_default' => true,
        ]);

        CustomerAddress::create([
            'customer_id' => $customer->id,
            'label' => 'Kantor',
            'recipient_name' => 'Budi',
            'phone' => '08123456789',
            'address' => 'Jl. Thamrin No. 2',
            'is_default' => false,
        ]);

        $this->assertEquals(2, $customer->addresses()->count());
    }

    public function test_address_service_sets_default_correctly(): void
    {
        $customer = Customer::create(['name' => 'Test Customer', 'phone' => '6281234567890'.rand(1000, 9999)]);
        $service = app(CustomerAddressService::class);

        $addr1 = $service->create($customer, [
            'label' => 'Rumah',
            'recipient_name' => 'Budi',
            'phone' => '08123456789',
            'address' => 'Jl. Sudirman No. 1',
        ]);

        $this->assertTrue($addr1->is_default);

        $addr2 = $service->create($customer, [
            'label' => 'Kantor',
            'recipient_name' => 'Budi',
            'phone' => '08123456789',
            'address' => 'Jl. Thamrin No. 2',
            'is_default' => true,
        ]);

        $addr1->refresh();
        $this->assertFalse($addr1->is_default);
        $this->assertTrue($addr2->is_default);
    }
}
