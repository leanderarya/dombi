<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Notification;
use App\Models\Order;
use App\Models\OrderReport;
use App\Models\User;
use App\Services\GuestOrderMerger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GuestOrderMergerTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private Customer $registeredCustomer;

    protected function setUp(): void
    {
        parent::setUp();

        // Simulate Google login: user has Customer but no phone yet
        $this->user = User::factory()->create(['role' => 'customer', 'phone' => null]);
        $this->registeredCustomer = Customer::create([
            'name' => 'Registered User',
            'phone' => null,
            'user_id' => $this->user->id,
            'is_registered' => true,
        ]);
    }

    private function createGuestOrder(string $phone, string $code): array
    {
        $guestCustomer = Customer::create([
            'name' => 'Guest',
            'phone' => $phone,
            'user_id' => null,
            'is_registered' => false,
        ]);

        $order = Order::create([
            'customer_id' => $guestCustomer->id,
            'outlet_id' => null,
            'order_code' => $code,
            'customer_name' => 'Guest Customer',
            'customer_phone' => $phone,
            'customer_address' => 'Jl. Test No. 1',
            'status' => 'pending_confirmation',
            'fulfillment_type' => 'pickup',
            'total' => 50000,
            'subtotal' => 50000,
            'payment_method' => 'qris',
            'payment_status' => 'pending',
        ]);

        return ['customer' => $guestCustomer, 'order' => $order];
    }

    // ─── BASIC MERGE (via User.phone) ──────────────────────────────

    public function test_merge_reassigns_orders_to_registered_customer(): void
    {
        $context = $this->createGuestOrder('6281234567890', 'ORD-MERGE-001');

        // Set phone on User model (simulating OTP verification that sets user.phone)
        $this->user->update(['phone' => '6281234567890']);

        $merged = app(GuestOrderMerger::class)->merge($this->user);

        $this->assertEquals(1, $merged);

        $context['order']->refresh();
        $this->assertEquals($this->registeredCustomer->id, $context['order']->customer_id);
    }

    public function test_merge_deletes_guest_customer_after_reassignment(): void
    {
        $context = $this->createGuestOrder('6281234567890', 'ORD-MERGE-002');
        $this->user->update(['phone' => '6281234567890']);

        $guestId = $context['customer']->id;

        app(GuestOrderMerger::class)->merge($this->user);

        $this->assertDatabaseMissing('customers', ['id' => $guestId]);
    }

    public function test_merge_reassigns_notifications(): void
    {
        $context = $this->createGuestOrder('6281234567890', 'ORD-MERGE-003');
        $this->user->update(['phone' => '6281234567890']);

        $notification = Notification::create([
            'customer_id' => $context['customer']->id,
            'user_type' => 'customer',
            'type' => 'order_update',
            'title' => 'Pesanan Dikonfirmasi',
            'message' => 'Pesanan Anda sedang disiapkan.',
            'data' => json_encode(['order_id' => 1]),
        ]);

        app(GuestOrderMerger::class)->merge($this->user);

        $notification->refresh();
        $this->assertEquals($this->registeredCustomer->id, $notification->customer_id);
    }

    public function test_merge_reassigns_order_reports(): void
    {
        $context = $this->createGuestOrder('6281234567890', 'ORD-MERGE-004');
        $this->user->update(['phone' => '6281234567890']);

        $context['order']->update(['status' => 'completed']);

        $report = OrderReport::create([
            'order_id' => $context['order']->id,
            'customer_id' => $context['customer']->id,
            'type' => 'wrong_item',
            'notes' => 'Item salah',
        ]);

        app(GuestOrderMerger::class)->merge($this->user);

        $report->refresh();
        $this->assertEquals($this->registeredCustomer->id, $report->customer_id);
    }

    // ─── PHONE FORMAT NORMALIZATION ─────────────────────────────────

    public function test_merge_normalizes_phone_before_query(): void
    {
        // Both stored as 62xxx in DB (phones are normalized at creation via OTP regex)
        // The merge normalizes user's phone before querying, so +62 or 08 prefixes match
        $context = $this->createGuestOrder('6281234567890', 'ORD-PHONE-001');

        // User phone stored with + prefix (edge case from external import)
        $this->user->update(['phone' => '+6281234567890']);

        $merged = app(GuestOrderMerger::class)->merge($this->user);

        $this->assertEquals(1, $merged);

        $context['order']->refresh();
        $this->assertEquals($this->registeredCustomer->id, $context['order']->customer_id);
    }

    // ─── EDGE CASES ─────────────────────────────────────────────────

    public function test_merge_returns_zero_when_user_has_no_phone(): void
    {
        $merged = app(GuestOrderMerger::class)->merge($this->user);

        $this->assertEquals(0, $merged);
    }

    public function test_merge_returns_zero_when_no_guest_customers(): void
    {
        $this->user->update(['phone' => '6281234567890']);

        $merged = app(GuestOrderMerger::class)->merge($this->user);

        $this->assertEquals(0, $merged);
    }

    public function test_merge_handles_guest_with_no_orders(): void
    {
        Customer::create([
            'name' => 'Guest No Orders',
            'phone' => '6281234567890',
            'user_id' => null,
            'is_registered' => false,
        ]);

        $this->user->update(['phone' => '6281234567890']);

        $merged = app(GuestOrderMerger::class)->merge($this->user);

        $this->assertEquals(1, $merged);

        $this->assertDatabaseMissing('customers', [
            'phone' => '6281234567890',
            'user_id' => null,
        ]);
    }

    // ─── LINK TO USER (no registered customer) ──────────────────────

    public function test_merge_links_guest_customer_when_no_registered_customer(): void
    {
        $newUser = User::factory()->create(['role' => 'customer', 'phone' => '6289998887776']);

        $guestCustomer = Customer::create([
            'name' => 'Guest',
            'phone' => '6289998887776',
            'user_id' => null,
            'is_registered' => false,
        ]);

        Order::create([
            'customer_id' => $guestCustomer->id,
            'outlet_id' => null,
            'order_code' => 'ORD-LINK-001',
            'customer_name' => 'Guest Customer',
            'customer_phone' => '6289998887776',
            'customer_address' => 'Jl. Test No. 1',
            'status' => 'pending_confirmation',
            'fulfillment_type' => 'pickup',
            'total' => 50000,
            'subtotal' => 50000,
            'payment_method' => 'qris',
            'payment_status' => 'pending',
        ]);

        $merged = app(GuestOrderMerger::class)->merge($newUser);

        $this->assertEquals(1, $merged);

        $guestCustomer->refresh();
        $this->assertEquals($newUser->id, $guestCustomer->user_id);
        $this->assertTrue($guestCustomer->is_registered);
    }
}
