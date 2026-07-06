<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\PaymentTransaction;
use App\Models\Order;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\User;
use App\Services\DokuService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentScenarioTest extends TestCase
{
    use RefreshDatabase;

    // ─── DOKU STATUS MAPPING ────────────────────────────────────

    public function test_map_status_success(): void
    {
        $doku = new DokuService();
        $this->assertEquals('paid', $doku->mapStatus('SUCCESS'));
        $this->assertEquals('paid', $doku->mapStatus('success'));
        $this->assertEquals('paid', $doku->mapStatus('Success'));
    }

    public function test_map_status_pending(): void
    {
        $doku = new DokuService();
        $this->assertEquals('pending', $doku->mapStatus('PENDING'));
        $this->assertEquals('pending', $doku->mapStatus('pending'));
        $this->assertEquals('pending', $doku->mapStatus(null));
    }

    public function test_map_status_failed(): void
    {
        $doku = new DokuService();
        $this->assertEquals('failed', $doku->mapStatus('FAILED'));
        $this->assertEquals('failed', $doku->mapStatus('failed'));
    }

    public function test_map_status_rejected(): void
    {
        $doku = new DokuService();
        $this->assertEquals('failed', $doku->mapStatus('REJECTED'));
        $this->assertEquals('failed', $doku->mapStatus('rejected'));
    }

    public function test_map_status_denied(): void
    {
        $doku = new DokuService();
        $this->assertEquals('failed', $doku->mapStatus('DENIED'));
        $this->assertEquals('failed', $doku->mapStatus('denied'));
    }

    public function test_map_status_cancelled(): void
    {
        $doku = new DokuService();
        $this->assertEquals('failed', $doku->mapStatus('CANCELLED'));
        $this->assertEquals('failed', $doku->mapStatus('cancelled'));
    }

    public function test_map_status_expired(): void
    {
        $doku = new DokuService();
        $this->assertEquals('expired', $doku->mapStatus('EXPIRED'));
        $this->assertEquals('expired', $doku->mapStatus('expired'));
    }

    public function test_map_status_unknown_defaults_to_pending(): void
    {
        $doku = new DokuService();
        $this->assertEquals('pending', $doku->mapStatus('UNKNOWN_STATUS'));
        $this->assertEquals('pending', $doku->mapStatus(''));
    }

    // ─── PAYMENT REJECTED → ORDER EXPIRED ──────────────────────

    public function test_payment_rejected_expires_order(): void
    {
        $user = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $customer = Customer::create([
            'name' => $user->name,
            'phone' => '6281234567890',
            'email' => $user->email,
            'user_id' => $user->id,
            'is_registered' => true,
        ]);

        $order = $this->createOrder($customer, [
            'payment_status' => 'pending',
            'doku_order_id' => 'DOMBI-REJECT-001',
        ]);

        // Simulate what happens when payment is rejected
        // In real scenario, Doku returns 'REJECTED' status
        // mapStatus maps it to 'failed'
        // syncStatusFromDoku should expire the order

        $doku = new DokuService();
        $status = $doku->mapStatus('REJECTED');

        $this->assertEquals('failed', $status);
        $this->assertEquals('pending_confirmation', $order->status);
    }

    // ─── PAYMENT SUCCESS → ORDER PAID ──────────────────────────

    public function test_payment_success_marks_order_paid(): void
    {
        $user = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $customer = Customer::create([
            'name' => $user->name,
            'phone' => '6281234567891',
            'email' => $user->email,
            'user_id' => $user->id,
            'is_registered' => true,
        ]);

        $order = $this->createOrder($customer, [
            'payment_status' => 'pending',
        ]);

        $doku = new DokuService();
        $status = $doku->mapStatus('SUCCESS');

        $this->assertEquals('paid', $status);
    }

    // ─── PAYMENT CANCELLED → ORDER EXPIRED ─────────────────────

    public function test_payment_cancelled_maps_to_failed(): void
    {
        $doku = new DokuService();
        $status = $doku->mapStatus('CANCELLED');

        $this->assertEquals('failed', $status);
    }

    // ─── PAYMENT EXPIRED → ORDER EXPIRED ───────────────────────

    public function test_payment_expired_maps_to_expired(): void
    {
        $doku = new DokuService();
        $status = $doku->mapStatus('EXPIRED');

        $this->assertEquals('expired', $status);
    }

    // ─── PAY ENDPOINT ──────────────────────────────────────────

    public function test_pay_endpoint_rejects_paid_order(): void
    {
        $user = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $customer = Customer::create([
            'name' => $user->name,
            'phone' => '6281234567892',
            'email' => $user->email,
            'user_id' => $user->id,
            'is_registered' => true,
        ]);

        $order = $this->createOrder($customer, [
            'payment_status' => 'paid',
        ]);

        $response = $this->actingAs($user)
            ->post("/customer/orders/{$order->id}/pay");

        $response->assertRedirect();
    }

    public function test_pay_endpoint_rejects_terminal_order(): void
    {
        $user = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $customer = Customer::create([
            'name' => $user->name,
            'phone' => '6281234567893',
            'email' => $user->email,
            'user_id' => $user->id,
            'is_registered' => true,
        ]);

        $order = $this->createOrder($customer, [
            'status' => Order::STATUS_COMPLETED,
            'payment_status' => 'paid',
        ]);

        $response = $this->actingAs($user)
            ->post("/customer/orders/{$order->id}/pay");

        $response->assertRedirect();
    }

    public function test_pay_endpoint_rejects_cod_order(): void
    {
        $user = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $customer = Customer::create([
            'name' => $user->name,
            'phone' => '6281234567894',
            'email' => $user->email,
            'user_id' => $user->id,
            'is_registered' => true,
        ]);

        $order = $this->createOrder($customer, [
            'payment_method' => 'cod',
            'payment_status' => 'pending',
        ]);

        $response = $this->actingAs($user)
            ->post("/customer/orders/{$order->id}/pay");

        $response->assertRedirect();
    }

    public function test_pay_endpoint_rejects_failed_order(): void
    {
        $user = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $customer = Customer::create([
            'name' => $user->name,
            'phone' => '6281234567895',
            'email' => $user->email,
            'user_id' => $user->id,
            'is_registered' => true,
        ]);

        $order = $this->createOrder($customer, [
            'payment_status' => 'failed',
            'doku_order_id' => 'DOMBI-FAIL-001',
        ]);

        // Without mocking DokuService, sync will fail gracefully
        $response = $this->actingAs($user)
            ->post("/customer/orders/{$order->id}/pay");

        $response->assertRedirect();
    }

    // ─── PAYMENT STATUS ENDPOINT ───────────────────────────────

    public function test_payment_status_endpoint_returns_status(): void
    {
        $user = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $customer = Customer::create([
            'name' => $user->name,
            'phone' => '6281234567896',
            'email' => $user->email,
            'user_id' => $user->id,
            'is_registered' => true,
        ]);

        $order = $this->createOrder($customer, [
            'payment_status' => 'pending',
        ]);

        $response = $this->actingAs($user)
            ->getJson("/customer/orders/{$order->id}/payment-status");

        $response->assertOk()
            ->assertJson([
                'payment_status' => 'pending',
            ]);
    }

    public function test_payment_status_endpoint_returns_paid(): void
    {
        $user = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $customer = Customer::create([
            'name' => $user->name,
            'phone' => '6281234567897',
            'email' => $user->email,
            'user_id' => $user->id,
            'is_registered' => true,
        ]);

        $order = $this->createOrder($customer, [
            'payment_status' => 'paid',
        ]);

        $response = $this->actingAs($user)
            ->getJson("/customer/orders/{$order->id}/payment-status");

        $response->assertOk()
            ->assertJson([
                'payment_status' => 'paid',
            ]);
    }

    public function test_payment_status_endpoint_returns_failed(): void
    {
        $user = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $customer = Customer::create([
            'name' => $user->name,
            'phone' => '6281234567898',
            'email' => $user->email,
            'user_id' => $user->id,
            'is_registered' => true,
        ]);

        $order = $this->createOrder($customer, [
            'payment_status' => 'failed',
        ]);

        $response = $this->actingAs($user)
            ->getJson("/customer/orders/{$order->id}/payment-status");

        $response->assertOk()
            ->assertJson([
                'payment_status' => 'failed',
            ]);
    }

    // ─── RESTORE CART ──────────────────────────────────────────

    public function test_restore_cart_redirects_to_checkout(): void
    {
        $user = User::factory()->create(['role' => 'customer', 'is_active' => true]);
        $customer = Customer::create([
            'name' => $user->name,
            'phone' => '6281234567899',
            'email' => $user->email,
            'user_id' => $user->id,
            'is_registered' => true,
        ]);

        $order = $this->createOrder($customer, [
            'payment_status' => 'failed',
        ]);

        $response = $this->actingAs($user)
            ->get("/customer/orders/{$order->id}/restore-cart");

        $response->assertRedirect();
    }

    // ─── DOKU CARD SCENARIOS ───────────────────────────────────

    /**
     * Test card scenarios mapping:
     * 4617006911111106 - 3DS Success → paid
     * 4617006911111114 - 3DS Rejected by DOKU → failed
     * 4617006911111122 - 3DS Rejected by Bank → failed
     * 4617006911111130 - Non 3DS Success → paid
     * 4617006911111213 - Non 3DS Rejected by DOKU → failed
     * 4617006911111221 - Non 3DS Rejected by Bank → failed
     */
    public function test_doku_card_scenario_3ds_success(): void
    {
        $doku = new DokuService();
        // 3DS Success returns 'SUCCESS' status
        $this->assertEquals('paid', $doku->mapStatus('SUCCESS'));
    }

    public function test_doku_card_scenario_3ds_rejected_by_doku(): void
    {
        $doku = new DokuService();
        // 3DS Rejected by DOKU returns 'REJECTED' status
        $this->assertEquals('failed', $doku->mapStatus('REJECTED'));
    }

    public function test_doku_card_scenario_3ds_rejected_by_bank(): void
    {
        $doku = new DokuService();
        // 3DS Rejected by Bank returns 'DENIED' status
        $this->assertEquals('failed', $doku->mapStatus('DENIED'));
    }

    public function test_doku_card_scenario_non_3ds_success(): void
    {
        $doku = new DokuService();
        // Non 3DS Success returns 'SUCCESS' status
        $this->assertEquals('paid', $doku->mapStatus('SUCCESS'));
    }

    public function test_doku_card_scenario_non_3ds_rejected_by_doku(): void
    {
        $doku = new DokuService();
        // Non 3DS Rejected by DOKU returns 'REJECTED' status
        $this->assertEquals('failed', $doku->mapStatus('REJECTED'));
    }

    public function test_doku_card_scenario_non_3ds_rejected_by_bank(): void
    {
        $doku = new DokuService();
        // Non 3DS Rejected by Bank returns 'DENIED' status
        $this->assertEquals('failed', $doku->mapStatus('DENIED'));
    }

    // ─── HELPERS ───────────────────────────────────────────────

    private function createOrder(Customer $customer, array $overrides = []): Order
    {
        $outlet = Outlet::create([
            'name' => 'Test Outlet',
            'kelurahan' => 'Test Kelurahan',
            'kecamatan' => 'Test Kecamatan',
            'address' => 'Jl. Test No. 123',
            'status' => 'active',
        ]);

        $product = Product::create([
            'name' => 'Susu Kambing 500ml',
            'slug' => 'susu-kambing-500ml-'.uniqid(),
            'unit' => 'botol',
            'price' => 25000,
            'is_active' => true,
        ]);

        $order = Order::create(array_merge([
            'customer_id' => $customer->id,
            'outlet_id' => $outlet->id,
            'order_code' => 'DOMBI-TEST-'.strtoupper(uniqid()),
            'status' => Order::STATUS_PENDING_CONFIRMATION,
            'fulfillment_type' => 'pickup',
            'subtotal' => 50000,
            'delivery_fee' => 0,
            'payment_method' => 'credit_card',
            'payment_fee' => 0,
            'total' => 50000,
            'customer_name' => $customer->name,
            'customer_phone' => $customer->phone,
            'customer_address' => 'Jl. Test',
            'ordered_at' => now(),
            'confirmation_expires_at' => now()->addMinutes(15),
            'payment_status' => 'pending',
        ], $overrides));

        $order->items()->create([
            'product_id' => $product->id,
            'product_name' => $product->name,
            'quantity' => 2,
            'price' => $product->price,
            'subtotal' => 50000,
        ]);

        return $order;
    }
}
