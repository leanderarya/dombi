# Settlement Payment Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance settlement payment system with automated reminders, bank account info, proof upload, and payment verification notifications.

**Architecture:** Extend existing NotificationService with 5 new settlement types, add payment_accounts table for bank info, add scheduled reminder command, and wire up proof upload in outlet payment submission.

**Tech Stack:** Laravel 12, Inertia.js/React, MySQL, existing NotificationService pattern

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `database/migrations/2026_06_16_000001_create_payment_accounts_table.php` | Create | Bank account info table |
| `app/Models/PaymentAccount.php` | Create | PaymentAccount model |
| `app/Http/Controllers/Owner/PaymentAccountController.php` | Create | Owner CRUD for bank accounts |
| `app/Http/Controllers/Outlet/PaymentAccountController.php` | Create | Outlet view bank accounts |
| `resources/js/pages/owner/payment-accounts.tsx` | Create | Owner manage bank accounts UI |
| `app/Console/Commands/SettlementSendReminders.php` | Create | Scheduled reminder command |
| `app/Services/NotificationService.php` | Modify | Add 5 settlement notification types |
| `routes/console.php` | Modify | Register scheduled command |
| `routes/web.php` | Modify | Add payment account routes |
| `app/Http/Controllers/Outlet/SettlementPaymentController.php` | Modify | Add proof_image upload |
| `resources/js/pages/outlet/settlement-payments.tsx` | Modify | Add proof upload field |
| `resources/js/pages/outlet/settlement.tsx` | Modify | Display bank account info |
| `app/Services/SettlementPaymentService.php` | Modify | Add notification dispatch |
| `tests/Feature/SettlementReminderTest.php` | Create | Test reminder command |
| `tests/Feature/PaymentAccountTest.php` | Create | Test bank account CRUD |
| `tests/Feature/SettlementNotificationTest.php` | Create | Test notification dispatch |

---

### Task 1: Create PaymentAccount Migration & Model

**Files:**
- Create: `database/migrations/2026_06_16_000001_create_payment_accounts_table.php`
- Create: `app/Models/PaymentAccount.php`

- [ ] **Step 1: Write migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('bank_name');
            $table->string('account_number');
            $table->string('account_holder');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_accounts');
    }
};
```

- [ ] **Step 2: Write model**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentAccount extends Model
{
    protected $fillable = [
        'bank_name',
        'account_number',
        'account_holder',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
```

- [ ] **Step 3: Run migration**

Run: `php artisan migrate`
Expected: Migration successful

- [ ] **Step 4: Commit**

```bash
git add database/migrations/2026_06_16_000001_create_payment_accounts_table.php app/Models/PaymentAccount.php
git commit -m "feat: add PaymentAccount model and migration for bank account info"
```

---

### Task 2: Add Settlement Notification Types to NotificationService

**Files:**
- Modify: `app/Services/NotificationService.php`

- [ ] **Step 1: Add notification constants**

Add after line 44 (after `RETURNED_DELIVERY_PENDING`):

```php
    // Settlement notifications
    public const SETTLEMENT_REMINDER = 'settlement.reminder';
    public const SETTLEMENT_GENERATED = 'settlement.generated';
    public const PAYMENT_SUBMITTED = 'payment.submitted';
    public const PAYMENT_VERIFIED = 'payment.verified';
    public const PAYMENT_REJECTED = 'payment.rejected';
```

- [ ] **Step 2: Add notification methods**

Add before the `// ─── HELPER METHODS` section:

