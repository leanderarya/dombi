<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderRefundDestination;
use App\Models\User;
use App\Services\RefundService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use LogicException;
use Tests\TestCase;

class RefundDestinationHistoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_updating_a_destination_keeps_the_previous_account_details(): void
    {
        $order = $this->registeredRefundableOrder();

        $this->submitBank($order, 'BCA', '111', 'First');
        $this->submitBank($order->fresh(), 'Mandiri', '222', 'Second');

        $rows = $this->destinationsFor($order);

        $this->assertCount(2, $rows);
        $this->assertSame(
            ['BCA', '111', 'First'],
            [$rows[0]->bank_name, $rows[0]->account_number, $rows[0]->account_holder]
        );
        $this->assertSame(OrderRefundDestination::EVENT_SUBMITTED, $rows[0]->event);
        $this->assertSame(
            ['Mandiri', '222', 'Second'],
            [$rows[1]->bank_name, $rows[1]->account_number, $rows[1]->account_holder]
        );
        $this->assertSame(OrderRefundDestination::EVENT_UPDATED, $rows[1]->event);
    }

    public function test_an_ewallet_destination_records_only_ewallet_fields(): void
    {
        $order = $this->registeredRefundableOrder();

        app(RefundService::class)->submitDestination($order, 'ewallet', 'customer', null, [
            'ewallet_provider' => 'GoPay',
            'ewallet_number' => '081234567890',
            'ewallet_holder' => 'Arya',
        ]);

        $destination = $this->destinationsFor($order)->sole();

        $this->assertSame('ewallet', $destination->destination_type);
        $this->assertSame('GoPay', $destination->ewallet_provider);
        $this->assertSame('081234567890', $destination->ewallet_number);
        $this->assertNull($destination->bank_name);
        $this->assertNull($destination->account_number);
    }

    public function test_owner_submission_records_the_owner_as_actor(): void
    {
        $order = $this->guestRefundableOrder();
        $owner = User::factory()->create(['role' => 'owner']);

        app(RefundService::class)->submitDestination($order, 'bank', 'owner', $owner->id, [
            'bank_name' => 'BCA',
            'account_number' => '111',
            'account_holder' => 'Guest',
        ]);

        $destination = $this->destinationsFor($order)->sole();

        $this->assertSame('owner', $destination->actor_type);
        $this->assertSame($owner->id, $destination->actor_id);
    }

    public function test_destination_history_is_immutable(): void
    {
        $order = $this->registeredRefundableOrder();
        $this->submitBank($order, 'BCA', '111', 'First');

        $destination = $this->destinationsFor($order)->sole();
        $destination->bank_name = 'Changed';

        $this->expectException(LogicException::class);
        $destination->save();
    }

    public function test_destination_history_cannot_be_deleted(): void
    {
        $order = $this->registeredRefundableOrder();
        $this->submitBank($order, 'BCA', '111', 'First');

        $this->expectException(LogicException::class);
        $this->destinationsFor($order)->sole()->delete();
    }

    public function test_an_order_cannot_hold_both_bank_and_ewallet_destination_fields(): void
    {
        $order = $this->registeredRefundableOrder();

        $this->expectException(QueryException::class);
        $order->update([
            'refund_destination_type' => 'bank',
            'refund_bank_name' => 'BCA',
            'refund_account_number' => '111',
            'refund_account_holder' => 'Arya',
            'refund_ewallet_provider' => 'GoPay',
        ]);
    }

    public function test_backfill_copies_encrypted_destination_values(): void
    {
        $order = Order::factory()->paid()->create([
            'refund_destination_type' => 'bank',
            'refund_bank_name' => 'BCA',
            'refund_account_number' => '1234567890',
            'refund_account_holder' => 'Arya',
            'refund_destination_submitted_at' => now(),
        ]);

        $this->artisan('refunds:backfill-destinations')->assertSuccessful();

        $destination = $this->destinationsFor($order)->sole();

        $this->assertSame(OrderRefundDestination::EVENT_BACKFILLED, $destination->event);
        $this->assertSame('bank', $destination->destination_type);
        $this->assertSame('BCA', $destination->bank_name);
        $this->assertSame('1234567890', $destination->account_number);
        $this->assertSame('Arya', $destination->account_holder);
        $this->assertNull($destination->actor_type);
    }

    public function test_backfill_is_idempotent(): void
    {
        $this->orderWithStoredDestination();

        $this->artisan('refunds:backfill-destinations')->assertSuccessful();
        $this->artisan('refunds:backfill-destinations')->assertSuccessful();

        $this->assertDatabaseCount('order_refund_destinations', 1);
    }

    public function test_backfill_dry_run_writes_nothing(): void
    {
        $this->orderWithStoredDestination();

        $this->artisan('refunds:backfill-destinations', ['--dry-run' => true])->assertSuccessful();

        $this->assertDatabaseCount('order_refund_destinations', 0);
    }

    private function registeredRefundableOrder(): Order
    {
        $user = User::factory()->create();
        $customer = Customer::factory()->create(['user_id' => $user->id]);

        return Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_pending',
            'refund_destination_status' => Order::REFUND_DESTINATION_MISSING,
        ]);
    }

    private function guestRefundableOrder(): Order
    {
        $customer = Customer::factory()->create(['user_id' => null]);

        return Order::factory()->paid()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_pending',
            'refund_destination_status' => Order::REFUND_DESTINATION_MISSING,
        ]);
    }

    private function orderWithStoredDestination(): Order
    {
        return Order::factory()->paid()->create([
            'refund_destination_type' => 'bank',
            'refund_bank_name' => 'BCA',
            'refund_account_number' => '111',
            'refund_account_holder' => 'Arya',
        ]);
    }

    private function submitBank(Order $order, string $bank, string $number, string $holder): void
    {
        app(RefundService::class)->submitDestination($order, 'bank', 'customer', null, [
            'bank_name' => $bank,
            'account_number' => $number,
            'account_holder' => $holder,
        ]);
    }

    private function destinationsFor(Order $order): Collection
    {
        return OrderRefundDestination::where('order_id', $order->id)->orderBy('id')->get();
    }
}
