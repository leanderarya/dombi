<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TrackCancelOwnershipTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $otherUser;

    private Order $order;

    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['role' => 'customer']);
        $this->customer = Customer::create([
            'name' => 'Owner',
            'phone' => '6281234567890',
            'user_id' => $this->owner->id,
            'is_registered' => true,
        ]);
        $outlet = Outlet::create([
            'name' => 'Test Outlet',
            'address' => 'Jl. Outlet No. 1',
            'phone' => '6281111111111',
            'kelurahan' => 'Tembalang',
            'kecamatan' => 'Tembalang',
            'city' => 'Semarang',
            'province' => 'Jawa Tengah',
            'is_active' => true,
        ]);
        $this->order = Order::create([
            'customer_id' => $this->customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'ORD-OWN-001',
            'customer_name' => 'Owner',
            'customer_phone' => '6281234567890',
            'customer_address' => 'Jl. Test No. 1',
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
            'total' => 50000,
            'subtotal' => 50000,
            'payment_method' => 'qris',
            'payment_status' => 'pending',
        ]);

        $this->otherUser = User::factory()->create(['role' => 'customer']);
    }

    public function test_unauthenticated_user_cannot_cancel(): void
    {
        $response = $this->postJson("/track/{$this->order->recovery_token}/cancel", [
            'reason' => 'Tidak Jadi Membeli',
        ]);

        // Laravel's auth middleware returns 401 before controller runs
        $response->assertStatus(401);
    }

    public function test_owner_can_cancel_own_order(): void
    {
        $response = $this->actingAs($this->owner)
            ->postJson("/track/{$this->order->recovery_token}/cancel", [
                'reason' => 'Tidak Jadi Membeli',
            ]);

        $response->assertOk();
        $response->assertJson([
            'success' => true,
            'message' => 'Pesanan berhasil dibatalkan.',
        ]);

        $this->order->refresh();
        $this->assertEquals(Order::STATUS_CANCELLED_BY_CUSTOMER, $this->order->status);
    }

    public function test_other_user_cannot_cancel_order(): void
    {
        $response = $this->actingAs($this->otherUser)
            ->postJson("/track/{$this->order->recovery_token}/cancel", [
                'reason' => 'Tidak Jadi Membeli',
            ]);

        $response->assertStatus(403);
        $response->assertJson([
            'success' => false,
            'error' => 'Anda tidak memiliki akses ke pesanan ini.',
        ]);

        $this->order->refresh();
        $this->assertEquals(Order::STATUS_PENDING_CONFIRMATION, $this->order->status);
    }

    public function test_merged_guest_can_cancel(): void
    {
        $guestCustomer = Customer::create([
            'name' => 'Guest',
            'phone' => '6289876543210',
            'user_id' => null,
            'is_registered' => false,
        ]);
        $outlet = Outlet::first();
        $guestOrder = Order::create([
            'customer_id' => $guestCustomer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'ORD-OWN-002',
            'customer_name' => 'Guest',
            'customer_phone' => '6289876543210',
            'customer_address' => 'Jl. Test No. 2',
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
            'total' => 50000,
            'subtotal' => 50000,
            'payment_method' => 'qris',
            'payment_status' => 'pending',
        ]);

        // Simulate merge: link guest Customer to user
        $mergedUser = User::factory()->create(['role' => 'customer']);
        $guestCustomer->update(['user_id' => $mergedUser->id, 'is_registered' => true]);

        $response = $this->actingAs($mergedUser)
            ->postJson("/track/{$guestOrder->recovery_token}/cancel", [
                'reason' => 'Tidak Jadi Membeli',
            ]);

        $response->assertOk();
        $guestOrder->refresh();
        $this->assertEquals(Order::STATUS_CANCELLED_BY_CUSTOMER, $guestOrder->status);
    }

    public function test_unmerged_guest_cannot_cancel_after_google_login(): void
    {
        $guestCustomer = Customer::create([
            'name' => 'Guest',
            'phone' => '6289876543210',
            'user_id' => null,
            'is_registered' => false,
        ]);
        $outlet = Outlet::first();
        $guestOrder = Order::create([
            'customer_id' => $guestCustomer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'ORD-OWN-003',
            'customer_name' => 'Guest',
            'customer_phone' => '6289876543210',
            'customer_address' => 'Jl. Test No. 3',
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'fulfillment_type' => Order::FULFILLMENT_DELIVERY_DOMBI,
            'total' => 50000,
            'subtotal' => 50000,
            'payment_method' => 'qris',
            'payment_status' => 'pending',
        ]);

        // Google login without OTP verification — customer.user_id is still null
        $googleUser = User::factory()->create(['role' => 'customer']);

        $response = $this->actingAs($googleUser)
            ->postJson("/track/{$guestOrder->recovery_token}/cancel", [
                'reason' => 'Tidak Jadi Membeli',
            ]);

        $response->assertStatus(403);
        $response->assertJson([
            'success' => false,
            'error' => 'Anda tidak memiliki akses ke pesanan ini.',
        ]);
    }

    public function test_cannot_cancel_already_cancelled_order(): void
    {
        $this->order->update(['status' => Order::STATUS_CANCELLED_BY_CUSTOMER]);

        $response = $this->actingAs($this->owner)
            ->postJson("/track/{$this->order->recovery_token}/cancel", [
                'reason' => 'Tidak Jadi Membeli',
            ]);

        $response->assertStatus(422);
        $response->assertJson([
            'success' => false,
            'error' => 'Tidak dapat membatalkan pesanan ini.',
        ]);
    }

    public function test_cannot_cancel_completed_order(): void
    {
        $this->order->update(['status' => Order::STATUS_COMPLETED]);

        $response = $this->actingAs($this->owner)
            ->postJson("/track/{$this->order->recovery_token}/cancel", [
                'reason' => 'Tidak Jadi Membeli',
            ]);

        $response->assertStatus(422);
    }

    public function test_pickup_order_requires_last4_hp(): void
    {
        $pickupOrder = Order::create([
            'customer_id' => $this->customer->id,
            'outlet_id' => Outlet::first()->id,
            'order_code' => 'ORD-OWN-004',
            'customer_name' => 'Owner',
            'customer_phone' => '081234567890',
            'customer_address' => 'Jl. Test No. 1',
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'fulfillment_type' => Order::FULFILLMENT_PICKUP,
            'total' => 50000,
            'subtotal' => 50000,
            'payment_method' => 'qris',
            'payment_status' => 'pending',
        ]);

        // Tanpa last4_hp → 422
        $response = $this->actingAs($this->owner)
            ->postJson("/track/{$pickupOrder->recovery_token}/cancel", [
                'reason' => 'Tidak Jadi Membeli',
            ]);
        $response->assertStatus(422);

        // Dengan last4_hp salah → 422
        $response = $this->actingAs($this->owner)
            ->postJson("/track/{$pickupOrder->recovery_token}/cancel", [
                'reason' => 'Tidak Jadi Membeli',
                'last4_hp' => '0000',
            ]);
        $response->assertStatus(422);

        // Dengan last4_hp benar → OK
        $response = $this->actingAs($this->owner)
            ->postJson("/track/{$pickupOrder->recovery_token}/cancel", [
                'reason' => 'Tidak Jadi Membeli',
                'last4_hp' => '7890',
            ]);
        $response->assertOk();
    }

    public function test_invalid_token_returns_422(): void
    {
        $response = $this->actingAs($this->owner)
            ->postJson('/track/INVALIDTOKEN/cancel', [
                'reason' => 'Tidak Jadi Membeli',
            ]);

        $response->assertStatus(422);
    }
}
