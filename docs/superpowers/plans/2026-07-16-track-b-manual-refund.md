# Track B — Manual Owner Refund (no Doku API)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Doku-API-driven refunds with a fully manual Owner workflow. Customer can cancel a paid order only while outlet hasn't accepted yet (`pending_confirmation`). Cancel flags `refund_pending`. Owner marks refunded (with proof of manual bank transfer) or rejects. Doku is never involved in refunds. Customer receives 2-tahap notifications (refund requested + refund processed).

**Architecture:** Removed: `DokuService::refund` + credit-card/direct-debit refund calls. Cancel path sets `refund_pending` via `PaymentStatusService`. TRANSITIONS map tightened: only `pending_confirmation` allows cancel (not `confirmed`/`preparing`). Owner `RefundController` gets `markRefunded` (upload proof + amount) and `reject`. UI: `refund-tab` + `refund-proof-modal`. Customer gets notifications via `NotificationService`.

**Tech Stack:** Laravel 12, PHPUnit, Inertia + React 19 + Tailwind v4 + shadcn/ui, `PaymentStatus` enum (from Track A), `PaymentStatusService` (from Track A).

**Depends on:** Track A (enum + `PaymentStatusService` + `Order::refundable()` scope + `refund_pending` enum case + `PaymentStatus` schema migration).

---

## Audit Revisions (from brainstorming session)

| Aspect | Original plan | Revised |
|--------|---------------|---------|
| Cancel allowed from | `confirmed`, `preparing`, `pending_confirmation` | **only `pending_confirmation`** |
| Customer cancel button | Only when `paymentStatus === 'pending'` | When `orderStatus === 'pending_confirmation'` (paid or unpaid) |
| Refund trigger | Paid + cancel from confirmed/preparing | Paid + cancel from **pending_confirmation** only |
| Customer notifications | None | **2 tahap** (refund_requested + refund_processed) |
| processRefund guard | `refunded`, `refund_failed` | + **`refund_pending`** |

---

## Task B1: Migration — manual refund columns

**Files:**
- Create: `database/migrations/2026_07_16_000020_add_manual_refund_fields_to_orders_table.php`
- Test: `tests/Feature/ManualRefundMigrationTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ManualRefundMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_manual_refund_columns_exist(): void
    {
        $this->assertTrue(Schema::hasColumn('orders', 'refund_requested_at'));
        $this->assertTrue(Schema::hasColumn('orders', 'refund_proof_image'));
        $this->assertTrue(Schema::hasColumn('orders', 'refunded_by'));
        $this->assertTrue(Schema::hasColumn('orders', 'refund_rejected_reason'));
    }
}
```

- [ ] **Step 2: Run test**

Run: `php artisan test tests/Feature/ManualRefundMigrationTest.php`
Expected: FAIL — columns missing

- [ ] **Step 3: Create migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('refund_requested_at')->nullable()->after('refunded_at');
            $table->string('refund_proof_image')->nullable()->after('refund_requested_at');
            $table->unsignedBigInteger('refunded_by')->nullable()->after('refund_proof_image');
            $table->string('refund_rejected_reason')->nullable()->after('refund_proof_image');

            $table->foreign('refunded_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropForeign(['refunded_by']);
            $table->dropColumn(['refund_requested_at', 'refund_proof_image', 'refunded_by', 'refund_rejected_reason']);
        });
    }
};
```

- [ ] **Step 4: Run migration + test**

Run: `php artisan migrate --path=database/migrations/2026_07_16_000020_add_manual_refund_fields_to_orders_table.php && php artisan test tests/Feature/ManualRefundMigrationTest.php`
Expected: PASS

- [ ] **Step 5: Add fillable + casts to Order**

fillable (after `'doku_refund_id'`): `'refund_requested_at', 'refund_proof_image', 'refunded_by', 'refund_rejected_reason',`
casts (after `'refund_amount' => 'decimal:2'`): `'refund_requested_at' => 'datetime',`

- [ ] **Step 6: Commit**

```bash
git add database/migrations/2026_07_16_000020_add_manual_refund_fields_to_orders_table.php app/Models/Order.php tests/Feature/ManualRefundMigrationTest.php
git commit -m "feat(refund): add manual refund columns (proof, refunded_by, reject reason)"
```

---

## Task B2: Remove Doku refund API + tighten transitions + rewrite processRefund

**Files:**
- Modify: `app/Services/DokuService.php` (delete `refund`, `refundCreditCard`, `refundDirectDebit`, `handleRefundResponse`)
- Modify: `app/Services/OrderStatusService.php` (`processRefund` rewrite + TRANSITIONS map)
- Test: `tests/Feature/ManualRefundTriggerTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