```php
    // ─── SETTLEMENT NOTIFICATIONS ────────────────────────────────────

    public function notifySettlementReminder(\App\Models\Settlement $settlement): void
    {
        $outletUser = $this->getOutletUser($settlement->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::SETTLEMENT_REMINDER,
                title: 'Pengingat Pembayaran',
                message: "Settlement untuk periode {$settlement->period_date->format('d/m/Y')} jatuh tempo besok. Jumlah: Rp " . number_format($settlement->amount_due, 0, ',', '.'),
                data: ['settlement_id' => $settlement->id, 'amount_due' => $settlement->amount_due, 'due_date' => $settlement->due_date->toDateString()],
                entityType: 'settlement',
                entityId: $settlement->id
            );
        }
    }

    public function notifySettlementGenerated(\App\Models\Settlement $settlement): void
    {
        $outletUser = $this->getOutletUser($settlement->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::SETTLEMENT_GENERATED,
                title: 'Settlement Baru',
                message: "Settlement untuk periode {$settlement->period_date->format('d/m/Y')} telah dibuat. Jumlah: Rp " . number_format($settlement->amount_due, 0, ',', '.'),
                data: ['settlement_id' => $settlement->id, 'amount_due' => $settlement->amount_due],
                entityType: 'settlement',
                entityId: $settlement->id
            );
        }
    }

    public function notifyPaymentSubmitted(\App\Models\SettlementPayment $payment): void
    {
        foreach ($this->getOwners() as $ownerId) {
            $this->create(
                userType: 'owner',
                userId: $ownerId,
                customerId: null,
                type: self::PAYMENT_SUBMITTED,
                title: 'Pembayaran Baru',
                message: "Outlet {$payment->outlet->name} mengirim pembayaran Rp " . number_format($payment->amount, 0, ',', '.') . " (Ref: {$payment->reference_number})",
                data: ['payment_id' => $payment->id, 'outlet_id' => $payment->outlet_id, 'amount' => $payment->amount, 'reference_number' => $payment->reference_number],
                entityType: 'settlement_payment',
                entityId: $payment->id
            );
        }
    }

    public function notifyPaymentVerified(\App\Models\SettlementPayment $payment): void
    {
        $outletUser = $this->getOutletUser($payment->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::PAYMENT_VERIFIED,
                title: 'Pembayaran Diverifikasi',
                message: "Pembayaran {$payment->reference_number} sebesar Rp " . number_format($payment->amount, 0, ',', '.') . " telah diverifikasi.",
                data: ['payment_id' => $payment->id, 'amount' => $payment->amount, 'reference_number' => $payment->reference_number],
                entityType: 'settlement_payment',
                entityId: $payment->id
            );
        }
    }

    public function notifyPaymentRejected(\App\Models\SettlementPayment $payment, string $reason): void
    {
        $outletUser = $this->getOutletUser($payment->outlet_id);
        if ($outletUser) {
            $this->create(
                userType: 'outlet',
                userId: $outletUser->id,
                customerId: null,
                type: self::PAYMENT_REJECTED,
                title: 'Pembayaran Ditolak',
                message: "Pembayaran {$payment->reference_number} ditolak. Alasan: {$reason}",
                data: ['payment_id' => $payment->id, 'amount' => $payment->amount, 'reference_number' => $payment->reference_number, 'reason' => $reason],
                entityType: 'settlement_payment',
                entityId: $payment->id
            );
        }
    }
```

- [ ] **Step 3: Run tests**

Run: `php artisan test --filter=SettlementNotification`
Expected: PASS (tests will be created in Task 7)

- [ ] **Step 4: Commit**

```bash
git add app/Services/NotificationService.php
git commit -m "feat: add settlement notification types to NotificationService"
```

---

### Task 3: Create Scheduled Reminder Command

**Files:**
- Create: `app/Console/Commands/SettlementSendReminders.php`
- Modify: `routes/console.php`

- [ ] **Step 1: Write the command**

```php
<?php

namespace App\Console\Commands;

use App\Models\Settlement;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class SettlementSendReminders extends Command
{
    protected $signature = 'settlement:send-reminders';
    protected $description = 'Send payment reminders for settlements due tomorrow';

    public function handle(NotificationService $notificationService): int
    {
        $tomorrow = Carbon::tomorrow();

        $settlements = Settlement::query()
            ->where('due_date', $tomorrow)
            ->whereNotIn('status', [Settlement::STATUS_PAID])
            ->where(function ($query) {
                $query->whereNull('last_invoice_sent_at')
                    ->orWhereDate('last_invoice_sent_at', '!=', now());
            })
            ->with('outlet')
            ->get();

        $sent = 0;
        foreach ($settlements as $settlement) {
            $notificationService->notifySettlementReminder($settlement);
            $settlement->update(['last_invoice_sent_at' => now()]);
            $sent++;
        }

        $this->info("Sent {$sent} payment reminders.");

        return self::SUCCESS;
    }
}
```

- [ ] **Step 2: Register scheduled command**

