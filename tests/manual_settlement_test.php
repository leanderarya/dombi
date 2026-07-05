<?php
/**
 * End-to-End Settlement Hardening Test
 * Run: php artisan tinker --execute="require base_path('tests/manual_settlement_test.php');"
 */
use App\Models\{User, Outlet, ProductVariant, OutletInventory, Order, OrderItem, Settlement, SettlementPayment, OfflineSale, OutletPayable, StockMovement};
use App\Services\{OrderStatusService, SettlementGeneratorService, SettlementPaymentService, SettlementReconciliationService};
use Illuminate\Support\Facades\{DB, Auth};

$pass = 0;
$fail = 0;

function ok(string $label, bool $condition, string $detail = ''): void {
    global $pass, $fail;
    if ($condition) { $pass++; echo "  [PASS] $label\n"; }
    else { $fail++; echo "  [FAIL] $label $detail\n"; }
}

echo "========================================\n";
echo "END-TO-END SETTLEMENT HARDENING TEST\n";
echo "========================================\n\n";

$outlet = Outlet::find(1);
$variant = ProductVariant::find(1);
$outletUser = User::where('role', 'outlet')->first();
$owner = User::where('role', 'owner')->first();
$centerPrice = (float) $variant->center_price;
$sellingPrice = (float) $variant->selling_price;
$qty = 3;
$expectedCenterShare = $centerPrice * $qty;

$inv = OutletInventory::where('outlet_id', 1)->where('product_variant_id', 1)->first();
$stockBefore = $inv->current_stock;

// ══════════════════════════════════════════
// STEP 1: Create order
// ══════════════════════════════════════════
echo "STEP 1: Create Order (customer checkout)\n";
Auth::login(User::find(1));

$order = Order::create([
    'order_code' => 'TEST-' . time(),
    'customer_name' => 'Test Customer',
    'customer_phone' => '08123456789',
    'customer_address' => 'Test Address, Semarang',
    'customer_id' => null,
    'outlet_id' => 1,
    'status' => 'pending_confirmation',
    'fulfillment_type' => 'pickup',
    'payment_method' => 'cod',
    'subtotal' => $sellingPrice * $qty,
    'delivery_fee' => 0,
    'total' => $sellingPrice * $qty,
]);

OrderItem::create([
    'order_id' => $order->id,
    'product_variant_id' => 1,
    'product_name' => $variant->family->name . ' - ' . $variant->name,
    'quantity' => $qty,
    'price' => $sellingPrice,
    'subtotal' => $sellingPrice * $qty,
    'center_price_snapshot' => $centerPrice,
    'selling_price_snapshot' => $sellingPrice,
    'outlet_margin_snapshot' => $sellingPrice - $centerPrice,
]);

$inv->reserved_stock += $qty;
$inv->save();

ok("Order created", $order->exists, "#{$order->id}");
echo "  {$qty}x {$variant->name} @ Rp {$sellingPrice} | center_share expected: Rp {$expectedCenterShare}\n";

// ══════════════════════════════════════════
// STEP 2: Outlet completes order → triggers settlement
// ══════════════════════════════════════════
echo "\nSTEP 2: Outlet completes order\n";
Auth::login($outletUser);

$orderService = app(OrderStatusService::class);
$order = $orderService->updateStatus($order, 'confirmed', $outletUser);
$order = $orderService->updateStatus($order, 'preparing', $outletUser);
$order = $orderService->updateStatus($order, 'ready_for_pickup', $outletUser);
$order = $orderService->completePickup($order, $outletUser);

ok("Order completed", $order->status === 'completed');

// OutletPayable
$payable = OutletPayable::where('order_id', $order->id)->where('type', 'sale')->first();
ok("OutletPayable created", $payable !== null);
if ($payable) {
    ok("OutletPayable center_price correct", (float) $payable->center_share === $expectedCenterShare,
       "got {$payable->center_share}");
}