namespace Tests\Feature;

use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Services\OrderStatusService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ManualRefundTriggerTest extends TestCase
{
    use RefreshDatabase;

    public function test_cancelling_a_paid_pending_confirmation_order_flags_refund_pending(): void
    {
        $order = Order::factory()->create([
            'payment_status' => 'paid',
            'status' => Order::STATUS_PENDING_CONFIRMATION,
        ]);

        app(OrderStatusService::class)->cancelByCustomer($order, 'Lainnya', 'minta refund');

        $o = Order::find($order->id);
        $this->assertSame('refund_pending', $o->payment_status);
        $this->assertNotNull($o->refund_requested_at);
    }

    public function test_cannot_cancel_confirmed_order(): void
    {
        $order = Order::factory()->create([
            'payment_status' => 'paid',
            'status' => Order::STATUS_CONFIRMED,
        ]);

        $this->expectException(\Illuminate\Validation\ValidationException::class);
        app(OrderStatusService::class)->cancelByCustomer($order, 'Lainnya', 'minta refund');
    }

    public function test_cannot_cancel_preparing_order(): void
    {
        $order = Order::factory()->create([
            'payment_status' => 'paid',
            'status' => Order::STATUS_PREPARING,
        ]);

        $this->expectException(\Illuminate\Validation\ValidationException::class);
        app(OrderStatusService::class)->cancelByCustomer($order, 'Lainnya', 'minta refund');
    }
}
```

- [ ] **Step 2: Run test**

Run: `php artisan test tests/Feature/ManualRefundTriggerTest.php`
Expected: FAIL — confirmed/preparing still cancellable + Doku refund still called

- [ ] **Step 3: Update TRANSITIONS map in OrderStatusService**

Read `app/Services/OrderStatusService.php` to find the TRANSITIONS constant (around line 30-60). Remove `Order::STATUS_CANCELLED_BY_CUSTOMER` from the transitions of `Order::STATUS_CONFIRMED` and `Order::STATUS_PREPARING`. Keep it only in `Order::STATUS_PENDING_CONFIRMATION`.

Before (example):
```php
Order::STATUS_CONFIRMED => [
    Order::STATUS_PREPARING,
    Order::STATUS_CANCELLED_BY_CUSTOMER,  // ← REMOVE
    Order::STATUS_CANCELLED_BY_OUTLET,
],
Order::STATUS_PREPARING => [
    Order::STATUS_READY_FOR_PICKUP,
    Order::STATUS_CANCELLED_BY_CUSTOMER,  // ← REMOVE
    Order::STATUS_CANCELLED_BY_OUTLET,
],
```

After:
```php
Order::STATUS_CONFIRMED => [
    Order::STATUS_PREPARING,
    Order::STATUS_CANCELLED_BY_OUTLET,
],
Order::STATUS_PREPARING => [
    Order::STATUS_READY_FOR_PICKUP,
    Order::STATUS_CANCELLED_BY_OUTLET,
],
```

- [ ] **Step 4: Rewrite `processRefund`**

Replace the existing `processRefund` method (around lines 395-419):

```php
    private function processRefund(Order $order, string $reason): void
    {
        // Guard: skip if already in a refund terminal state
        if (in_array($order->payment_status, ['refunded', 'refund_failed', 'refund_pending'], true)) {
            return;
        }

        // Manual refund workflow: Owner handles the actual bank transfer.
        // We only flag the order for the Owner's manual refund queue.
        $ok = app(PaymentStatusService::class)->transition($order, PaymentStatus::RefundPending, [
            'refund_requested_at' => now(),
            'refund_reason' => $reason,
        ]);

        if ($ok) {
            app(NotificationService::class)->notifyRefundRequested($order);
        }
    }