Add to `routes/console.php` after the courier management section:

```php
// ─── SETTLEMENT REMINDERS ─────────────────────────────────────────

Schedule::command('settlement:send-reminders')
    ->daily()
    ->at('08:00')
    ->withoutOverlapping()
    ->onOneServer()
    ->appendOutputTo(storage_path('logs/settlement-reminders.log'));
```

- [ ] **Step 3: Test command manually**

Run: `php artisan settlement:send-reminders`
Expected: Shows count of reminders sent

- [ ] **Step 4: Commit**

```bash
git add app/Console/Commands/SettlementSendReminders.php routes/console.php
git commit -m "feat: add scheduled settlement reminder command"
```

---

### Task 4: Create PaymentAccount CRUD (Owner)

**Files:**
- Create: `app/Http/Controllers/Owner/PaymentAccountController.php`
- Modify: `routes/web.php`
- Create: `resources/js/pages/owner/payment-accounts.tsx`

- [ ] **Step 1: Write controller**

```php
<?php

namespace App\Http\Controllers\Owner;

use App\Http\Controllers\Controller;
use App\Models\PaymentAccount;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PaymentAccountController extends Controller
{
    public function index(): Response
    {
        $accounts = PaymentAccount::orderBy('bank_name')->get();

        return Inertia::render('owner/payment-accounts', [
            'accounts' => $accounts,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'bank_name' => ['required', 'string', 'max:100'],
            'account_number' => ['required', 'string', 'max:50'],
            'account_holder' => ['required', 'string', 'max:100'],
        ]);

        PaymentAccount::create($validated);

        return redirect()->route('owner.payment-accounts.index')
            ->with('success', 'Rekening berhasil ditambahkan.');
    }

    public function update(Request $request, PaymentAccount $account): RedirectResponse
    {
        $validated = $request->validate([
            'bank_name' => ['required', 'string', 'max:100'],
            'account_number' => ['required', 'string', 'max:50'],
            'account_holder' => ['required', 'string', 'max:100'],
            'is_active' => ['boolean'],
        ]);

        $account->update($validated);

        return redirect()->route('owner.payment-accounts.index')
            ->with('success', 'Rekening berhasil diperbarui.');
    }

    public function destroy(PaymentAccount $account): RedirectResponse
    {
        $account->delete();

        return redirect()->route('owner.payment-accounts.index')
            ->with('success', 'Rekening berhasil dihapus.');
    }
}
```

- [ ] **Step 2: Add routes**

Add to `routes/web.php` in the owner middleware group:

```php
Route::resource('payment-accounts', \App\Http\Controllers\Owner\PaymentAccountController::class)
    ->only(['index', 'store', 'update', 'destroy']);
```

- [ ] **Step 3: Write frontend page**

Create `resources/js/pages/owner/payment-accounts.tsx`:

