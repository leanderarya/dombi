# Phone-Only Verification (Remove OTP) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove OTP verification flow, replace with direct phone linking for UMKM use case. Eliminates GOWA dependency for phone verification.

**Architecture:** `SocialAuthController::verifyPhone()` directly links phone to user account in a single DB transaction. No OTP generation, no WhatsApp sending, no session state. Frontend simplified to phone input → confirm → done.

**Tech Stack:** Laravel 13, React/Inertia, TypeScript

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `app/Http/Controllers/Auth/SocialAuthController.php` | Modify | Remove `sendPhoneOtp()`, simplify `verifyPhone()` to direct link, remove `PhoneVerificationService` dependency |
| `app/Services/PhoneVerificationService.php` | **Delete** | No longer needed |
| `routes/web.php` | Modify | Remove `send-phone-otp` route |
| `resources/js/pages/customer/verify-phone.tsx` | **Rewrite** | Remove OTP steps, add direct phone confirm flow |
| `tests/Feature/PhoneVerificationTest.php` | **Rewrite** | Test direct linking, remove OTP tests |
| `tests/Unit/GowaServiceTest.php` | Keep | GowaService stays for future WhatsApp notifications |
| `app/Services/GowaService.php` | Keep | May be used for order notifications later |

---

### Task 1: Update PhoneVerificationTest — Write Failing Tests First

**Files:**
- Rewrite: `tests/Feature/PhoneVerificationTest.php`

- [ ] **Step 1: Replace test file with new tests for direct linking**

