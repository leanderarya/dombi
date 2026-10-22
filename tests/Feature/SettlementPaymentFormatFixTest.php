<?php

namespace Tests\Feature;

use App\Models\OfflineSale;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Outlet;
use App\Models\Product;
use App\Models\Settlement;
use App\Models\SettlementPayment;
use App\Models\SettlementReconciliationIssue;
use App\Models\User;
use App\Services\SettlementGeneratorService;
use App\Services\SettlementPaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class SettlementPaymentFormatFixTest extends TestCase
{
    use RefreshDatabase;

    public function test_regeneration_preserves_settlement_direction_after_payment_allocation(): void
    {
        $outlet = Outlet::factory()->create(['status' => 'active']);
        $user = User::factory()->create(['role' => 'owner']);
        $product = Product::factory()->create();
        $date = now()->startOfWeek()->addDays(2);

        $sale = OfflineSale::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'quantity' => 1,
            'center_price' => 50,
            'selling_price_snapshot' => 100,
            'gross_amount' => 100,
            'total_amount' => 50,
            'payment_method' => 'cash',
            'created_by' => $user->id,
        ]);
        $sale->created_at = $date;
        $sale->save();

        $generator = app(SettlementGeneratorService::class);
        $settlement = $generator->generateForOutlet($outlet, $date);
        $this->assertSame(Settlement::DIRECTION_OUTLET_PAYS, $settlement->direction);
        $this->assertSame(50.0, (float) $settlement->amount_due);

        $payment = SettlementPayment::create([
            'outlet_id' => $outlet->id,
            'settlement_id' => $settlement->id,
            'direction' => Settlement::DIRECTION_OUTLET_PAYS,
            'reference_number' => 'P2-'.uniqid(),
            'payment_date' => $date->toDateString(),
            'amount' => 50,
            'payment_method' => 'transfer_bank',
            'status' => SettlementPayment::STATUS_VERIFIED,
            'verified_by' => $user->id,
            'verified_at' => now(),
        ]);
        app(SettlementPaymentService::class)->fifoAllocate(
            $outlet->id,
            50,
            $payment->id,
            Settlement::DIRECTION_OUTLET_PAYS,
        );

        $order = Order::create([
            'order_code' => 'P2-'.uniqid(),
            'customer_name' => 'Test Customer',
            'customer_phone' => '08123456789',
            'customer_address' => 'Test Address',
            'outlet_id' => $outlet->id,
            'status' => Order::STATUS_COMPLETED,
            'fulfillment_type' => Order::FULFILLMENT_PICKUP,
            'payment_status' => 'paid',
            'subtotal' => 300,
            'delivery_fee' => 0,
            'payment_fee' => 0,
            'total' => 300,
            'completed_at' => $date,
        ]);
        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_name' => $product->name,
            'quantity' => 1,
            'price' => 300,
            'subtotal' => 300,
            'center_price_snapshot' => 100,
            'selling_price_snapshot' => 300,
            'outlet_margin_snapshot' => 200,
        ]);

        $allocation = $payment->allocations()->firstOrFail();
        $recalculated = $generator->generateForOutlet($outlet, $date);

        $this->assertSame(50.0, (float) $recalculated->amount_due);
        $this->assertSame(-50.0, (float) $recalculated->net_amount);
        $this->assertSame(Settlement::DIRECTION_OUTLET_PAYS, $recalculated->direction);
        $this->assertSame(50.0, (float) $recalculated->paid_amount);
        $this->assertSame(Settlement::STATUS_PAID, $recalculated->status);
        $this->assertSame(Settlement::DIRECTION_OUTLET_PAYS, $payment->fresh()->direction);
        $this->assertSame($allocation->id, $payment->allocations()->firstOrFail()->id);
        $this->assertSame(50.0, (float) $payment->allocations()->sum('allocated_amount'));
        $this->assertDatabaseHas('settlement_reconciliation_issues', [
            'settlement_id' => $settlement->id,
            'status' => 'open',
        ]);
        $issue = DB::table('settlement_reconciliation_issues')->where('settlement_id', $settlement->id)->first();
        $this->assertSame(150.0, (float) json_decode($issue->source_snapshot, true)['net_amount']);
        $this->assertSame(-50.0, (float) json_decode($issue->settlement_snapshot, true)['net_amount']);
        $this->assertSame(1, DB::table('settlement_reconciliation_issues')->where('settlement_id', $settlement->id)->count());
    }

    public function test_uploaded_outlet_transfer_proof_survives_issue_blocked_verification(): void
    {
        Storage::fake('public');
        $outlet = Outlet::factory()->create(['status' => 'active']);
        $outletUser = User::factory()->create(['role' => 'outlet', 'outlet_id' => $outlet->id, 'is_active' => true]);
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true, 'must_change_password' => false]);
        $product = Product::factory()->create();
        $date = now()->startOfWeek()->addDays(2);
        $sale = OfflineSale::create([
            'outlet_id' => $outlet->id,
            'product_id' => $product->id,
            'quantity' => 1,
            'center_price' => 50000,
            'selling_price_snapshot' => 70000,
            'gross_amount' => 70000,
            'total_amount' => 50000,
            'payment_method' => 'cash',
            'created_by' => $outletUser->id,
        ]);
        $sale->created_at = $date;
        $sale->save();
        $generator = app(SettlementGeneratorService::class);
        $settlement = $generator->generateForOutlet($outlet, $date);
        $this->assertSame(-50000.0, (float) $settlement->net_amount);
        $originalSnapshot = $settlement->only([
            'sales_amount', 'delivery_fee_amount', 'amount_due', 'total_online_share',
            'total_delivery_cost', 'total_refund', 'total_offline_sales', 'net_amount',
            'direction', 'adjustment_amount', 'status', 'paid_amount',
        ]);
        $proof = UploadedFile::fake()->image('transfer-proof.jpg');

        $response = $this->actingAs($outletUser)->post('/outlet/settlement-payments', [
            'amount' => 10000,
            'reference_number' => 'TRF-ISSUE-'.uniqid(),
            'payment_date' => now()->toDateString(),
            'notes' => 'Uploaded receipt remains attached',
            'proof_image' => $proof,
        ]);

        $response->assertRedirect()->assertSessionHas('success');
        $payment = SettlementPayment::where('outlet_id', $outlet->id)->firstOrFail();
        $receiptPath = $payment->proof_image;
        $this->assertNotEmpty($receiptPath);
        Storage::disk('public')->assertExists($receiptPath);
        $this->assertSame(SettlementPayment::STATUS_PENDING, $payment->status);
        $this->assertSame($settlement->id, $payment->settlement_id);

        $sale->update(['quantity' => 2, 'total_amount' => 100000, 'gross_amount' => 140000]);
        $generator->recalculateForWeek($outlet, $date);
        $this->assertDatabaseHas('settlement_reconciliation_issues', [
            'settlement_id' => $settlement->id,
            'status' => 'open',
        ]);

        try {
            app(SettlementPaymentService::class)->verifyPayment($payment->fresh(), $owner);
            $this->fail('Open issue must prevent verification.');
        } catch (ValidationException) {
            $payment->refresh();
            $settlement->refresh();
            $this->assertSame(SettlementPayment::STATUS_PENDING, $payment->status);
            $this->assertSame($receiptPath, $payment->proof_image);
            Storage::disk('public')->assertExists($receiptPath);
            $this->assertSame($originalSnapshot, $settlement->only(array_keys($originalSnapshot)));
            $this->assertSame(0, $payment->allocations()->count());
            $this->assertSame(1, DB::table('settlement_reconciliation_issues')
                ->where('settlement_id', $settlement->id)->where('status', 'open')->count());
        }

        $sale->update(['quantity' => 1, 'total_amount' => 50000, 'gross_amount' => 70000]);
        $generator->recalculateForWeek($outlet, $date);
        $this->assertSame(1, DB::table('settlement_reconciliation_issues')
            ->where('settlement_id', $settlement->id)->where('status', 'resolved')->count());
        app(SettlementPaymentService::class)->verifyPayment($payment->fresh(), $owner);
        $payment->refresh();
        $settlement->refresh();
        $this->assertSame(SettlementPayment::STATUS_VERIFIED, $payment->status);
        $this->assertSame($receiptPath, $payment->proof_image);
        Storage::disk('public')->assertExists($receiptPath);
        $this->assertSame(10000.0, (float) $settlement->paid_amount);
        $this->assertSame(1, $payment->allocations()->count());
    }

    public function test_open_issue_aborts_entire_bulk_verification(): void
    {
        $outlet = Outlet::factory()->create(['status' => 'active']);
        $owner = User::factory()->create(['role' => 'owner']);
        $healthy = Settlement::factory()->create([
            'outlet_id' => $outlet->id, 'period_type' => 'weekly', 'net_amount' => -30000,
            'amount_due' => 30000, 'direction' => Settlement::DIRECTION_OUTLET_PAYS,
            'status' => Settlement::STATUS_GENERATED, 'paid_amount' => 0,
        ]);
        $blocked = Settlement::factory()->create([
            'outlet_id' => $outlet->id, 'period_date' => now()->subDays(14)->toDateString(),
            'period_type' => 'weekly', 'period_start' => now()->addWeek()->toDateString(),
            'net_amount' => -30000, 'amount_due' => 30000, 'direction' => Settlement::DIRECTION_OUTLET_PAYS,
            'status' => Settlement::STATUS_GENERATED, 'paid_amount' => 0,
        ]);
        $payments = collect([$healthy, $blocked])->map(fn (Settlement $settlement, int $index) => SettlementPayment::factory()->create([
            'outlet_id' => $outlet->id, 'settlement_id' => $settlement->id,
            'direction' => Settlement::DIRECTION_OUTLET_PAYS, 'status' => SettlementPayment::STATUS_PENDING,
            'amount' => 10000, 'reference_number' => 'BULK-ISSUE-'.$index.'-'.uniqid(),
        ]));
        SettlementReconciliationIssue::create([
            'settlement_id' => $blocked->id, 'status' => 'open',
            'settlement_snapshot' => ['net_amount' => -30000], 'source_snapshot' => ['net_amount' => -29000], 'detected_at' => now(),
        ]);

        try {
            app(SettlementPaymentService::class)->bulkVerifyPayments($payments->pluck('id')->all(), $owner);
            $this->fail('Bulk verification must fail atomically when one path has an open issue.');
        } catch (ValidationException) {
            $this->assertSame(2, SettlementPayment::whereIn('id', $payments->pluck('id'))->where('status', SettlementPayment::STATUS_PENDING)->count());
            $this->assertSame(0, DB::table('settlement_payment_allocations')->whereIn('settlement_payment_id', $payments->pluck('id'))->count());
            $this->assertSame(0.0, (float) $healthy->fresh()->paid_amount);
            $this->assertSame(0.0, (float) $blocked->fresh()->paid_amount);
        }
    }

    public function test_open_issue_blocks_owner_payout_without_creating_verified_payment(): void
    {
        $outlet = Outlet::factory()->create(['status' => 'active']);
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true, 'must_change_password' => false]);
        $healthy = Settlement::factory()->create([
            'outlet_id' => $outlet->id, 'period_date' => now()->subDays(14)->toDateString(),
            'period_start' => now()->subWeeks(2)->startOfWeek()->toDateString(),
            'period_type' => 'weekly', 'net_amount' => 10000, 'amount_due' => 10000,
            'direction' => Settlement::DIRECTION_OWNER_PAYS, 'status' => Settlement::STATUS_GENERATED, 'paid_amount' => 0,
        ]);
        $settlement = Settlement::factory()->create([
            'outlet_id' => $outlet->id, 'period_type' => 'weekly', 'net_amount' => 50000,
            'amount_due' => 50000, 'direction' => Settlement::DIRECTION_OWNER_PAYS,
            'status' => Settlement::STATUS_GENERATED, 'paid_amount' => 0,
        ]);
        SettlementReconciliationIssue::create([
            'settlement_id' => $settlement->id, 'status' => 'open',
            'settlement_snapshot' => ['net_amount' => 50000], 'source_snapshot' => ['net_amount' => 49000], 'detected_at' => now(),
        ]);

        $this->actingAs($owner)->post("/owner/finance/settlements/{$outlet->id}/payout", [
            'amount' => 5000, 'reference_number' => 'HEALTHY-PAYOUT-'.uniqid(),
        ])->assertRedirect()->assertSessionHas('success');
        $this->actingAs($owner)->post("/owner/finance/settlements/{$outlet->id}/payout", [
            'amount' => 10000, 'reference_number' => 'BLOCKED-PAYOUT-'.uniqid(),
        ])->assertRedirect()->assertSessionHas('error');

        $this->assertSame(1, SettlementPayment::where('outlet_id', $outlet->id)->count());
        $this->assertSame(5000.0, (float) $healthy->fresh()->paid_amount);
        $this->assertSame(0.0, (float) $settlement->fresh()->paid_amount);
        $this->assertSame(1, DB::table('settlement_payment_allocations')->count());
        $this->assertSame(1, DB::table('settlement_payment_allocations')->where('settlement_id', $healthy->id)->count());
        $this->assertSame(0, DB::table('settlement_payment_allocations')->where('settlement_id', $settlement->id)->count());
    }

    public function test_open_issue_blocks_owner_direct_payment_without_creating_verified_record(): void
    {
        Storage::fake('public');
        $outlet = Outlet::factory()->create(['status' => 'active']);
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true, 'must_change_password' => false]);
        $settlement = Settlement::factory()->create([
            'outlet_id' => $outlet->id,
            'net_amount' => -20000,
            'amount_due' => 20000,
            'direction' => Settlement::DIRECTION_OUTLET_PAYS,
            'status' => Settlement::STATUS_GENERATED,
            'paid_amount' => 0,
        ]);
        SettlementReconciliationIssue::create([
            'settlement_id' => $settlement->id,
            'status' => 'open',
            'settlement_snapshot' => ['net_amount' => -20000],
            'source_snapshot' => ['net_amount' => -19000],
            'detected_at' => now(),
        ]);

        $this->actingAs($owner)->post("/owner/finance/settlements/{$outlet->id}/payments", [
            'amount' => 10000,
            'payment_method' => 'transfer_bank',
            'reference_number' => 'OWNER-DIRECT-BLOCKED-'.uniqid(),
            'proof_image' => UploadedFile::fake()->image('owner-transfer.jpg'),
        ])->assertRedirect()->assertSessionHas('error');
        $this->assertSame([], Storage::disk('public')->allFiles('payment-proofs'));

        $this->assertSame(0, SettlementPayment::where('outlet_id', $outlet->id)->count());
        $this->assertSame(0.0, (float) $settlement->fresh()->paid_amount);
        $this->assertSame(Settlement::STATUS_GENERATED, $settlement->fresh()->status);
        $this->assertSame(0, DB::table('settlement_payment_allocations')->count());
        $this->assertSame(1, DB::table('settlement_reconciliation_issues')
            ->where('settlement_id', $settlement->id)->where('status', 'open')->count());
    }

    public function test_owner_direct_payment_respects_fifo_issue_boundary_without_skipping(): void
    {
        $outlet = Outlet::factory()->create(['status' => 'active']);
        $owner = User::factory()->create(['role' => 'owner', 'is_active' => true, 'must_change_password' => false]);
        $makeSettlement = function (int $weeksAgo, string $direction, float $net) use ($outlet): Settlement {
            $start = now()->startOfWeek()->subWeeks($weeksAgo);

            return Settlement::factory()->create([
                'outlet_id' => $outlet->id,
                'period_date' => $start->toDateString(),
                'period_start' => $start->toDateString(),
                'period_end' => $start->copy()->endOfWeek()->toDateString(),
                'period_type' => 'weekly',
                'net_amount' => $net,
                'amount_due' => abs($net),
                'direction' => $direction,
                'status' => Settlement::STATUS_GENERATED,
                'paid_amount' => 0,
                'adjustment_amount' => 0,
            ]);
        };
        $healthyFirst = $makeSettlement(3, Settlement::DIRECTION_OUTLET_PAYS, -10000);
        $blockedMiddle = $makeSettlement(2, Settlement::DIRECTION_OUTLET_PAYS, -10000);
        $healthyLast = $makeSettlement(1, Settlement::DIRECTION_OUTLET_PAYS, -10000);
        $unrelatedDirection = $makeSettlement(4, Settlement::DIRECTION_OWNER_PAYS, 10000);
        SettlementReconciliationIssue::create([
            'settlement_id' => $blockedMiddle->id,
            'status' => 'open',
            'settlement_snapshot' => ['net_amount' => -10000],
            'source_snapshot' => ['net_amount' => -9000],
            'detected_at' => now(),
        ]);

        $this->actingAs($owner)->post("/owner/finance/settlements/{$outlet->id}/payments", [
            'amount' => 10000,
            'payment_method' => 'transfer_bank',
            'reference_number' => 'OWNER-FIFO-HEALTHY-'.uniqid(),
        ])->assertRedirect()->assertSessionHas('success');

        $firstPayment = SettlementPayment::where('outlet_id', $outlet->id)->firstOrFail();
        $this->assertSame(SettlementPayment::STATUS_VERIFIED, $firstPayment->status);
        $this->assertSame(1, $firstPayment->allocations()->count());
        $this->assertSame($healthyFirst->id, $firstPayment->allocations()->firstOrFail()->settlement_id);

        $this->actingAs($owner)->post("/owner/finance/settlements/{$outlet->id}/payments", [
            'amount' => 15000,
            'payment_method' => 'transfer_bank',
            'reference_number' => 'OWNER-FIFO-BLOCKED-'.uniqid(),
        ])->assertRedirect()->assertSessionHas('error');

        $payoutResponse = $this->actingAs($owner)->post("/owner/finance/settlements/{$outlet->id}/payout", [
            'amount' => 5000,
            'reference_number' => 'OWNER-PAYOUT-HEALTHY-'.uniqid(),
        ]);
        $payoutResponse->assertRedirect()->assertSessionHas('success');

        $payments = SettlementPayment::where('outlet_id', $outlet->id)->get();
        $this->assertCount(2, $payments);
        $this->assertSame(10000.0, (float) $healthyFirst->fresh()->paid_amount);
        $this->assertSame(Settlement::STATUS_PAID, $healthyFirst->fresh()->status);
        $this->assertSame(0.0, (float) $blockedMiddle->fresh()->paid_amount);
        $this->assertSame(Settlement::STATUS_GENERATED, $blockedMiddle->fresh()->status);
        $this->assertSame(0.0, (float) $healthyLast->fresh()->paid_amount);
        $this->assertSame(Settlement::STATUS_GENERATED, $healthyLast->fresh()->status);
        $this->assertSame(5000.0, (float) $unrelatedDirection->fresh()->paid_amount);
        $this->assertSame(Settlement::STATUS_PARTIAL, $unrelatedDirection->fresh()->status);
        $this->assertSame(0, DB::table('settlement_payment_allocations as allocations')
            ->join('settlement_payments as payments', 'payments.id', '=', 'allocations.settlement_payment_id')
            ->join('settlements', 'settlements.id', '=', 'allocations.settlement_id')
            ->whereColumn('payments.direction', '!=', 'settlements.direction')
            ->count());
        $this->assertSame(0, SettlementPayment::where('reference_number', 'like', 'OWNER-FIFO-BLOCKED-%')->count());
        $this->assertSame(1, DB::table('settlement_payment_allocations')->where('settlement_id', $healthyFirst->id)->count());
        $this->assertSame(0, DB::table('settlement_payment_allocations')->whereIn('settlement_id', [$blockedMiddle->id, $healthyLast->id])->count());
        $this->assertSame(1, DB::table('settlement_payment_allocations')->where('settlement_id', $unrelatedDirection->id)->count());
    }

    public function test_settlement_payment_accepts_large_amount(): void
    {
        $user = User::factory()->create(['role' => 'outlet']);
        $outlet = Outlet::factory()->create(['status' => 'active']);
        $user->update(['outlet_id' => $outlet->id]);

        Settlement::factory()->create([
            'outlet_id' => $outlet->id,
            'amount_due' => 500000,
            'net_amount' => -500000,
            'direction' => Settlement::DIRECTION_OUTLET_PAYS,
            'paid_amount' => 0,
            'status' => Settlement::STATUS_GENERATED,
            'period_type' => 'weekly',
            'period_start' => now()->subWeek()->toDateString(),
            'period_end' => now()->toDateString(),
        ]);

        $response = $this->actingAs($user)->post('/outlet/settlement-payments', [
            'amount' => 323000,
            'reference_number' => 'TRF-'.uniqid(),
            'payment_date' => now()->toDateString(),
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('settlement_payments', [
            'outlet_id' => $outlet->id,
            'amount' => 323000,
        ]);
    }
}