```

Add imports if not present:
```php
use App\Enums\PaymentStatus;
use App\Services\PaymentStatusService;
```

- [ ] **Step 5: Delete Doku refund methods**

Remove from `DokuService.php`: `refund()`, `refundCreditCard()`, `refundDirectDebit()`, `handleRefundResponse()`. Keep `mapPaymentMethod` (still used by `createPayment`).

- [ ] **Step 6: Run test**

Run: `php artisan test tests/Feature/ManualRefundTriggerTest.php`
Expected: PASS

- [ ] **Step 7: Update RefundFlowTest expectations**

Run: `php artisan test tests/Feature/RefundFlowTest.php`
If failing, update assertions:
- Cancel of paid `pending_confirmation` order → expect `refund_pending` (not `refunded`)
- `refund_failed` no longer produced by code
- Cash payment refund skip → still skipped (payment_status stays `paid` because `processRefund` guard checks `payment_status !== 'paid'`)

- [ ] **Step 8: Commit**

```bash
git add app/Services/OrderStatusService.php app/Services/DokuService.php tests/Feature/ManualRefundTriggerTest.php tests/Feature/RefundFlowTest.php
git commit -m "refactor(refund): remove Doku refund API; tighten cancel to pending_confirmation; flag refund_pending"
```

---

## Task B3: Owner manual refund controller + UI

**Files:**
- Modify: `app/Http/Controllers/Owner/RefundController.php`
- Create: `app/Http/Requests/Owner/ManualRefundRequest.php`
- Modify: `routes/web.php` (refund action routes)
- Modify: `resources/js/pages/owner/finance/refund-tab.tsx`
- Create: `resources/js/components/owner/finance/refund-proof-modal.tsx`
- Test: `tests/Feature/OwnerManualRefundTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

namespace Tests\Feature;

use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class OwnerManualRefundTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_marks_refund_pending_order_refunded_with_proof(): void
    {
        Storage::fake('public');
        $owner = User::factory()->create();
        $order = Order::factory()->create([
            'payment_status' => 'refund_pending',
            'refund_amount' => 50000,
        ]);
        $proof = UploadedFile::fake()->image('bukti.jpg');

        $this->actingAs($owner, 'owner')
            ->post("/owner/refunds/{$order->id}/mark-refunded", [
                'refund_amount' => 50000,
                'refund_reason' => 'Sudah transfer',
                'proof' => $proof,
            ])->assertRedirect();

        $o = Order::find($order->id);
        $this->assertSame('refunded', $o->payment_status);
        $this->assertEquals($owner->id, $o->refunded_by);
        $this->assertNotNull($o->refund_proof_image);
        Storage::disk('public')->assertExists($o->refund_proof_image);
    }

    public function test_owner_reject_sets_refund_rejected(): void
    {
        $owner = User::factory()->create();
        $order = Order::factory()->create(['payment_status' => 'refund_pending']);

        $this->actingAs($owner, 'owner')
            ->post("/owner/refunds/{$order->id}/reject", ['reason' => 'Bukan salah kami'])
            ->assertRedirect();

        $this->assertSame('refund_rejected', Order::find($order->id)->payment_status);
    }

    public function test_cannot_refund_non_refund_pending_order(): void
    {
        $owner = User::factory()->create();
        $order = Order::factory()->create(['payment_status' => 'paid']);

        $this->actingAs($owner, 'owner')
            ->post("/owner/refunds/{$order->id}/mark-refunded", [
                'refund_amount' => 1,
                'refund_reason' => 'x',
            ])->assertSessionHasErrors();
    }
}
```

- [ ] **Step 2: Run test**

Run: `php artisan test tests/Feature/OwnerManualRefundTest.php`
Expected: FAIL — routes/controller not implemented

- [ ] **Step 3: Create ManualRefundRequest**

```php
<?php

namespace App\Http\Requests\Owner;

use Illuminate\Foundation\Http\FormRequest;

class ManualRefundRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // owner gate enforced by middleware
    }

    public function rules(): array
    {
        return [
            'refund_amount' => ['required', 'numeric', 'min:1'],
            'refund_reason' => ['required', 'string', 'max:255'],
            'proof' => ['required', 'image', 'max:2048'],
        ];
    }
}
```

- [ ] **Step 4: Rewrite RefundController**

```php
<?php

namespace App\Http\Controllers\Owner;

