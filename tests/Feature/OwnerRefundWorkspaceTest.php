<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\RefundObligation;
use App\Models\SettlementPayment;
use App\Models\User;
use App\Services\RefundPayloadService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class OwnerRefundWorkspaceTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Customer $guest;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create(['role' => 'owner']);
        $this->guest = Customer::factory()->create(['user_id' => null]);
    }

    public function test_finance_tab_refund_loads(): void
    {
        $this->actingAs($this->owner)
            ->get('/owner/finance?tab=refund')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('owner/finance/index')
                ->where('tab', 'refund')
                ->where('refundFilter', 'ready')
                ->has('refunds.data', 0)
                ->has('refundCounts')
                ->missing('kpis')
                ->missing('outlets')
                ->missing('payments')
                ->missing('paymentKpis')
                ->missing('accounts')
            );
    }

    public function test_finance_tab_pembayaran_loads_only_payment_data(): void
    {
        SettlementPayment::factory()->create([
            'status' => SettlementPayment::STATUS_PENDING,
        ]);
        $verifiedPayment = SettlementPayment::factory()->create([
            'status' => SettlementPayment::STATUS_VERIFIED,
        ]);

        $this->actingAs($this->owner)
            ->get('/owner/finance?tab=pembayaran&status=verified')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('tab', 'pembayaran')
                ->where('statusFilter', 'verified')
                ->has('payments.data', 1)
                ->where('payments.data.0.id', $verifiedPayment->id)
                ->where('paymentKpis.pending_count', 1)
                ->missing('kpis')
                ->missing('outlets')
                ->missing('accounts')
                ->missing('refunds')
                ->missing('refundCounts')
            );
    }

    public function test_finance_tab_rekening_loads_only_account_data(): void
    {
        $this->actingAs($this->owner)
            ->get('/owner/finance?tab=rekening')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('tab', 'rekening')
                ->has('accounts')
                ->missing('kpis')
                ->missing('outlets')
                ->missing('payments')
                ->missing('paymentKpis')
                ->missing('refunds')
                ->missing('refundCounts')
            );
    }

    public function test_awaiting_guest_queue(): void
    {
        Order::factory()->create([
            'customer_id' => $this->guest->id,
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'missing',
            'refund_amount' => 50000,
            'refund_requested_at' => now(),
        ]);

        $this->actingAs($this->owner)
            ->get('/owner/finance?tab=refund&filter=awaiting_guest')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('refundFilter', 'awaiting_guest')
                ->has('refunds.data', 1)
                ->where('refunds.data.0.queue_state', 'awaiting_guest')
                ->where('refundCounts.awaiting_guest', 1)
            );
    }

    public function test_ready_queue(): void
    {
        $customer = Customer::factory()->create(['user_id' => User::factory()->create(['role' => 'customer'])->id]);
        Order::factory()->create([
            'customer_id' => $customer->id,
            'payment_status' => 'refund_pending',
            'refund_destination_status' => 'valid',
            'refund_amount' => 50000,
            'refund_requested_at' => now(),
        ]);

        $this->actingAs($this->owner)
            ->get('/owner/finance?tab=refund&filter=ready')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('refundFilter', 'ready')
                ->has('refunds.data', 1)
                ->where('refunds.data.0.queue_state', 'ready')
                ->where('refundCounts.ready', 1)
            );
    }

    public function test_action_required_filter_includes_legacy_and_canonical_failed_refunds(): void
    {
        $legacyFailed = $this->createRefundOrder('legacy-failed', 'refund_failed', $this->guest);
        $canonicalFailed = $this->createRefundOrder('canonical-failed', 'refund_pending', $this->guest, 'missing', 'failed');

        $response = $this->actingAs($this->owner)
            ->get('/owner/finance?tab=refund&filter=action_required')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('refundFilter', 'action_required')
                ->where('refundCounts.action_required', 2)
                ->has('refunds.data', 2)
                ->where('refunds.data.0.queue_state', 'action_required')
                ->where('refunds.data.1.queue_state', 'action_required')
            );

        $listedIds = array_column($response->inertiaProps('refunds.data'), 'order_id');
        $expectedIds = [$legacyFailed->id, $canonicalFailed->id];
        sort($listedIds);
        sort($expectedIds);
        $this->assertSame($expectedIds, $listedIds);
        $this->assertSame('action_required', app(RefundPayloadService::class)->queueState($legacyFailed));
        $this->assertSame('action_required', app(RefundPayloadService::class)->queueState($canonicalFailed));
    }

    public function test_all_refund_queue_filters_are_accepted(): void
    {
        foreach (RefundPayloadService::QUEUES as $filter) {
            $response = $this->actingAs($this->owner)
                ->get("/owner/finance?tab=refund&filter={$filter}");

            $response->assertOk();
            $this->assertSame($filter, $response->inertiaProps('refundFilter'));
        }
    }

    public function test_refund_filters_match_queue_classification_without_overlap(): void
    {
        $registered = Customer::factory()->create([
            'user_id' => User::factory()->create(['role' => 'customer'])->id,
        ]);
        $canonicalFreshFallback = $this->createRefundOrder('fresh-canonical-fallback', 'refund_pending', $this->guest, 'valid', 'in_progress', now()->subHour()->toDateTimeString());
        $canonicalFreshFallback->selectedRefundObligation()?->update(['started_at' => null]);
        $canonicalStaleFallback = $this->createRefundOrder('stale-canonical-fallback', 'refund_pending', $this->guest, 'valid', 'in_progress', now()->subHours(24)->toDateTimeString());
        $canonicalStaleFallback->selectedRefundObligation()?->update(['started_at' => null]);

        $ordersByQueue = [
            'awaiting_customer' => [$this->createRefundOrder('awaiting-customer', 'refund_pending', $registered)],
            'awaiting_guest' => [
                $this->createRefundOrder('awaiting-guest', 'refund_pending', $this->guest),
                $this->createRefundOrder('awaiting-guest-no-customer', 'refund_pending', null),
            ],
            'ready' => [$this->createRefundOrder('ready', 'refund_pending', $this->guest, 'valid')],
            'in_progress' => [
                $this->createRefundOrder('fresh-canonical-progress', 'refund_pending', $this->guest, 'valid', 'in_progress', now()->subHour()->toDateTimeString()),
                $canonicalFreshFallback,
                $this->createRefundOrder('fresh-legacy-progress', 'refund_in_progress', $this->guest, 'valid', null, now()->subHour()->toDateTimeString()),
            ],
            'action_required' => [
                $this->createRefundOrder('legacy-failed', 'refund_failed', $this->guest),
                $this->createRefundOrder('canonical-failed', 'refund_pending', $this->guest, 'missing', 'failed'),
                $this->createRefundOrder('stale-canonical-progress', 'refund_pending', $this->guest, 'valid', 'in_progress', now()->subHours(24)->toDateTimeString()),
                $canonicalStaleFallback,
                $this->createRefundOrder('stale-legacy-progress', 'refund_in_progress', $this->guest, 'valid', null, now()->subHours(24)->toDateTimeString()),
                $this->createRefundOrder('unstamped-legacy-progress', 'refund_in_progress', $this->guest),
            ],
            'completed' => [$this->createRefundOrder('completed', 'refund_pending', $this->guest, 'valid', 'completed')],
            'rejected' => [$this->createRefundOrder('rejected', 'refund_rejected', $this->guest)],
            'needs_review' => [$this->createRefundOrder('needs-review', 'refund_pending', $this->guest, 'missing', 'needs_review')],
        ];
        $unclassified = $this->createRefundOrder('ordinary-payment-failure', 'failed', $this->guest);
        $service = app(RefundPayloadService::class);
        $seenIds = [];

        foreach ($ordersByQueue as $queue => $orders) {
            foreach ($orders as $order) {
                $this->assertSame($queue, $service->queueState($order));
            }

            $response = $this->actingAs($this->owner)
                ->get("/owner/finance?tab=refund&filter={$queue}")
                ->assertOk();
            $expectedIds = array_map(static fn (Order $order): int => $order->id, $orders);
            $actualRows = $response->inertiaProps('refunds.data');
            $actualIds = array_column($actualRows, 'order_id');
            sort($expectedIds);
            sort($actualIds);

            $this->assertSame(
                $expectedIds,
                $actualIds,
                "Unexpected order selection for {$queue}.",
            );
            $this->assertSame(count($orders), $response->inertiaProps("refundCounts.{$queue}"));
            $this->assertSame(
                array_fill(0, count($orders), $queue),
                array_column($actualRows, 'queue_state'),
            );
            $seenIds = array_merge($seenIds, $actualIds);
        }

        $allRefundIds = array_map(
            static fn (Order $order): int => $order->id,
            array_merge(...array_values($ordersByQueue)),
        );
        $this->assertCount(count($allRefundIds), array_unique($seenIds));
        $this->assertNotContains($unclassified->id, $seenIds);
    }

    public function test_refund_queue_pagination_preserves_filter_and_counts(): void
    {
        $awaitingGuestOrders = [];
        for ($i = 0; $i < 21; $i++) {
            $awaitingGuestOrders[] = Order::factory()->create([
                'customer_id' => $this->guest->id,
                'payment_status' => 'refund_pending',
                'refund_destination_status' => 'missing',
                'refund_amount' => 50000,
                'refund_requested_at' => now(),
            ]);
        }
        $registered = Customer::factory()->create([
            'user_id' => User::factory()->create(['role' => 'customer'])->id,
        ]);
        $this->createRefundOrder('pagination-ready', 'refund_pending', $this->guest, 'valid');
        $this->createRefundOrder('pagination-awaiting-customer', 'refund_pending', $registered);
        $this->createRefundOrder('pagination-stale', 'refund_in_progress', $this->guest, 'valid', null, now()->subDay()->toDateTimeString());

        $firstPage = $this->actingAs($this->owner)
            ->get('/owner/finance?tab=refund&filter=awaiting_guest&page=1')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('tab', 'refund')
                ->where('refundFilter', 'awaiting_guest')
                ->where('refunds.current_page', 1)
                ->where('refunds.last_page', 2)
                ->where('refunds.total', 21)
                ->has('refunds.data', 20)
                ->where('refundCounts.awaiting_guest', 21)
            );
        $secondPage = $this->get('/owner/finance?tab=refund&filter=awaiting_guest&page=2')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('tab', 'refund')
                ->where('refundFilter', 'awaiting_guest')
                ->where('refunds.current_page', 2)
                ->where('refunds.last_page', 2)
                ->where('refunds.total', 21)
                ->has('refunds.data', 1)
                ->where('refundCounts.awaiting_guest', 21)
            );

        $pageOneIds = array_column($firstPage->inertiaProps('refunds.data'), 'order_id');
        $pageOneRows = $firstPage->inertiaProps('refunds.data');
        $pageTwoRows = $secondPage->inertiaProps('refunds.data');
        $pageTwoIds = array_column($pageTwoRows, 'order_id');
        $expectedIds = array_map(static fn (Order $order): int => $order->id, $awaitingGuestOrders);
        $this->assertSame(array_fill(0, 20, 'awaiting_guest'), array_column($pageOneRows, 'queue_state'));
        $this->assertSame(['awaiting_guest'], array_values(array_unique(array_column($pageTwoRows, 'queue_state'))));
        $this->assertSame([], array_intersect($pageOneIds, $pageTwoIds));
        $paginatedIds = array_merge($pageOneIds, $pageTwoIds);
        sort($expectedIds);
        sort($paginatedIds);
        $this->assertSame($expectedIds, $paginatedIds);

        foreach ($firstPage->inertiaProps('refunds.links') as $link) {
            if ($link['url'] === null) {
                continue;
            }

            parse_str((string) parse_url($link['url'], PHP_URL_QUERY), $query);
            $this->assertSame('refund', $query['tab'] ?? null);
            $this->assertSame('awaiting_guest', $query['filter'] ?? null);
            $this->assertContains((int) ($query['page'] ?? 0), [1, 2]);
        }
    }

    private function createRefundOrder(
        string $code,
        string $paymentStatus,
        ?Customer $customer,
        string $destinationStatus = 'missing',
        ?string $obligationStatus = null,
        ?string $startedAt = null,
    ): Order {
        $order = Order::factory()->paid()->create([
            'customer_id' => $customer?->id,
            'order_code' => "REFUND-{$code}",
            'payment_status' => $paymentStatus,
            'refund_destination_status' => $destinationStatus,
            'refund_reason' => 'customer_cancellation',
            'refund_amount' => 50000,
            'refund_requested_at' => now(),
            'refund_started_at' => $startedAt,
        ]);

        if ($obligationStatus !== null) {
            $key = "refund-workspace-{$code}";
            $attempt = PaymentAttempt::create([
                'order_id' => $order->id,
                'attempt_key' => $key,
                'invoice_number' => $key,
                'merchant_request_id' => $key,
                'amount_snapshot' => 50000,
                'currency_snapshot' => 'IDR',
            ]);
            RefundObligation::create([
                'payment_attempt_id' => $attempt->id,
                'amount' => 50000,
                'currency' => 'IDR',
                'reason' => 'customer_cancellation',
                'status' => $obligationStatus,
                'destination_type' => $destinationStatus === 'valid' ? 'bank' : null,
                'requested_at' => now(),
                'started_at' => $startedAt,
            ]);
        }

        return $order;
    }
}
