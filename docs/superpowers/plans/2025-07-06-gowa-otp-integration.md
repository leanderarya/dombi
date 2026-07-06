# GOWA OTP Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate GOWA (WhatsApp REST API) as OTP channel for guest→registered user phone verification, enabling guest order cancellation via track page.

**Architecture:** Laravel `GowaService` sends OTP via GOWA HTTP API. `PhoneVerificationService` updated to use `GowaService`. Frontend `verify-phone.tsx` page + OTP input component. Track page shows "Verifikasi HP" prompt when user is authenticated but phone not linked.

**Tech Stack:** Laravel 11, React/Inertia, Laravel HTTP client, GOWA REST API

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `config/services.php` | Modify | Add GOWA config (base URL, API key) |
| `.env.example` | Modify | Add `GOWA_BASE_URL`, `GOWA_API_KEY` |
| `app/Services/GowaService.php` | **Create** | HTTP client for GOWA send message API |
| `app/Services/PhoneVerificationService.php` | Modify | Use GowaService for OTP delivery |
| `routes/web.php` | Modify | Register verify-phone routes |
| `resources/js/components/ui/otp-input.tsx` | **Create** | 6-digit OTP input component |
| `resources/js/pages/customer/verify-phone.tsx` | **Create** | Phone verification page |
| `resources/js/pages/track.tsx` | Modify | Add "Verifikasi HP" prompt |
| `tests/Feature/PhoneVerificationTest.php` | **Create** | E2E test for OTP flow |
| `tests/Unit/GowaServiceTest.php` | **Create** | Unit test for GOWA client |

---

### Task 1: GowaService — HTTP Client

**Files:**
- Create: `app/Services/GowaService.php`
- Modify: `config/services.php`
- Modify: `.env.example`

- [ ] **Step 1: Add GOWA config to `config/services.php`**

```php
// Add after 'google' => [ ... ] block:
'gowa' => [
    'base_url' => env('GOWA_BASE_URL', 'http://localhost:3000'),
    'api_key' => env('GOWA_API_KEY'),
],
```

- [ ] **Step 2: Add env vars to `.env.example`**

```
GOWA_BASE_URL=http://localhost:3000
GOWA_API_KEY=
```