use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Owner\ManualRefundRequest;
use App\Models\Order;
use App\Services\NotificationService;
use App\Services\PaymentStatusService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class RefundController extends Controller
{
    public function index(): Response
    {
        $orders = Order::refundable()
            ->with(['outlet', 'customer'])
            ->orderByDesc('refund_requested_at')
            ->paginate(20);

        return Inertia::render('owner/finance/refund-tab', [
            'refunds' => $orders,
        ]);
    }

    public function markRefunded(Order $order, ManualRefundRequest $request, PaymentStatusService $payment): RedirectResponse
    {
        if ($order->payment_status_enum !== PaymentStatus::RefundPending) {
            return redirect()->back()->with('error', 'Order ini tidak dalam antrean refund.');
        }

        $path = $request->file('proof')->store('refunds', 'public');

        $payment->transition($order, PaymentStatus::Refunded, [
            'refund_amount' => $request->input('refund_amount'),
            'refund_reason' => $request->input('refund_reason'),
            'refund_proof_image' => $path,
            'refunded_by' => auth()->id(),
            'refunded_at' => now(),
        ]);

        app(NotificationService::class)->notifyRefundProcessed($order, (float) $request->input('refund_amount'));

        return redirect()->back()->with('success', 'Refund ditandai selesai.');
    }

    public function reject(Order $order): RedirectResponse
    {
        if ($order->payment_status_enum !== PaymentStatus::RefundPending) {
            return redirect()->back()->with('error', 'Order ini tidak dalam antrean refund.');
        }

        app(PaymentStatusService::class)->transition($order, PaymentStatus::RefundRejected, [
            'refund_rejected_reason' => request('reason', 'Ditolak owner'),
        ]);

        return redirect()->back()->with('success', 'Refund ditolak.');
    }
}
```

- [ ] **Step 5: Update routes**

In `routes/web.php`, replace the existing refund action routes:
```php
Route::post('/owner/refunds/{order}/mark-refunded', [Owner\RefundController::class, 'markRefunded'])->name('owner.refunds.mark-refunded');
Route::post('/owner/refunds/{order}/reject', [Owner\RefundController::class, 'reject'])->name('owner.refunds.reject');
```
(keep `index` route unchanged)

- [ ] **Step 6: Build refund-proof-modal.tsx**

Create `resources/js/components/owner/finance/refund-proof-modal.tsx`:

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { router } from '@inertiajs/react';

interface Props {
    orderId: number;
    orderCode: string;
    expectedAmount: number;
    open: boolean;
    onClose: () => void;
}

export default function RefundProofModal({ orderId, orderCode, expectedAmount, open, onClose }: Props) {
    const [amount, setAmount] = useState(String(expectedAmount));
    const [reason, setReason] = useState('');
    const [proof, setProof] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = () => {
        if (!proof) return;
        setBusy(true);
        const fd = new FormData();
        fd.append('refund_amount', amount);
        fd.append('refund_reason', reason);
        fd.append('proof', proof);
        router.post(`/owner/refunds/${orderId}/mark-refunded`, fd, {
            forceFormData: true,
            onFinish: () => { setBusy(false); onClose(); },
        });
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Refund {orderCode}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <label className="text-xs text-text-muted">Nominal refund (Rp)</label>
                    <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
                    <label className="text-xs text-text-muted">Alasan</label>
                    <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Sudah transfer manual" />
                    <label className="text-xs text-text-muted">Bukti transfer</label>
                    <input type="file" accept="image/*" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
                    <Button disabled={busy || !proof} onClick={submit} className="w-full">
                        {busy ? 'Menyimpan...' : 'Tandai Refund'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 7: Rewrite refund-tab.tsx**

Replace the existing Retry/Selesai buttons with:
- "Refund" button → opens `RefundProofModal` (passing `id`, `order_code`, `total`)
- "Tolak" button → `router.post('/owner/refunds/{id}/reject', { reason })`
- Add `useState` for modal open + selected order
- Listing uses `refunds.data` (now `refundable()` = paid + refund_pending)

- [ ] **Step 8: Run test**

Run: `php artisan test tests/Feature/OwnerManualRefundTest.php`
Expected: PASS

- [ ] **Step 9: Build frontend**

Run: `npm run build`
Expected: built without errors

- [ ] **Step 10: Commit**

```bash
git add app/Http/Controllers/Owner/RefundController.php app/Http/Requests/Owner/ManualRefundRequest.php routes/web.php resources/js/pages/owner/finance/refund-tab.tsx resources/js/components/owner/finance/refund-proof-modal.tsx tests/Feature/OwnerManualRefundTest.php
git commit -m "feat(refund): manual owner refund with proof upload + reject"
```

---

## Task B4: Customer refund notifications (2 tahap)

**Files:**
- Modify: `app/Services/NotificationService.php` (add `notifyRefundRequested` + `notifyRefundProcessed`)
- Test: `tests/Feature/RefundNotificationTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class RefundNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_notify_refund_requested_sends_to_customer(): void
    {
        Notification::fake();
        $order = Order::factory()->create(['payment_status' => 'refund_pending']);

        app(NotificationService::class)->notifyRefundRequested($order);

        Notification::assertSentTo(
            $order->customer,
            \App\Notifications\RefundRequested::class,
        );
    }

    public function test_notify_refund_processed_sends_to_customer(): void
    {
        Notification::fake();
        $order = Order::factory()->create(['payment_status' => 'refunded']);

        app(NotificationService::class)->notifyRefundProcessed($order, 50000);

        Notification::assertSentTo(
            $order->customer,
            \App\Notifications\RefundProcessed::class,
        );
    }
}
```

- [ ] **Step 2: Run test**

Run: `php artisan test tests/Feature/RefundNotificationTest.php`
Expected: FAIL — notification classes missing

- [ ] **Step 3: Create notification classes**

Create `app/Notifications/RefundRequested.php`:
```php
<?php

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class RefundRequested extends Notification
{
    use Queueable;

    public function __construct(public Order $order) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'refund_requested',
            'order_id' => $this->order->id,
            'order_code' => $this->order->order_code,
            'message' => "Pesanan {$this->order->order_code} dibatalkan. Refund sebesar Rp " .
                number_format($this->order->total, 0, ',', '.') . " sedang diproses.",
        ];
    }
}
```

Create `app/Notifications/RefundProcessed.php`:
```php
<?php

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class RefundProcessed extends Notification
{
    use Queueable;

    public function __construct(public Order $order, public float $amount) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'refund_processed',
            'order_id' => $this->order->id,
            'order_code' => $this->order->order_code,
            'amount' => $this->amount,
            'message' => "Refund sebesar Rp " . number_format($this->amount, 0, ',', '.') .
                " untuk pesanan {$this->order->order_code} sudah selesai. Silakan cek rekening Anda.",
        ];
    }
}
```

- [ ] **Step 4: Add methods to NotificationService**

Read `app/Services/NotificationService.php` first to find the pattern for existing notification methods (e.g., `notifyOrderCreated`, `notifyRefundProcessed` if it exists). Add:

```php
    public function notifyRefundRequested(Order $order): void
    {
        if ($order->customer) {
            $order->customer->notify(new \App\Notifications\RefundRequested($order));
        }
    }

    public function notifyRefundProcessed(Order $order, float $amount): void
    {
        if ($order->customer) {
            $order->customer->notify(new \App\Notifications\RefundProcessed($order, $amount));
        }
    }
