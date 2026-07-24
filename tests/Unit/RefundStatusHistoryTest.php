<?php

namespace Tests\Unit;

use App\Models\Order;
use App\Models\RefundStatusHistory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use LogicException;
use Tests\TestCase;

class RefundStatusHistoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_updated_at_is_null(): void
    {
        $this->assertNull(RefundStatusHistory::UPDATED_AT);
    }

    public function test_defines_all_event_constants(): void
    {
        $this->assertSame('refund_requested', RefundStatusHistory::EVENT_REFUND_REQUESTED);
        $this->assertSame('destination_submitted', RefundStatusHistory::EVENT_DESTINATION_SUBMITTED);
        $this->assertSame('destination_updated', RefundStatusHistory::EVENT_DESTINATION_UPDATED);
        $this->assertSame('guest_destination_submitted_by_owner', RefundStatusHistory::EVENT_GUEST_DESTINATION_SUBMITTED_BY_OWNER);
        $this->assertSame('guest_destination_updated_by_owner', RefundStatusHistory::EVENT_GUEST_DESTINATION_UPDATED_BY_OWNER);
        $this->assertSame('processing_started', RefundStatusHistory::EVENT_PROCESSING_STARTED);
        $this->assertSame('processing_rolled_back', RefundStatusHistory::EVENT_PROCESSING_ROLLED_BACK);
        $this->assertSame('refund_rejected', RefundStatusHistory::EVENT_REFUND_REJECTED);
        $this->assertSame('refund_reopened', RefundStatusHistory::EVENT_REFUND_REOPENED);
        $this->assertSame('refund_completed', RefundStatusHistory::EVENT_REFUND_COMPLETED);
        $this->assertSame('refund_failed', RefundStatusHistory::EVENT_REFUND_FAILED);
    }

    public function test_casts_metadata_to_array(): void
    {
        $history = RefundStatusHistory::factory()->create(['metadata' => ['key' => 'value']]);

        $this->assertSame(['key' => 'value'], $history->metadata);
    }

    public function test_casts_created_at_to_datetime(): void
    {
        $history = RefundStatusHistory::factory()->create();

        $this->assertInstanceOf(\Carbon\CarbonInterface::class, $history->created_at);
    }

    public function test_allows_mass_assignment_on_all_fillable_columns(): void
    {
        $data = [
            'order_id' => Order::factory()->create()->id,
            'from_status' => null,
            'to_status' => 'refunded',
            'event' => RefundStatusHistory::EVENT_REFUND_COMPLETED,
            'actor_type' => 'system',
            'actor_id' => null,
            'reason_code' => 'transfer_confirmed',
            'note' => 'Refund completed successfully',
            'metadata' => ['txn_id' => 'TXN123'],
            'created_at' => now(),
        ];

        $history = RefundStatusHistory::create($data);

        $this->assertSame($data['order_id'], $history->order_id);
        $this->assertNull($history->from_status);
        $this->assertSame($data['to_status'], $history->to_status);
        $this->assertSame($data['event'], $history->event);
        $this->assertSame($data['actor_type'], $history->actor_type);
        $this->assertNull($history->actor_id);
        $this->assertSame($data['reason_code'], $history->reason_code);
        $this->assertSame($data['note'], $history->note);
        $this->assertSame($data['metadata'], $history->metadata);
    }

    public function test_resolves_order_relation(): void
    {
        $order = Order::factory()->create();
        $history = RefundStatusHistory::factory()->create(['order_id' => $order->id]);

        $this->assertInstanceOf(Order::class, $history->order);
        $this->assertSame($order->id, $history->order->id);
    }

    public function test_prevents_update(): void
    {
        $history = RefundStatusHistory::factory()->create();

        $this->expectException(LogicException::class);
        $this->expectExceptionMessage('Refund history is immutable.');
        $history->update(['note' => 'updated']);
    }

    public function test_prevents_save_after_mutation(): void
    {
        $history = RefundStatusHistory::factory()->create();

        $history->note = 'changed';

        $this->expectException(LogicException::class);
        $this->expectExceptionMessage('Refund history is immutable.');
        $history->save();
    }

    public function test_prevents_delete(): void
    {
        $history = RefundStatusHistory::factory()->create();

        $this->expectException(LogicException::class);
        $this->expectExceptionMessage('Refund history is immutable.');
        $history->delete();
    }

    public function test_cascade_deletes_on_parent_order_delete_at_database_level(): void
    {
        $order = Order::factory()->create();
        $history = RefundStatusHistory::factory()->create(['order_id' => $order->id]);
        $historyId = $history->id;

        $order->delete();

        $this->assertDatabaseMissing('refund_status_histories', ['id' => $historyId]);
    }
}
