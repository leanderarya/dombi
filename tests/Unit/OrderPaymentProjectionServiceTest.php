<?php

namespace Tests\Unit;

use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Services\OrderPaymentProjectionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderPaymentProjectionServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_projects_aggregate_payment_status_by_precedence(): void
    {
        $cases = [
            [['failed'], 'failed'],
            [['failed', 'pending'], 'pending'],
            [['expired', 'pending'], 'pending'],
            [['paid', 'failed'], 'paid'],
            [['paid_mismatch'], 'paid'],
            [['paid', 'paid'], 'paid'],
            [[], 'failed'],
            [['expired'], 'expired'],
        ];

        foreach ($cases as [$attempts, $expected]) {
            $order = Order::factory()->create(['total' => 50000]);
            foreach ($attempts as $status) {
                $attributes = [
                    'order_id' => $order->id,
                    'attempt_key' => fake()->unique()->uuid(),
                    'invoice_number' => fake()->unique()->uuid(),
                    'merchant_request_id' => fake()->unique()->uuid(),
                    'amount_snapshot' => $status === 'paid_mismatch' ? 49000 : 50000,
                    'currency_snapshot' => 'IDR',
                    'creation_state' => 'created',
                    'settlement_status' => $status === 'paid_mismatch' ? 'paid' : $status,
                    'verification_status' => in_array($status, ['paid', 'paid_mismatch'], true) ? 'verified' : 'needs_review',
                ];
                PaymentAttempt::create($attributes);
            }

            $this->assertSame($expected, app(OrderPaymentProjectionService::class)->recompute($order));
        }
    }

    public function test_paid_mismatch_remains_paid_but_cannot_fulfil(): void
    {
        $order = Order::factory()->create(['total' => 50000]);
        PaymentAttempt::create([
            'order_id' => $order->id, 'attempt_key' => fake()->uuid(), 'invoice_number' => fake()->uuid(),
            'merchant_request_id' => fake()->uuid(), 'amount_snapshot' => 49000, 'currency_snapshot' => 'IDR',
            'creation_state' => 'created', 'settlement_status' => 'paid', 'verification_status' => 'verified',
        ]);

        app(OrderPaymentProjectionService::class)->recompute($order);

        $this->assertSame('paid', $order->fresh()->payment_status);
        $this->assertFalse($order->fresh()->paymentIsFulfilmentEligible());
    }
}