```tsx
import { Head, useForm, router } from '@inertiajs/react';
import { useState } from 'react';

interface PaymentAccount {
    id: number;
    bank_name: string;
    account_number: string;
    account_holder: string;
    is_active: boolean;
}

interface Props {
    accounts: PaymentAccount[];
}

export default function PaymentAccounts({ accounts }: Props) {
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const { data, setData, post, put, processing, errors, reset } = useForm({
        bank_name: '',
        account_number: '',
        account_holder: '',
        is_active: true,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingId) {
            put(`/owner/payment-accounts/${editingId}`, {
                onSuccess: () => {
                    reset();
                    setShowForm(false);
                    setEditingId(null);
                },
            });
        } else {
            post('/owner/payment-accounts', {
                onSuccess: () => {
                    reset();
                    setShowForm(false);
                },
            });
        }
    };

    const handleEdit = (account: PaymentAccount) => {
        setEditingId(account.id);
        setData({
            bank_name: account.bank_name,
            account_number: account.account_number,
            account_holder: account.account_holder,
            is_active: account.is_active,
        });
        setShowForm(true);
    };

    const handleDelete = (id: number) => {
        if (confirm('Hapus rekening ini?')) {
            router.delete(`/owner/payment-accounts/${id}`);
        }
    };

    return (
        <>
            <Head title="Rekening Pembayaran" />

            <div className="p-4">
                <div className="mb-4 flex items-center justify-between">
                    <h1 className="text-lg font-bold text-slate-900">Rekening Pembayaran</h1>
                    <button
                        onClick={() => {
                            reset();
                            setEditingId(null);
                            setShowForm(!showForm);
                        }}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                        {showForm ? 'Batal' : 'Tambah Rekening'}
                    </button>
                </div>

                {showForm && (
                    <form onSubmit={handleSubmit} className="mb-4 rounded-xl border border-zinc-200 bg-white p-4">
                        <h2 className="mb-3 text-sm font-semibold text-slate-900">
                            {editingId ? 'Edit Rekening' : 'Tambah Rekening'}
                        </h2>

                        <div className="space-y-3">
                            <div>
                                <label className="mb-1 block text-xs font-medium text-zinc-500">Nama Bank</label>
                                <input
                                    type="text"
                                    value={data.bank_name}
                                    onChange={(e) => setData('bank_name', e.target.value)}
                                    required
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                    placeholder="BCA, Mandiri, BRI..."
                                />
                                {errors.bank_name && <p className="mt-1 text-xs text-red-600">{errors.bank_name}</p>}
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-zinc-500">Nomor Rekening</label>
                                <input
                                    type="text"
                                    value={data.account_number}
                                    onChange={(e) => setData('account_number', e.target.value)}
                                    required
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                    placeholder="1234567890"
                                />
                                {errors.account_number && <p className="mt-1 text-xs text-red-600">{errors.account_number}</p>}
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-zinc-500">Nama Pemilik</label>
                                <input
                                    type="text"
                                    value={data.account_holder}
                                    onChange={(e) => setData('account_holder', e.target.value)}
                                    required
                                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                                    placeholder="PT Dombi Indonesia"
                                />
                                {errors.account_holder && <p className="mt-1 text-xs text-red-600">{errors.account_holder}</p>}
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={data.is_active}
                                    onChange={(e) => setData('is_active', e.target.checked)}
                                    className="h-4 w-4 rounded border-zinc-300"
                                />
                                <label htmlFor="is_active" className="text-sm text-zinc-700">Aktif</label>
                            </div>

                            <button
                                type="submit"
                                disabled={processing}
                                className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {processing ? 'Menyimpan...' : editingId ? 'Perbarui' : 'Simpan'}
                            </button>
                        </div>
                    </form>
                )}

                <div className="space-y-2">
                    {accounts.length === 0 ? (
                        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
                            <p className="text-sm text-zinc-500">Belum ada rekening</p>
                        </div>
                    ) : (
                        accounts.map((account) => (
                            <div key={account.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900">{account.bank_name}</div>
                                        <div className="text-xs text-zinc-500">{account.account_number}</div>
                                        <div className="text-xs text-zinc-400">a.n. {account.account_holder}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${account.is_active ? 'bg-emerald-50 text-emerald-800' : 'bg-zinc-100 text-zinc-500'}`}>
                                            {account.is_active ? 'Aktif' : 'Nonaktif'}
                                        </span>
                                    </div>
                                </div>
                                <div className="mt-3 flex gap-2">
                                    <button
                                        onClick={() => handleEdit(account)}
                                        className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(account.id)}
                                        className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                                    >
                                        Hapus
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
```

- [ ] **Step 4: Test the page**

Run: `php artisan serve`
Visit: `/owner/payment-accounts`
Expected: Page loads, can add/edit/delete accounts

- [ ] **Step 5: Commit**

```bash
git add app/Http/Controllers/Owner/PaymentAccountController.php routes/web.php resources/js/pages/owner/payment-accounts.tsx
git commit -m "feat: add PaymentAccount CRUD for owner"
```

---

### Task 5: Display Bank Account Info on Outlet Settlement Page

**Files:**
- Modify: `app/Http/Controllers/Outlet/SettlementController.php`
- Modify: `resources/js/pages/outlet/settlement.tsx`

- [ ] **Step 1: Update controller to pass payment accounts**

Add to `SettlementController@index` method:

```php
use App\Models\PaymentAccount;