// Settlement
$weekStart = now()->startOfWeek(\Carbon\Carbon::MONDAY)->toDateString();
$settlement = Settlement::where('outlet_id', 1)
    ->where('period_type', 'weekly')
    ->where('period_start', $weekStart)
    ->first();

ok("Settlement generated", $settlement !== null);
if ($settlement) {
    echo "  Settlement #{$settlement->id}: amount_due={$settlement->amount_due}, sales={$settlement->sales_amount}, delivery_fee={$settlement->delivery_fee_amount}\n";
    ok("Settlement amount_due >= order center_share", (float) $settlement->amount_due >= $expectedCenterShare,
       "amount_due={$settlement->amount_due}");
    ok("Settlement status is generated/pending", !in_array($settlement->status, ['paid']),
       "status={$settlement->status}");
}

// Stock
$inv = $inv->fresh();
ok("Stock decremented", $inv->current_stock === $stockBefore - $qty,
   "expected " . ($stockBefore - $qty) . " got {$inv->current_stock}");
ok("Reserved stock cleared", $inv->reserved_stock === 0,
   "reserved={$inv->reserved_stock}");

// ══════════════════════════════════════════
// STEP 3: Offline sale → included in settlement
// ══════════════════════════════════════════
echo "\nSTEP 3: Offline sale\n";
Auth::login($outletUser);

$offlineQty = 2;
$offlineCenter = $centerPrice * $offlineQty;
$beforeOfflineStock = $inv->current_stock;

DB::transaction(function () use ($outlet, $variant, $offlineQty, $centerPrice, $inv, $outletUser, $beforeOfflineStock) {
    $inv->decrement('current_stock', $offlineQty);

    OfflineSale::create([
        'outlet_id' => 1,
        'product_variant_id' => $variant->id,
        'quantity' => $offlineQty,
        'center_price' => $centerPrice,
        'total_amount' => $centerPrice * $offlineQty,
        'notes' => 'Test offline sale',
        'created_by' => $outletUser->id,
    ]);

    StockMovement::create([
        'outlet_id' => 1,
        'product_id' => $variant->product_id,
        'product_variant_id' => $variant->id,
        'type' => 'offline_sale',
        'quantity' => -$offlineQty,
        'before_stock' => $beforeOfflineStock,
        'after_stock' => $beforeOfflineStock - $offlineQty,
        'notes' => 'Test offline sale',
        'created_by' => $outletUser->id,
    ]);

    OutletPayable::create([
        'outlet_id' => 1,
        'type' => 'sale',
        'amount' => $centerPrice * $offlineQty,
        'center_share' => $centerPrice * $offlineQty,
        'outlet_margin' => 0,
        'due_date' => now()->endOfWeek(\Carbon\Carbon::SUNDAY)->addDays(7)->toDateString(),
        'paid_amount' => 0,
        'remaining_amount' => $centerPrice * $offlineQty,
        'notes' => "Test offline sale: {$offlineQty}x {$variant->name}",
        'created_by' => $outletUser->id,
    ]);

    app(SettlementGeneratorService::class)->generateForOutlet($outlet, now());
});

$settlement = $settlement->fresh();
$expectedTotal = $expectedCenterShare + $offlineCenter;
echo "  Offline sale: {$offlineQty}x @ Rp {$centerPrice} = Rp {$offlineCenter}\n";
echo "  Settlement amount_due: {$settlement->amount_due} (expected >= {$expectedTotal})\n";
ok("Settlement includes offline sale", (float) $settlement->amount_due >= $expectedTotal,
   "got {$settlement->amount_due}");

// ══════════════════════════════════════════
// STEP 4: Outlet submits payment (pending)
// ══════════════════════════════════════════
echo "\nSTEP 4: Outlet submits payment\n";
Auth::login($outletUser);

$outstandingBefore = max(0, (float) $settlement->amount_due - (float) $settlement->paid_amount);
echo "  Outstanding: Rp " . number_format($outstandingBefore) . "\n";