```

- [ ] **Step 5: Run test**

Run: `php artisan test tests/Feature/RefundNotificationTest.php`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/Notifications/RefundRequested.php app/Notifications/RefundProcessed.php app/Services/NotificationService.php tests/Feature/RefundNotificationTest.php
git commit -m "feat(refund): customer 2-tahap refund notifications (requested + processed)"
```

---

## Task B5: Customer UI — cancel button for paid + pending_confirmation

**Files:**
- Modify: `resources/js/pages/customer/orders/confirm.tsx`

- [ ] **Step 1: Inspect confirm.tsx**

Read `resources/js/pages/customer/orders/confirm.tsx` fully. Find the cancel button condition (currently `paymentStatus === 'pending'`). Also check what props are available — do we have `orderStatus`?

- [ ] **Step 2: Update cancel button condition**

Replace the cancel button guard from:
```tsx
{paymentStatus === 'pending' && isLoggedIn && (
```
to:
```tsx
{orderStatus === 'pending_confirmation' && isLoggedIn && (
```

If `orderStatus` is not available in props, check what the backend passes (in `OrderController@confirm` or `CustomerOrderController@show`). The backend should pass `status` in the order data.

- [ ] **Step 3: Update cancel success messaging**

After successful cancel, if `paymentStatus === 'paid'`, show refund messaging:
```tsx
// After cancel success
if (paymentStatus === 'paid') {
    setMessage('Pesanan dibatalkan. Refund sedang diproses owner.');
} else {
    setMessage('Pembayaran dibatalkan.');
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: built without errors

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/customer/orders/confirm.tsx
git commit -m "feat(refund): customer can cancel paid order in pending_confirmation"
```

---

## Self-Review
- Track B depends on Track A enum + `PaymentStatusService` + `refundable()` scope + schema migration. ✓
- Doku fully removed from refund path (4 methods deleted). ✓
- Cancel only from `pending_confirmation` (TRANSITIONS map tightened). ✓
- Customer gets 2-tahap notifications. ✓
- Owner proof upload stored in `refunds/` disk `public`. ✓
- `processRefund` guard includes `refund_pending` for idempotency. ✓