// In the index method, add to Inertia::render data:
'paymentAccounts' => PaymentAccount::active()->orderBy('bank_name')->get(),
```

- [ ] **Step 2: Update frontend to display bank info**

Add to the settlement page JSX after the summary section:

```tsx
{/* Info Rekening */}
{paymentAccounts.length > 0 && (
    <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Info Rekening Tujuan</h2>
        <div className="space-y-2">
            {paymentAccounts.map((account) => (
                <div key={account.id} className="rounded-lg bg-zinc-50 p-3">
                    <div className="text-sm font-medium text-slate-900">{account.bank_name}</div>
                    <div className="text-xs text-zinc-600">{account.account_number}</div>
                    <div className="text-xs text-zinc-500">a.n. {account.account_holder}</div>
                </div>
            ))}
        </div>
    </div>
)}
```

- [ ] **Step 3: Test the page**

Visit: `/outlet/settlement`
Expected: Bank account info displayed

- [ ] **Step 4: Commit**

```bash
git add app/Http/Controllers/Outlet/SettlementController.php resources/js/pages/outlet/settlement.tsx
git commit -m "feat: display bank account info on outlet settlement page"
```

---

### Task 6: Add Proof Image Upload to Outlet Payment Submission

**Files:**
- Modify: `app/Http/Controllers/Outlet/SettlementPaymentController.php`
- Modify: `resources/js/pages/outlet/settlement-payments.tsx`

- [ ] **Step 1: Update controller validation**

In `SettlementPaymentController@store`, update validation:

```php
$validated = $request->validate([
    'amount' => ['required', 'numeric', 'min:1'],
    'reference_number' => ['required', 'string', 'max:100', 'unique:settlement_payments,reference_number'],
    'payment_date' => ['required', 'date', 'before_or_equal:today'],
    'notes' => ['nullable', 'string', 'max:500'],
    'proof_image' => ['nullable', 'image', 'max:2048'], // max 2MB
]);
```

Update the create logic to handle file upload:

```php
$proofPath = null;
if ($request->hasFile('proof_image')) {
    $proofPath = $request->file('proof_image')->store('payment-proofs', 'public');
}

SettlementPayment::create([
    'outlet_id' => $outlet->id,
    'reference_number' => $validated['reference_number'],
    'payment_date' => $validated['payment_date'],
    'amount' => $validated['amount'],
    'proof_image' => $proofPath,
    'notes' => $validated['notes'] ?? null,
    'status' => SettlementPayment::STATUS_PENDING,
]);
```

- [ ] **Step 2: Add notification dispatch**

Inject NotificationService and call after payment creation:

```php
use App\Services\NotificationService;

public function store(Request $request, NotificationService $notificationService): RedirectResponse
{
    // ... validation and creation ...

    $payment = SettlementPayment::create([...]);
    $payment->load('outlet');
    $notificationService->notifyPaymentSubmitted($payment);

    return redirect()->route('outlet.settlement-payments.index')
        ->with('success', 'Pembayaran berhasil dikirim. Menunggu verifikasi owner.');
}
```

- [ ] **Step 3: Update frontend form**

Update the form to use FormData for file upload:

```tsx
const { data, setData, post, processing, errors, reset } = useForm({
    amount: '',
    reference_number: '',
    payment_date: new Date().toISOString().split('T')[0],
    notes: '',
    proof_image: null as File | null,
});

const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('amount', data.amount);
    formData.append('reference_number', data.reference_number);
    formData.append('payment_date', data.payment_date);
    if (data.notes) formData.append('notes', data.notes);
    if (data.proof_image) formData.append('proof_image', data.proof_image);

    post('/outlet/settlement-payments', {
        data: formData,
        onSuccess: () => {
            reset();
            setShowForm(false);
        },
    });
};
```

Add file input field in the form:

```tsx
<div>
    <label className="mb-1 block text-xs font-medium text-zinc-500">Bukti Transfer (opsional)</label>
    <input
        type="file"
        accept="image/*"
        onChange={(e) => setData('proof_image', e.target.files?.[0] || null)}
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
    />
    {errors.proof_image && <p className="mt-1 text-xs text-red-600">{errors.proof_image}</p>}