```php
<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PhoneVerificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_show_verify_phone_page(): void
    {
        $user = User::factory()->create();
        Customer::create(['user_id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'is_registered' => true]);

        $this->actingAs($user)
            ->get('/customer/verify-phone')
            ->assertOk();
    }

    public function test_show_verify_phone_redirects_if_already_has_phone(): void
    {
        $user = User::factory()->create();
        Customer::create(['user_id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'phone' => '6281234567890', 'is_registered' => true]);

        $this->actingAs($user)
            ->get('/customer/verify-phone')
            ->assertRedirect(route('customer.home'));
    }

    public function test_verify_phone_links_phone_to_customer(): void
    {
        $user = User::factory()->create();
        Customer::create(['user_id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'is_registered' => true]);

        $this->actingAs($user)
            ->postJson('/customer/verify-phone', ['phone' => '6281234567890'])
            ->assertOk()
            ->assertJson([
                'verified' => true,
                'status' => 'created',
            ]);

        $this->assertDatabaseHas('customers', [
            'user_id' => $user->id,
            'phone' => '6281234567890',
        ]);
    }

    public function test_verify_phone_rejects_phone_linked_to_another_user(): void
    {
        $userA = User::factory()->create();
        Customer::create(['user_id' => $userA->id, 'name' => 'A', 'email' => $userA->email, 'phone' => '6281234567890', 'is_registered' => true]);

        $userB = User::factory()->create();
        Customer::create(['user_id' => $userB->id, 'name' => 'B', 'email' => $userB->email, 'is_registered' => true]);

        $this->actingAs($userB)
            ->postJson('/customer/verify-phone', ['phone' => '6281234567890'])
            ->assertStatus(422)
            ->assertJsonStructure(['error']);
    }

    public function test_verify_phone_merges_guest_orders(): void
    {
        $user = User::factory()->create();
        $registeredCustomer = Customer::create(['user_id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'is_registered' => true]);

        $guestCustomer = Customer::create(['name' => 'Guest', 'phone' => '6281234567890', 'is_registered' => false]);
        $guestOrder = Order::factory()->create(['customer_id' => $guestCustomer->id]);

        $this->actingAs($user)
            ->postJson('/customer/verify-phone', ['phone' => '6281234567890'])
            ->assertOk()
            ->assertJson(['verified' => true, 'status' => 'linked']);

        $guestOrder->refresh();
        $this->assertEquals($registeredCustomer->id, $guestOrder->customer_id);
        $this->assertDatabaseMissing('customers', ['id' => $guestCustomer->id]);
    }

    public function test_verify_phone_rejects_invalid_phone(): void
    {
        $user = User::factory()->create();
        Customer::create(['user_id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'is_registered' => true]);

        $this->actingAs($user)
            ->postJson('/customer/verify-phone', ['phone' => 'invalid'])
            ->assertStatus(422);
    }

    public function test_verify_phone_rejects_unauthenticated(): void
    {
        $this->postJson('/customer/verify-phone', ['phone' => '6281234567890'])
            ->assertStatus(401);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `php artisan test tests/Feature/PhoneVerificationTest.php`
Expected: FAIL — `send-phone-otp` route still exists, `verifyPhone()` still expects `code` parameter

- [ ] **Step 3: Commit**

```bash
git add tests/Feature/PhoneVerificationTest.php
git commit -m "test: rewrite phone verification tests for direct linking"
```

---

### Task 2: Remove send-phone-otp Route

**Files:**
- Modify: `routes/web.php:123`

- [ ] **Step 1: Delete the send-phone-otp route line**

In `routes/web.php`, line 123:
```php
Route::post('/send-phone-otp', [SocialAuthController::class, 'sendPhoneOtp'])->name('send-phone-otp');
```

Delete this line entirely.

- [ ] **Step 2: Verify route is gone**

Run: `php artisan route:list --name=customer.send-phone-otp`
Expected: No results

- [ ] **Step 3: Commit**

```bash
git add routes/web.php
git commit -m "refactor: remove send-phone-otp route"
```

---

### Task 3: Simplify SocialAuthController — Remove OTP Logic

**Files:**
- Modify: `app/Http/Controllers/Auth/SocialAuthController.php`

- [ ] **Step 1: Remove `sendPhoneOtp()` method**

Delete the entire `sendPhoneOtp` method (lines 152-161):
```php
public function sendPhoneOtp(Request $request, PhoneVerificationService $otpService): JsonResponse
{
    $validated = $request->validate([
        'phone' => ['required', 'string', 'regex:/^62[0-9]{9,13}$/'],
    ]);

    $otpService->sendOtp($request, $validated['phone']);

    return response()->json(['sent' => true]);
}
```

- [ ] **Step 2: Remove `PhoneVerificationService` import**

Delete line 9:
```php
use App\Services\PhoneVerificationService;
```

- [ ] **Step 3: Simplify `showVerifyPhone()` — remove OTP props**

Replace the method (lines 125-147) with:
```php
public function showVerifyPhone(Request $request): Response|RedirectResponse
{
    $user = $request->user();

    if (! $user || ! $user->isCustomer()) {
        return redirect()->route('customer.home');
    }

    if ($user->customer && $user->customer->phone) {
        return redirect()->route('customer.home');
    }

    return Inertia::render('customer/verify-phone', [
        'user' => [
            'name' => $user->name,
            'email' => $user->email,
            'avatar' => $user->avatar,
        ],
    ]);
}
```

- [ ] **Step 4: Rewrite `verifyPhone()` — direct link, no OTP**

Replace the entire `verifyPhone` method (lines 166-280) with:
```php
public function verifyPhone(Request $request): JsonResponse
{
    $validated = $request->validate([
        'phone' => ['required', 'string', 'regex:/^62[0-9]{9,13}$/'],
    ]);

    $phone = $validated['phone'];
    $user = $request->user();

    if (! $user) {
        return response()->json(['error' => 'Sesi tidak ditemukan.'], 401);
    }

    $result = DB::transaction(function () use ($user, $phone) {
        // Reject if phone already linked to another registered user
        $existing = Customer::where('phone', $phone)
            ->where('is_registered', true)
            ->where('user_id', '!=', $user->id)
            ->whereNotNull('user_id')
            ->lockForUpdate()
            ->first();

        if ($existing) {
            return ['status' => 'rejected', 'message' => 'Nomor HP sudah terdaftar dengan akun lain.'];
        }

        // Link unlinked guest customer
        $guestCustomer = Customer::where('phone', $phone)
            ->whereNull('user_id')
            ->lockForUpdate()
            ->first();

        if ($guestCustomer) {
            $registeredCustomer = $user->customer;

            if ($registeredCustomer) {
                // Reassign guest data to registered customer
                $guestCustomer->orders()->update(['customer_id' => $registeredCustomer->id]);
                $guestCustomer->addresses()->update(['customer_id' => $registeredCustomer->id]);
                $guestCustomer->recipients()->update(['customer_id' => $registeredCustomer->id]);
                $guestCustomer->favorites()->update(['customer_id' => $registeredCustomer->id]);
                \App\Models\Notification::where('customer_id', $guestCustomer->id)->update(['customer_id' => $registeredCustomer->id]);
                \App\Models\OrderReport::where('customer_id', $guestCustomer->id)->update(['customer_id' => $registeredCustomer->id]);
                $guestCustomer->delete();
            } else {
                $guestCustomer->linkToUser($user);
            }

            return ['status' => 'linked', 'message' => 'Akun berhasil dihubungkan. Riwayat pesanan Anda tersedia.'];
        }

        // Update or create registered customer with phone
        $registeredCustomer = $user->customer;

        if ($registeredCustomer && ! $registeredCustomer->phone) {
            $registeredCustomer->update(['phone' => $phone]);
        } elseif (! $registeredCustomer) {
            Customer::create([
                'name' => $user->name,
                'phone' => $phone,
                'email' => $user->email,
                'is_registered' => true,
                'user_id' => $user->id,
            ]);
        }

        app(GuestOrderMerger::class)->merge($user);

        return ['status' => 'created', 'message' => 'Nomor HP berhasil dihubungkan.'];
    });

    if ($result['status'] === 'rejected') {
        return response()->json(['error' => $result['message']], 422);
    }

    $redirectUrl = $request->session()->pull('redirect_after_login', route('customer.home'));

    return response()->json([
        'verified' => true,
        'status' => $result['status'],
        'message' => $result['message'],
        'redirect' => $redirectUrl,
    ]);
}
```

- [ ] **Step 5: Run tests**

Run: `php artisan test tests/Feature/PhoneVerificationTest.php`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/Auth/SocialAuthController.php
git commit -m "refactor: remove OTP logic, direct phone linking"
```