$payment = SettlementPayment::create([
    'outlet_id' => 1,
    'settlement_id' => $settlement->id,
    'reference_number' => 'TEST-PAY-' . time(),
    'payment_date' => now()->toDateString(),
    'amount' => $outstandingBefore,
    'status' => SettlementPayment::STATUS_PENDING,
]);

ok("Payment submitted (pending)", $payment->status === 'pending_verification');

// ══════════════════════════════════════════
// STEP 5: Owner verifies (FIFO allocate)
// ══════════════════════════════════════════
echo "\nSTEP 5: Owner verifies payment (FIFO)\n";
Auth::login($owner);

$paymentService = app(SettlementPaymentService::class);
$paymentService->verifyPayment($payment, $owner);

$payment = $payment->fresh();
ok("Payment verified", $payment->status === 'verified');

$settlement = $settlement->fresh();
$settlementOutstanding = max(0, (float) $settlement->amount_due - (float) $settlement->paid_amount);
echo "  Settlement #{$settlement->id}: paid={$settlement->paid_amount}, outstanding=" . number_format($settlementOutstanding) . "\n";
ok("Settlement paid_amount updated", (float) $settlement->paid_amount > 0);
ok("Settlement outstanding = 0", $settlementOutstanding <= 0, "got {$settlementOutstanding}");
ok("Settlement status = paid", $settlement->status === 'paid', "got {$settlement->status}");

// ══════════════════════════════════════════
// STEP 6: Reconciliation check
// ══════════════════════════════════════════
echo "\nSTEP 6: Reconciliation (owner view)\n";
Auth::login($owner);

$recService = app(SettlementReconciliationService::class);
$rec = $recService->getOutletReconciliation(1);

echo "  center_share: Rp " . number_format($rec['center_share']) . "\n";
echo "  verified_payments: Rp " . number_format($rec['verified_payments']) . "\n";
echo "  outstanding: Rp " . number_format($rec['outstanding']) . "\n";
ok("Reconciliation outstanding = 0", $rec['outstanding'] <= 0, "got {$rec['outstanding']}");

// Overdue check
$overdue = $recService->getOverdueOutlets();
ok("No overdue outlets", count($overdue) === 0, "count=" . count($overdue));

// ══════════════════════════════════════════
// STEP 7: Verify no overpayment residue
// ══════════════════════════════════════════
echo "\nSTEP 7: Overpayment check\n";
$overpaidSettlements = Settlement::where('outlet_id', 1)
    ->where('period_type', 'weekly')
    ->where('overpaid_amount', '>', 0)
    ->count();
ok("No overpaid settlements", $overpaidSettlements === 0, "count={$overpaidSettlements}");

// All settlements for outlet 1
echo "\nAll settlements for outlet 1:\n";
Settlement::where('outlet_id', 1)->where('period_type', 'weekly')
    ->orderBy('period_start')
    ->each(function ($s) {
        $out = max(0, (float) $s->amount_due - (float) $s->paid_amount - (float) $s->adjustment_amount);
        $marker = ($s->status === 'paid' || $out <= 0) ? '[OK]' : '[!!]';
        echo "  {$marker} #{$s->id} | {$s->period_label} | due:{$s->amount_due} paid:{$s->paid_amount} | {$s->status} | out:" . number_format($out) . "\n";
    });

// ══════════════════════════════════════════
// STEP 8: Stock integrity
// ══════════════════════════════════════════
echo "\nSTEP 8: Stock integrity\n";
$inv = $inv->fresh();
echo "  Current stock: {$inv->current_stock}\n";
echo "  Reserved stock: {$inv->reserved_stock}\n";
ok("Reserved stock = 0", $inv->reserved_stock === 0, "reserved={$inv->reserved_stock}");

// ══════════════════════════════════════════
// FINAL SUMMARY
// ══════════════════════════════════════════
echo "\n========================================\n";
echo "RESULT: {$pass} passed, {$fail} failed\n";
echo "========================================\n";

if ($fail === 0) {
    echo "ALL TESTS PASSED\n";
} else {
    echo "SOME TESTS FAILED - review above\n";
}