</div>
```

- [ ] **Step 4: Display proof in payment list**

Add to the payment card:

```tsx
{payment.proof_image && (
    <div className="mt-2">
        <a href={`/storage/${payment.proof_image}`} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 underline">
            Lihat Bukti Transfer
        </a>
    </div>
)}
```

- [ ] **Step 5: Update Payment interface**

```tsx
interface Payment {
    id: number;
    reference_number: string;
    payment_date: string;
    amount: number;
    status: string;
    notes: string | null;
    proof_image: string | null;
    rejection_reason: string | null;
    verifier: { name: string } | null;
    verified_at: string | null;
}
```

- [ ] **Step 6: Test payment submission**

Submit a payment with proof image
Expected: Payment created with proof, notification sent to owner

- [ ] **Step 7: Commit**

```bash
git add app/Http/Controllers/Outlet/SettlementPaymentController.php resources/js/pages/outlet/settlement-payments.tsx
git commit -m "feat: add proof image upload and payment notification"
```

---

### Task 7: Add Notification Dispatch to Owner Verification

**Files:**
- Modify: `app/Services/SettlementPaymentService.php`

- [ ] **Step 1: Inject NotificationService**

```php
use App\Services\NotificationService;

class SettlementPaymentService
{
    public function __construct(
        private readonly NotificationService $notificationService,
    ) {}
```

- [ ] **Step 2: Add notification to verifyPayment**

```php
public function verifyPayment(SettlementPayment $payment, User $user): void
{
    if (! $payment->isPending()) {
        return;
    }

    DB::transaction(function () use ($payment, $user) {
        $payment->update([
            'status' => SettlementPayment::STATUS_VERIFIED,
            'verified_by' => $user->id,
            'verified_at' => now(),
        ]);

        if ($payment->settlement_id) {
            $settlement = $payment->settlement;
            if ($settlement) {
                $settlement->paid_amount = (float) $settlement->paid_amount + (float) $payment->amount;
                $settlement->recalculateStatus();
            }
        }
    });

    $payment->load('outlet');
    $this->notificationService->notifyPaymentVerified($payment);
}
```

- [ ] **Step 3: Add notification to rejectPayment**

```php
public function rejectPayment(SettlementPayment $payment, string $reason): void
{
    $payment->update([
        'status' => SettlementPayment::STATUS_REJECTED,
        'rejection_reason' => $reason,
    ]);

    $payment->load('outlet');
    $this->notificationService->notifyPaymentRejected($payment, $reason);
}
```

- [ ] **Step 4: Commit**

```bash
git add app/Services/SettlementPaymentService.php
git commit -m "feat: dispatch notifications on payment verify/reject"
```

---

### Task 8: Write Feature Tests

**Files:**
- Create: `tests/Feature/SettlementReminderTest.php`
- Create: `tests/Feature/PaymentAccountTest.php`
- Create: `tests/Feature/SettlementNotificationTest.php`

- [ ] **Step 1: Write SettlementReminderTest**

```php
<?php

namespace Tests\Feature;

use App\Console\Commands\SettlementSendReminders;
use App\Models\Notification;
use App\Models\Outlet;
use App\Models\Settlement;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SettlementReminderTest extends TestCase
{
    use RefreshDatabase;

    public function test_sends_reminders_for_settlements_due_tomorrow(): void
    {
        $outlet = Outlet::factory()->create();
        $user = User::factory()->create(['role' => 'outlet', 'outlet_id' => $outlet->id]);

        $settlement = Settlement::factory()->create([
            'outlet_id' => $outlet->id,
            'due_date' => Carbon::tomorrow(),
            'status' => Settlement::STATUS_PENDING,
        ]);

        $this->artisan('settlement:send-reminders')
            ->assertExitCode(0);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $user->id,
            'type' => 'settlement.reminder',
            'entity_type' => 'settlement',
            'entity_id' => $settlement->id,
        ]);

        $settlement->refresh();
        $this->assertNotNull($settlement->last_invoice_sent_at);
    }

    public function test_skips_paid_settlements(): void
    {
        $outlet = Outlet::factory()->create();
        $user = User::factory()->create(['role' => 'outlet', 'outlet_id' => $outlet->id]);

        Settlement::factory()->create([
            'outlet_id' => $outlet->id,
            'due_date' => Carbon::tomorrow(),
            'status' => Settlement::STATUS_PAID,
        ]);

        $this->artisan('settlement:send-reminders')
            ->assertExitCode(0);

        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_skips_already_reminded_today(): void
    {
        $outlet = Outlet::factory()->create();
        $user = User::factory()->create(['role' => 'outlet', 'outlet_id' => $outlet->id]);

        Settlement::factory()->create([
            'outlet_id' => $outlet->id,
            'due_date' => Carbon::tomorrow(),
            'status' => Settlement::STATUS_PENDING,
            'last_invoice_sent_at' => now(),
        ]);

        $this->artisan('settlement:send-reminders')
            ->assertExitCode(0);

        $this->assertDatabaseCount('notifications', 0);
    }
}
```

- [ ] **Step 2: Write PaymentAccountTest**

```php
<?php