---

### Task 4: Delete PhoneVerificationService

**Files:**
- Delete: `app/Services/PhoneVerificationService.php`

- [ ] **Step 1: Verify no other references**

Run: `grep -r "PhoneVerificationService" --include="*.php" app/`
Expected: No results (controller no longer imports it)

- [ ] **Step 2: Delete the file**

```bash
rm app/Services/PhoneVerificationService.php
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: delete PhoneVerificationService (no longer needed)"
```

---

### Task 5: Rewrite verify-phone.tsx — Direct Phone Confirm

**Files:**
- Rewrite: `resources/js/pages/customer/verify-phone.tsx`

- [ ] **Step 1: Replace verify-phone page**

```tsx
import { useState, useCallback } from 'react';
import { router } from '@inertiajs/react';
import PhoneInput from '@/components/ui/phone-input';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

interface Props {
    user: { name: string; email: string; avatar?: string };
}

export default function VerifyPhone() {
    const [phone, setPhone] = useState('');
    const [step, setStep] = useState<'phone' | 'confirm' | 'done'>('phone');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const csrf = () => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

    const submitPhone = useCallback(async () => {
        if (!phone || phone.length < 9) {
            setError('Nomor HP tidak valid');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await fetch('/customer/verify-phone', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': csrf(),
                },
                body: JSON.stringify({ phone: `62${phone}` }),
            });

            const data = await res.json();

            if (res.ok && data.verified) {
                setStep('done');
                if (data.redirect) {
                    setTimeout(() => router.visit(data.redirect), 1500);
                }
            } else {
                setError(data.error || 'Gagal menghubungkan nomor HP');
            }
        } catch {
            setError('Terjadi kesalahan. Coba lagi.');
        } finally {
            setLoading(false);
        }
    }, [phone]);

    const handleSubmit = useCallback(() => {
        if (step === 'phone') {
            if (!phone || phone.length < 9) {
                setError('Nomor HP tidak valid');
                return;
            }
            setError('');
            setStep('confirm');
        } else if (step === 'confirm') {
            submitPhone();
        }
    }, [step, phone, submitPhone]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-surface px-4">
            <div className="w-full max-w-sm space-y-6">
                <div className="text-center">
                    <h1 className="text-xl font-semibold text-text">Hubungkan Nomor HP</h1>
                    <p className="mt-1 text-sm text-text-subtle">
                        {step === 'phone' && 'Masukkan nomor HP untuk mengelola pesanan'}
                        {step === 'confirm' && 'Pastikan nomor HP sudah benar'}
                        {step === 'done' && 'Nomor HP berhasil dihubungkan!'}
                    </p>
                </div>

                {step === 'phone' && (
                    <div className="space-y-4">
                        <PhoneInput
                            label="Nomor HP"
                            value={phone}
                            onChange={setPhone}
                            placeholder="81234567890"
                            error={error}
                            required
                        />

                        <button
                            onClick={handleSubmit}
                            disabled={loading || !phone}
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                        >
                            Lanjutkan
                        </button>
                    </div>
                )}

                {step === 'confirm' && (
                    <div className="space-y-4">
                        <div className="rounded-lg border border-border bg-surface-muted p-4 text-center">
                            <p className="text-sm text-text-subtle">Nomor HP Anda:</p>
                            <p className="mt-1 text-lg font-semibold text-text">+62 {phone}</p>
                        </div>

                        {error && <p className="text-center text-sm text-danger">{error}</p>}

                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                        >
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            Ya, Hubungkan
                        </button>

                        <button
                            onClick={() => {
                                setStep('phone');
                                setError('');
                            }}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text hover:bg-surface-muted"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Ganti Nomor
                        </button>
                    </div>
                )}

                {step === 'done' && (
                    <div className="flex flex-col items-center gap-3">
                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                        <p className="text-sm text-text">Nomor HP berhasil dihubungkan</p>
                    </div>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Verify no unused imports**

Check that `OtpInput`, `MessageCircle`, `useEffect` are no longer imported.

- [ ] **Step 3: Commit**

```bash
git add resources/js/pages/customer/verify-phone.tsx
git commit -m "refactor: simplify verify-phone page, remove OTP steps"
```

---

### Task 6: Run Full Test Suite & Lint

- [ ] **Step 1: Run phone verification tests**

Run: `php artisan test tests/Feature/PhoneVerificationTest.php`
Expected: All PASS

- [ ] **Step 2: Run full test suite**

Run: `php artisan test`
Expected: All PASS (no regressions)

- [ ] **Step 3: Run Pint (PHP linter)**

Run: `vendor/bin/pint`
Expected: No changes needed (or auto-fix applied)

- [ ] **Step 4: Run frontend lint/typecheck**

Run: `npm run lint && npm run typecheck` (or `pnpm lint && pnpm typecheck`)
Expected: No errors

- [ ] **Step 5: Commit any lint fixes**

```bash
git add -A
git commit -m "style: lint fixes"
```

---

### Task 7: Manual Smoke Test

- [ ] **Step 1: Test the flow manually**

1. Login with Google (user without phone)
2. Should redirect to `/customer/verify-phone`
3. Enter phone number → click "Lanjutkan"
4. See confirmation screen with phone number
5. Click "Ya, Hubungkan"
6. See success screen → auto redirect to home
7. Check `customers` table — phone should be set

- [ ] **Step 2: Test rejection flow**

1. Login as User A (has phone linked)
2. Login as User B (no phone)
3. Try to link User A's phone number as User B
4. Should see error: "Nomor HP sudah terdaftar dengan akun lain."

- [ ] **Step 3: Test guest order merge**

1. Create guest order with phone 6281234567890
2. Login with Google (no phone)
3. Link phone 6281234567890
4. Guest order should now belong to logged-in user

---

## Summary

| Task | Files | Est. Time |
|------|-------|-----------|
| 1. Write failing tests | 1 file | 5 min |
| 2. Remove route | 1 file | 2 min |
| 3. Simplify controller | 1 file | 15 min |
| 4. Delete service | 1 file | 2 min |
| 5. Rewrite frontend | 1 file | 10 min |
| 6. Test & lint | — | 5 min |
| 7. Smoke test | — | 5 min |
| **Total** | **5 files** | **~45 min** |

---

## What's Removed

- `PhoneVerificationService` class (entire file)
- `sendPhoneOtp()` method from controller
- `send-phone-otp` route
- OTP session state (code, expires, attempts)
- GOWA dependency for phone verification
- OTP input step in frontend

## What's Kept

- `GowaService` — for future WhatsApp order notifications
- `OtpInput` component — reusable UI component
- `PhoneInput` component — reused in simplified flow
- Guest order merging logic
- Phone number validation regex
- All existing security checks (lockForUpdate, registered user rejection)