- [ ] **Step 3: Create `app/Services/GowaService.php`**

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GowaService
{
    private string $baseUrl;
    private string $apiKey;

    public function __construct()
    {
        $this->baseUrl = rtrim(config('services.gowa.base_url'), '/');
        $this->apiKey = config('services.gowa.api_key', '');
    }

    /**
     * Send text message via GOWA.
     *
     * @param string $phone  Recipient phone in format 628xxxxxxxxxx
     * @param string $message Message text
     * @return bool  True if sent successfully
     */
    public function sendText(string $phone, string $message): bool
    {
        try {
            $response = Http::withHeaders(array_filter([
                'Authorization' => $this->apiKey ? "Bearer {$this->apiKey}" : null,
            ]))
                ->timeout(10)
                ->post("{$this->baseUrl}/send/message", [
                    'phone' => $phone,
                    'message' => $message,
                ]);

            if ($response->successful()) {
                Log::info('GOWA message sent', ['phone' => $phone]);
                return true;
            }

            Log::error('GOWA send failed', [
                'phone' => $phone,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            return false;
        } catch (\Throwable $e) {
            Log::error('GOWA send exception', [
                'phone' => $phone,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Check if a phone number is reachable via WhatsApp.
     * Useful to verify user has started chat with bot.
     */
    public function isRegistered(string $phone): bool
    {
        try {
            $response = Http::withHeaders(array_filter([
                'Authorization' => $this->apiKey ? "Bearer {$this->apiKey}" : null,
            ]))
                ->timeout(10)
                ->get("{$this->baseUrl}/user/check", [
                    'phone' => $phone,
                ]);

            return $response->successful();
        } catch (\Throwable $e) {
            Log::error('GOWA check exception', ['phone' => $phone, 'error' => $e->getMessage()]);
            return false;
        }
    }
}
```

- [ ] **Step 4: Verify config loads**

Run: `php artisan tinker --execute="dd(config('services.gowa'));"`

- [ ] **Step 5: Commit**

```bash
git add app/Services/GowaService.php config/services.php .env.example
git commit -m "feat: add GowaService HTTP client for WhatsApp OTP"
```

---

### Task 2: Update PhoneVerificationService — GOWA Integration

**Files:**
- Modify: `app/Services/PhoneVerificationService.php`

- [ ] **Step 1: Read current PhoneVerificationService**

Current `sendOtp()` only logs OTP. Need to add GOWA delivery.

- [ ] **Step 2: Update `sendOtp()` method**

Replace the `sendOtp` method (currently at line 32):

```php
public function sendOtp(string $phone): bool
{
    $code = str_pad((string) random_int(0, 10 ** self::OTP_LENGTH - 1), self::OTP_LENGTH, '0', STR_PAD_LEFT);

    session()->put([
        'phone_verification.code' => $code,
        'phone_verification.expires_at' => now()->addSeconds(self::OTP_TTL_SECONDS),
        'phone_verification.phone' => $phone,
        'phone_verification.attempts' => 0,
    ]);

    $message = "Kode verifikasi Dombi Anda: {$code}\n\nBerlaku selama " . (self::OTP_TTL_SECONDS / 60) . " menit. Jangan bagikan kode ini ke siapa pun.";

    $sent = app(GowaService::class)->sendText($phone, $message);

    if (! $sent && app()->isLocal()) {
        Log::info("OTP code for {$phone}: {$code}");
        return true;
    }

    return $sent;
}
```

Add import at top:
```php
use App\Services\GowaService;
```

- [ ] **Step 3: Verify method signature unchanged**

`sendOtp(string $phone): bool` — same signature, callers unchanged.

- [ ] **Step 4: Commit**

```bash
git add app/Services/PhoneVerificationService.php
git commit -m "feat: send OTP via GOWA instead of log-only"
```

---

### Task 3: Register Routes

**Files:**
- Modify: `routes/web.php`

- [ ] **Step 1: Add phone verification routes**

Add inside the `customer.inertia` + `enforce.session` group, in the `auth` middleware group:

```php
Route::middleware('auth')->group(function () {
    Route::get('/customer/verify-phone', [Auth\SocialAuthController::class, 'showVerifyPhone'])->name('customer.verify-phone.show');
    Route::post('/customer/send-phone-otp', [Auth\SocialAuthController::class, 'sendPhoneOtp'])->name('customer.send-phone-otp');
    Route::post('/customer/verify-phone', [Auth\SocialAuthController::class, 'verifyPhone'])->name('customer.verify-phone');
});
```

- [ ] **Step 2: Verify routes registered**

Run: `php artisan route:list --name=customer.verify`
Expected: 3 routes listed

- [ ] **Step 3: Commit**

```bash
git add routes/web.php
git commit -m "feat: register phone verification routes"
```

---

### Task 4: OTP Input Component

**Files:**
- Create: `resources/js/components/ui/otp-input.tsx`

- [ ] **Step 1: Create OTP input component**

```tsx
import { useRef, useState, KeyboardEvent, ClipboardEvent } from 'react';

interface OtpInputProps {
    length?: number;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    disabled?: boolean;
}

export function OtpInput({ length = 6, value, onChange, error, disabled }: OtpInputProps) {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const [focusedIndex, setFocusedIndex] = useState(0);

    const handleChange = (index: number, digit: string) => {
        if (disabled) return;
        if (!/^\d*$/.test(digit)) return;

        const newValue = value.split('');
        newValue[index] = digit.slice(-1);
        const result = newValue.join('').slice(0, length);
        onChange(result);

        if (digit && index < length - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (disabled) return;
        if (e.key === 'Backspace' && !value[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
        if (disabled) return;
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
        onChange(pasted);
        const nextIndex = Math.min(pasted.length, length - 1);
        inputRefs.current[nextIndex]?.focus();
    };

    return (
        <div className="space-y-2">
            <div className="flex justify-center gap-2">
                {Array.from({ length }).map((_, i) => (
                    <input
                        key={i}
                        ref={(el) => { inputRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={value[i] || ''}
                        onChange={(e) => handleChange(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        onPaste={handlePaste}
                        onFocus={() => setFocusedIndex(i)}
                        disabled={disabled}
                        className={`h-12 w-10 rounded-lg border text-center text-lg font-semibold transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                            error ? 'border-red-500' : 'border-gray-300'
                        } ${disabled ? 'bg-gray-100 text-gray-400' : ''} ${
                            focusedIndex === i && !disabled ? 'border-blue-500' : ''
                        }`}
                        aria-label={`Digit ${i + 1}`}
                    />
                ))}
            </div>
            {error && <p className="text-center text-sm text-red-500">{error}</p>}
        </div>
    );
}
```

- [ ] **Step 2: Export from ui/index.ts**

Add to `resources/js/components/ui/index.ts`:
```ts
export { OtpInput } from './otp-input';
```

- [ ] **Step 3: Commit**

```bash
git add resources/js/components/ui/otp-input.tsx resources/js/components/ui/index.ts
git commit -m "feat: add OTP input component"
```

---

### Task 5: Verify Phone Page

**Files:**
- Create: `resources/js/pages/customer/verify-phone.tsx`

- [ ] **Step 1: Create verify-phone page**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { router } from '@inertiajs/react';
import { PhoneInput } from '@/components/ui/phone-input';
import { OtpInput } from '@/components/ui/otp-input';
import { ArrowLeft, Loader2, CheckCircle2, MessageCircle } from 'lucide-react';

interface Props {
    user: { id: number; name: string; email: string };
    otpLength: number;
    ttlSeconds: number;
}

export default function VerifyPhone({ user, otpLength, ttlSeconds }: Props) {
    const [phone, setPhone] = useState('');
    const [step, setStep] = useState<'phone' | 'otp' | 'done'>('phone');
    const [code, setCode] = useState('');
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState('');
    const [countdown, setCountdown] = useState(0);

    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
        return () => clearInterval(timer);
    }, [countdown]);

    const sendOtp = useCallback(async () => {
        if (!phone || phone.length < 10) {
            setError('Nomor HP tidak valid');
            return;
        }

        setSending(true);
        setError('');

        try {
            const res = await fetch('/customer/send-phone-otp', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
                },
                body: JSON.stringify({ phone }),
            });

            const data = await res.json();

            if (res.ok && data.sent) {
                setStep('otp');
                setCountdown(ttlSeconds);
            } else {
                setError(data.message || 'Gagal mengirim kode OTP');
            }
        } catch {
            setError('Terjadi kesalahan. Coba lagi.');
        } finally {
            setSending(false);
        }
    }, [phone, ttlSeconds]);

    const verifyOtp = useCallback(async () => {
        if (code.length !== otpLength) return;

        setVerifying(true);
        setError('');

        try {
            const res = await fetch('/customer/verify-phone', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '',
                },
                body: JSON.stringify({ phone, code }),
            });

            const data = await res.json();

            if (res.ok && data.verified) {
                setStep('done');
                if (data.redirect) {
                    setTimeout(() => router.visit(data.redirect), 1500);
                }
            } else {
                setError(data.error || 'Kode OTP salah');
                setCode('');
            }
        } catch {
            setError('Terjadi kesalahan. Coba lagi.');
        } finally {
            setVerifying(false);
        }
    }, [code, phone, otpLength]);

    useEffect(() => {
        if (code.length === otpLength && step === 'otp') {
            verifyOtp();
        }
    }, [code, otpLength, step, verifyOtp]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
            <div className="w-full max-w-sm space-y-6">
                <div className="text-center">
                    <h1 className="text-xl font-semibold text-gray-900">Verifikasi Nomor HP</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        {step === 'phone' && 'Masukkan nomor HP untuk mengelola pesanan'}
                        {step === 'otp' && `Kode OTP telah dikirim ke WhatsApp ${phone}`}
                        {step === 'done' && 'Verifikasi berhasil!'}
                    </p>
                </div>

                {step === 'phone' && (
                    <div className="space-y-4">
                        <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                            <div className="flex items-start gap-2">
                                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                <p>Pastikan Anda sudah memulai chat dengan bot WhatsApp kami terlebih dahulu.</p>
                            </div>
                        </div>

                        <PhoneInput
                            label="Nomor HP"
                            value={phone}
                            onChange={setPhone}
                            placeholder="81234567890"
                            error={error}
                            required
                        />

                        <button
                            onClick={sendOtp}
                            disabled={sending || !phone}
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                            Kirim Kode OTP
                        </button>
                    </div>
                )}

                {step === 'otp' && (
                    <div className="space-y-4">
                        <OtpInput
                            length={otpLength}
                            value={code}
                            onChange={setCode}
                            error={error}
                            disabled={verifying}
                        />

                        {verifying && (
                            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Memverifikasi...
                            </div>
                        )}

                        <div className="text-center">
                            {countdown > 0 ? (
                                <p className="text-sm text-gray-400">Kirim ulang dalam {countdown}s</p>
                            ) : (
                                <button
                                    onClick={() => { setCode(''); sendOtp(); }}
                                    disabled={sending}
                                    className="text-sm text-blue-600 hover:underline"
                                >
                                    {sending ? 'Mengirim...' : 'Kirim ulang kode'}
                                </button>
                            )}
                        </div>

                        <button
                            onClick={() => { setStep('phone'); setCode(''); setError(''); }}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Ganti nomor
                        </button>
                    </div>
                )}

                {step === 'done' && (
                    <div className="flex flex-col items-center gap-3">
                        <CheckCircle2 className="h-12 w-12 text-green-500" />
                        <p className="text-sm text-gray-600">Nomor HP berhasil diverifikasi</p>
                    </div>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add resources/js/pages/customer/verify-phone.tsx
git commit -m "feat: add phone verification page"
```

---

### Task 6: Update Track Page — Verify Phone Prompt

**Files:**
- Modify: `resources/js/pages/track.tsx`

- [ ] **Step 1: Add verify phone prompt component**

After the existing `AccountPromotionBanner` component, add:

```tsx
function VerifyPhonePrompt() {
    return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
                <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="flex-1 space-y-2">
                    <div>
                        <h3 className="text-sm font-medium text-amber-900">Verifikasi HP untuk kelola pesanan</h3>
                        <p className="text-sm text-amber-700">
                            Verifikasi nomor HP Anda untuk dapat membatalkan dan mengelola pesanan ini.
                        </p>
                    </div>
                    <a
                        href="/customer/verify-phone"
                        className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
                    >
                        Verifikasi Sekarang
                    </a>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Import MessageCircle if not already imported**

Ensure `MessageCircle` is in the lucide-react imports.

- [ ] **Step 3: Show VerifyPhonePrompt in TrackPage**

In the `TrackPage` component, add before `AccountPromotionBanner`:

```tsx
{!canCancel && auth?.user && !order.customer?.user_id && <VerifyPhonePrompt />}
```

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/track.tsx
git commit -m "feat: show verify phone prompt on track page"
```

---

### Task 7: Tests

**Files:**
- Create: `tests/Unit/GowaServiceTest.php`
- Create: `tests/Feature/PhoneVerificationTest.php`

- [ ] **Step 1: Create GowaService unit test**

```php
<?php

namespace Tests\Unit;

use App\Services\GowaService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GowaServiceTest extends TestCase
{
    public function test_send_text_returns_true_on_success(): void
    {
        Http::fake(['*' => Http::response(['status' => 'sent'], 200)]);

        $service = new GowaService();
        $result = $service->sendText('6281234567890', 'Test message');

        $this->assertTrue($result);
    }

    public function test_send_text_returns_false_on_failure(): void
    {
        Http::fake(['*' => Http::response(['error' => 'forbidden'], 403)]);

        $service = new GowaService();
        $result = $service->sendText('6281234567890', 'Test message');

        $this->assertFalse($result);
    }

    public function test_send_text_returns_false_on_exception(): void
    {
        Http::fake(['*' => Http::throwException(new \Exception('Connection refused'))]);

        $service = new GowaService();
        $result = $service->sendText('6281234567890', 'Test message');

        $this->assertFalse($result);
    }
}
```

- [ ] **Step 2: Create PhoneVerification feature test**

```php
<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
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

    public function test_send_otp_returns_sent(): void
    {
        Http::fake(['*' => Http::response(['status' => 'sent'], 200)]);

        $user = User::factory()->create();
        Customer::create(['user_id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'is_registered' => true]);

        $this->actingAs($user)
            ->post('/customer/send-phone-otp', ['phone' => '6281234567890'])
            ->assertOk()
            ->assertJson(['sent' => true]);
    }

    public function test_verify_phone_links_customer(): void
    {
        Http::fake(['*' => Http::response(['status' => 'sent'], 200)]);

        $user = User::factory()->create();
        Customer::create(['user_id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'is_registered' => true]);

        $this->actingAs($user)
            ->post('/customer/send-phone-otp', ['phone' => '6281234567890'])
            ->assertOk();

        $code = session('phone_verification.code');

        $this->actingAs($user)
            ->post('/customer/verify-phone', ['phone' => '6281234567890', 'code' => $code])
            ->assertOk()
            ->assertJson(['verified' => true]);
    }

    public function test_verify_wrong_code_returns_422(): void
    {
        Http::fake(['*' => Http::response(['status' => 'sent'], 200)]);

        $user = User::factory()->create();
        Customer::create(['user_id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'is_registered' => true]);

        $this->actingAs($user)
            ->post('/customer/send-phone-otp', ['phone' => '6281234567890']);

        $this->actingAs($user)
            ->post('/customer/verify-phone', ['phone' => '6281234567890', 'code' => '000000'])
            ->assertStatus(422);
    }
}
```

- [ ] **Step 3: Run tests**

Run: `php artisan test tests/Unit/GowaServiceTest.php tests/Feature/PhoneVerificationTest.php`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add tests/Unit/GowaServiceTest.php tests/Feature/PhoneVerificationTest.php
git commit -m "test: add GowaService and phone verification tests"
```

---

### Task 8: Track Page Integration — Wire Up Verify Prompt

**Files:**
- Modify: `resources/js/pages/track.tsx`
- Modify: `app/Http/Controllers/TrackController.php`

- [ ] **Step 1: Verify auth prop is shared**

In `HandleInertiaRequests`, `auth` is already shared. Track page receives `auth.user`.

- [ ] **Step 2: Add state check in TrackPage**

In the `TrackPage` component, add:

```tsx
const needsPhoneVerify = !!auth?.user && !canCancel && !!order?.customer && !order.customer.user_id;
```

- [ ] **Step 3: Show VerifyPhonePrompt**

Insert before cancel button section:

```tsx
{needsPhoneVerify && <VerifyPhonePrompt />}
```

- [ ] **Step 4: Test manually**

1. Create guest order
2. Login with Google (phone empty)
3. Visit `/track/{token}`
4. Should see "Verifikasi HP untuk kelola pesanan" prompt
5. Click → goes to `/customer/verify-phone`

- [ ] **Step 5: Commit**

```bash
git add resources/js/pages/track.tsx
git commit -m "feat: wire up verify phone prompt on track page"
```

---

## Summary

| Task | Files | Est. Time |
|------|-------|-----------|
| 1. GowaService | 3 files | 15 min |
| 2. PhoneVerificationService | 1 file | 10 min |
| 3. Routes | 1 file | 5 min |
| 4. OTP Input | 2 files | 15 min |
| 5. Verify Phone Page | 1 file | 25 min |
| 6. Track Page Prompt | 1 file | 10 min |
| 7. Tests | 2 files | 20 min |
| 8. Track Integration | 2 files | 10 min |
| **Total** | **13 files** | **~2 jam** |

---

## GOWA Setup Notes

GOWA needs to run as persistent process (Go binary). Options:

- **Hostinger VPS** (~$5-8/bulan)
- **DigitalOcean/Hetzner** (~$4-5/bulan)
- **Docker Compose** (recommended)

Setup steps:
1. `docker-compose up -d` with GOWA image
2. Scan QR code via WhatsApp mobile to link device
3. Set `GOWA_BASE_URL` and `GOWA_API_KEY` in Laravel `.env`
4. Test: `curl -X POST http://localhost:3000/send/message -d '{"phone":"628xxx","message":"test"}'`

**Important:** User must start chat with bot WA number first (`/start` or any message) before OTP can be delivered.