namespace Tests\Feature;

use App\Models\PaymentAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentAccountTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_create_payment_account(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);

        $response = $this->actingAs($owner)->post('/owner/payment-accounts', [
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
            'account_holder' => 'PT Dombi',
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('payment_accounts', [
            'bank_name' => 'BCA',
            'account_number' => '1234567890',
        ]);
    }

    public function test_outlet_can_view_active_accounts(): void
    {
        $outlet = User::factory()->create(['role' => 'outlet']);
        PaymentAccount::create(['bank_name' => 'BCA', 'account_number' => '123', 'account_holder' => 'Test', 'is_active' => true]);
        PaymentAccount::create(['bank_name' => 'Mandiri', 'account_number' => '456', 'account_holder' => 'Test', 'is_active' => false]);

        $response = $this->actingAs($outlet)->get('/outlet/settlement');

        $response->assertStatus(200);
    }
}
```

- [ ] **Step 3: Write SettlementNotificationTest**

```php
<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\Outlet;
use App\Models\SettlementPayment;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SettlementNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_payment_submitted_notifies_owner(): void
    {
        $owner = User::factory()->create(['role' => 'owner']);
        $outlet = Outlet::factory()->create();
        $user = User::factory()->create(['role' => 'outlet', 'outlet_id' => $outlet->id]);

        $payment = SettlementPayment::factory()->create([
            'outlet_id' => $outlet->id,
            'amount' => 100000,
            'reference_number' => 'TEST-001',
        ]);
        $payment->load('outlet');

        $service = app(NotificationService::class);
        $service->notifyPaymentSubmitted($payment);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $owner->id,
            'type' => 'payment.submitted',
        ]);
    }

    public function test_payment_verified_notifies_outlet(): void
    {
        $outlet = Outlet::factory()->create();
        $user = User::factory()->create(['role' => 'outlet', 'outlet_id' => $outlet->id]);

        $payment = SettlementPayment::factory()->create([
            'outlet_id' => $outlet->id,
            'amount' => 100000,
            'reference_number' => 'TEST-002',
        ]);
        $payment->load('outlet');

        $service = app(NotificationService::class);
        $service->notifyPaymentVerified($payment);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $user->id,
            'type' => 'payment.verified',
        ]);
    }

    public function test_payment_rejected_notifies_outlet_with_reason(): void
    {
        $outlet = Outlet::factory()->create();
        $user = User::factory()->create(['role' => 'outlet', 'outlet_id' => $outlet->id]);

        $payment = SettlementPayment::factory()->create([
            'outlet_id' => $outlet->id,
            'amount' => 100000,
            'reference_number' => 'TEST-003',
        ]);
        $payment->load('outlet');

        $service = app(NotificationService::class);
        $service->notifyPaymentRejected($payment, 'Bukti tidak jelas');

        $this->assertDatabaseHas('notifications', [
            'user_id' => $user->id,
            'type' => 'payment.rejected',
        ]);
    }
}
```

- [ ] **Step 4: Run tests**

Run: `php artisan test --filter=SettlementReminder && php artisan test --filter=PaymentAccount && php artisan test --filter=SettlementNotification`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add tests/Feature/SettlementReminderTest.php tests/Feature/PaymentAccountTest.php tests/Feature/SettlementNotificationTest.php
git commit -m "test: add settlement payment workflow tests"
```

---

### Task 9: Storage Link & Final Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Link storage**

Run: `php artisan storage:link`
Expected: Symlink created

- [ ] **Step 2: Run full test suite**

Run: `php artisan test`
Expected: All tests PASS

- [ ] **Step 3: Run linter**

Run: `./vendor/bin/pint --test`
Expected: No style issues

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete settlement payment workflow"
```
