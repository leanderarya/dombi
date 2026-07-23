# Outlet Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner can reset outlet account password from outlet detail page — generates new temp DMB-XXXX, sets must_change_password=true, rotates remember_token (driver-agnostic), fails explicitly if user not found, does NOT toggle is_active, audit log, one-time modal.

**Architecture:** Extend `OutletProvisioningService` with strict `resetOutletPassword()` (no stealth user creation, no is_active change, rotate remember_token via Str::random). Add `resetPassword` method in `Owner\OutletController` + POST route. Frontend detail page `owner/outlets/show.tsx` gets new "Akun Operasional" card + AlertDialog confirm + reuse `OutletProvisioningSummary` flash.

**Tech Stack:** Laravel 11, Inertia.js React, PHP 8.3, Tailwind, Pest/PHPUnit

## Global Constraints
- Generate temp password format DMB-[A-Z0-9]{8} via existing `generateTemporaryPassword()` — no I,O,0,1 chars.
- If outlet has no user → FAIL explicitly 422 "Akun outlet tidak ditemukan" — NO stealth creation.
- Reset MUST NOT modify `is_active` — active status unchanged.
- Session invalidation driver-agnostic: rotate `remember_token = Str::random(60)` — NO raw `DB::table('sessions')` query (breaks Redis).
- Throttle 10 req/min on reset route.
- Password plain only in flash `outlet_provisioning` once, never logged.
- Audit log via `OutletAuditService::log()` masks password.
- Archived outlet cannot be reset.
- Only owner role can reset.

---

### Task 1: Backend Service — resetOutletPassword (strict, no is_active, driver-agnostic)

**Files:**
- Modify: `app/Services/OutletProvisioningService.php`
- Test: `tests/Feature/OutletPasswordResetTest.php` (partial)

**Interfaces:**
- Consumes: `Outlet`, `User`, `Str::random`, `Hash`
- Produces: `resetOutletPassword(Outlet $outlet): array { user: User, credentials: array, temporary_password: string }` — throws ModelNotFoundException if no user, does NOT touch is_active, rotates remember_token.

- [ ] **Step 1: Write failing test for service strictness (no user = fail)**

```php
// tests/Feature/OutletPasswordResetTest.php
public function test_reset_fails_when_no_user(): void
{
    $owner = User::factory()->create(['role' => 'owner']);
    $outlet = Outlet::factory()->create(['status' => 'active', 'user_id' => null]);

    $this->actingAs($owner)
        ->post(route('owner.outlets.reset-password', $outlet))
        ->assertStatus(422)
        ->assertSessionHasErrors(['user']);
}
```

- [ ] **Step 2: Run test to verify it fails (route not exists yet)**

Run: `php artisan test --filter=test_reset_fails_when_no_user`
Expected: FAIL 404 route not found or class not defined.

- [ ] **Step 3: Implement resetOutletPassword in OutletProvisioningService**

```php
// app/Services/OutletProvisioningService.php
use Illuminate\Support\Str;
use Illuminate\Database\Eloquent\ModelNotFoundException;

public function resetOutletPassword(Outlet $outlet): array
{
    $user = $outlet->user;
    if (!$user) {
        $user = User::where('outlet_id', $outlet->id)->first();
    }
    if (!$user) {
        throw new ModelNotFoundException("Akun outlet tidak ditemukan untuk outlet ID {$outlet->id}");
    }

    return \Illuminate\Support\Facades\DB::transaction(function () use ($outlet, $user): array {
        $newPassword = $this->generateTemporaryPassword();
        $user->forceFill([
            'password' => $newPassword, // cast 'hashed'
            'must_change_password' => true,
            'remember_token' => Str::random(60), // driver agnostic, invalidates remember-me
        ])->save();

        // Do NOT touch is_active

        $credentials = [
            'outlet_name' => $outlet->name,
            'email' => $user->email,
            'temporary_password' => $newPassword,
            'must_change_password' => true,
        ];

        return [
            'user' => $user->fresh(),
            'outlet' => $outlet->fresh(),
            'temporary_password' => $newPassword,
            'credentials' => $credentials,
        ];
    });
}
```

- [ ] **Step 4: Run test still fails (route missing) — OK, proceed**

- [ ] **Step 5: Commit service**

```bash
git add app/Services/OutletProvisioningService.php
git commit -m "feat: add strict resetOutletPassword - fail if no user, no is_active toggle, driver-agnostic token rotation"
```

---

### Task 2: Controller + Route + Audit

**Files:**
- Modify: `app/Http/Controllers/Owner/OutletController.php`
- Modify: `routes/web.php` (owner group)
- Test: `tests/Feature/OutletPasswordResetTest.php`

**Interfaces:**
- Consumes: `OutletProvisioningService::resetOutletPassword()`, `OutletAuditService::log()`
- Produces: `POST /owner/outlets/{outlet}/reset-password` → redirect back with flash `outlet_provisioning`

- [ ] **Step 1: Write failing test for successful reset**

```php
public function test_owner_can_reset_active_outlet_password(): void
{
    $owner = User::factory()->create(['role' => 'owner']);
    $outlet = Outlet::factory()->create(['status' => 'active']);
    $outletUser = User::factory()->create([
        'role' => 'outlet',
        'outlet_id' => $outlet->id,
        'email' => 'outlet-test@dombi.local',
        'is_active' => true,
        'must_change_password' => false,
        'remember_token' => 'oldtoken123',
    ]);
    $outlet->update(['user_id' => $outletUser->id]);
    $oldToken = $outletUser->remember_token;
    $oldActive = $outletUser->is_active;

    $response = $this->actingAs($owner)
        ->post(route('owner.outlets.reset-password', $outlet));

    $response->assertRedirect();
    $response->assertSessionHas('outlet_provisioning');
    $flash = session('outlet_provisioning');
    $this->assertMatchesRegularExpression('/^DMB-[A-Z0-9]{8}$/', $flash['temporary_password']);

    $outletUser->refresh();
    $this->assertTrue($outletUser->must_change_password);
    $this->assertNotEquals($oldToken, $outletUser->remember_token);
    $this->assertEquals($oldActive, $outletUser->is_active); // unchanged
    $this->assertNotNull($outletUser->remember_token);
    // not raw sessions query
}
```

- [ ] **Step 2: Run test → fails (method not exists)**

Run: `php artisan test --filter=test_owner_can_reset_active_outlet_password -v`
Expected: FAIL 404 route.

- [ ] **Step 3: Add route in web.php owner group**

In `routes/web.php` inside `Route::middleware(['auth', 'role:owner', 'password.changed'])->prefix('owner')` group, after `resource outlets`:

```php
Route::post('outlets/{outlet}/reset-password', [OwnerOutletController::class, 'resetPassword'])
    ->middleware('throttle:10,1')
    ->name('outlets.reset-password');
```

Place it BEFORE resource or after, but ensure not conflicting with resource show. After `archive` route is fine.

- [ ] **Step 4: Implement resetPassword method in OutletController**

```php
// app/Http/Controllers/Owner/OutletController.php
use Illuminate\Support\Facades\Log;
use Illuminate\Database\Eloquent\ModelNotFoundException;

public function resetPassword(Request $request, Outlet $outlet, OutletProvisioningService $provisioning, OutletAuditService $auditService): RedirectResponse
{
    if ($outlet->status === 'archived') {
        return back()->withErrors(['outlet' => 'Outlet sudah diarsipkan, tidak bisa reset password.']);
    }

    try {
        $result = $provisioning->resetOutletPassword($outlet);
    } catch (ModelNotFoundException $e) {
        return back()->withErrors(['user' => 'Akun outlet tidak ditemukan. Outlet ini belum memiliki akun operasional.']);
    }

    $auditService->log($outlet, 'password', '***', 'reset_by_owner:'.$request->user()->id, $request->user());

    return back()
        ->with('success', "Password outlet {$outlet->name} berhasil direset.")
        ->with('outlet_provisioning', $result['credentials']);
}
```

- [ ] **Step 5: Run tests**

Run: `php artisan test --filter=OutletPasswordResetTest`
Expected: PASS for reset success + fail when no user (Task1 test) + archived.

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/Owner/OutletController.php routes/web.php
git commit -m "feat: owner reset password endpoint - strict, throttle, audit, no is_active toggle"
```

---

### Task 3: Frontend — Akun Operasional Card + Confirm + Provisioning Modal in Show Page

**Files:**
- Modify: `resources/js/pages/owner/outlets/show.tsx`
- Check: `resources/js/components/owner/outlet-provisioning-summary.tsx` (reuse, no change)
- Modify: `app/Http/Controllers/Owner/OutletController.php show()` to include user relation

**Interfaces:**
- Consumes: `outlet.user.email`, `outlet.user.is_active`, `outlet.user.must_change_password`, `flash.outlet_provisioning`
- Produces: Card UI with Reset button + AlertDialog confirm → POST to `owner.outlets.reset-password`

- [ ] **Step 1: Update show() controller to load user**

In `show()` method, add:

```php
$outlet->load(['user:id,email,is_active,must_change_password,outlet_id']);
```

And ensure `$outlet` in Inertia props includes user. Already `outlet` is model serialized, so loaded relation will appear.

- [ ] **Step 2: Implement frontend card in show.tsx**

Add in `show.tsx` near top after outlet header, before inventoryHealth:

```tsx
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import OutletProvisioningSummary from '@/components/owner/outlet-provisioning-summary';

// Inside component:
const { flash } = usePage().props as any;
const [resetOpen, setResetOpen] = useState(false);
const user = outlet.user;

<Card className="p-4">
  <h3 className="text-sm font-semibold">Akun Operasional</h3>
  <div className="mt-2 text-xs">Email: {user?.email ?? '-'}</div>
  <div className="mt-1 text-xs">Status: {user?.is_active ? 'Aktif' : 'Nonaktif'}</div>
  <div className="mt-1 text-xs">Wajib Ganti: {user?.must_change_password ? 'Ya' : 'Tidak'}</div>
  <Button
    variant="outline"
    size="sm"
    className="mt-3"
    disabled={outlet.status === 'archived'}
    onClick={() => setResetOpen(true)}
  >
    <KeyRound className="h-4 w-4 mr-1" /> Reset Password
  </Button>
</Card>

{resetOpen && (
  <AlertDialog>
    <AlertDialogContent>
      <AlertDialogTitle>Reset password {outlet.name}?</AlertDialogTitle>
      <AlertDialogDescription>Akun akan logout paksa dan wajib ganti password saat login berikutnya. Password baru hanya tampil sekali.</AlertDialogDescription>
      <AlertDialogFooter>
        <Button variant="ghost" onClick={() => setResetOpen(false)}>Batal</Button>
        <Button variant="destructive" onClick={() => {
          setResetOpen(false);
          router.post(route('owner.outlets.reset-password', outlet.id), {}, { preserveScroll: true });
        }}>Ya, Reset</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
)}

<OutletProvisioningSummary provisioning={flash?.outlet_provisioning} />
```

Adapt to existing UI components (use Dialog, not AlertDialog if not available — check existing components).

- [ ] **Step 3: Build frontend**

Run: `npm run build`
Expected: built in ~8s

- [ ] **Step 4: Commit**

```bash
git add resources/js/pages/owner/outlets/show.tsx app/Http/Controllers/Owner/OutletController.php
git commit -m "feat: frontend akun operasional card + reset confirm + provisioning modal in outlet detail"
```

---

### Task 4: Full Feature Test Suite

**Files:**
- Modify: `tests/Feature/OutletPasswordResetTest.php` (complete)

**Interfaces:**
- Consumes: routes, controller, service
- Produces: 6-7 passing tests

- [ ] **Step 1: Write remaining tests**

```php
public function test_archived_outlet_cannot_be_reset(): void
{
    $owner = User::factory()->create(['role' => 'owner']);
    $outlet = Outlet::factory()->create(['status' => 'archived']);
    $user = User::factory()->create(['role' => 'outlet', 'outlet_id' => $outlet->id]);
    $outlet->update(['user_id' => $user->id]);

    $this->actingAs($owner)
        ->post(route('owner.outlets.reset-password', $outlet))
        ->assertSessionHasErrors(['outlet']);
}

public function test_non_owner_cannot_reset(): void
{
    $outletUser = User::factory()->create(['role' => 'outlet']);
    $outlet = Outlet::factory()->create(['status' => 'active', 'user_id' => $outletUser->id]);
    $outlet->update(['user_id' => $outletUser->id]);

    $this->actingAs($outletUser)
        ->post(route('owner.outlets.reset-password', $outlet))
        ->assertStatus(403);
}

public function test_reset_does_not_change_is_active(): void
{
    $owner = User::factory()->create(['role' => 'owner']);
    $outlet = Outlet::factory()->create(['status' => 'active']);
    $user = User::factory()->create(['role' => 'outlet', 'outlet_id' => $outlet->id, 'is_active' => false]);
    $outlet->update(['user_id' => $user->id]);

    $this->actingAs($owner)->post(route('owner.outlets.reset-password', $outlet));

    $this->assertFalse($user->fresh()->is_active);
}

public function test_old_password_invalid_after_reset(): void
{
    $owner = User::factory()->create(['role' => 'owner']);
    $outlet = Outlet::factory()->create(['status' => 'active']);
    $user = User::factory()->create([
        'role' => 'outlet',
        'outlet_id' => $outlet->id,
        'password' => 'old-password-123',
    ]);
    $outlet->update(['user_id' => $user->id]);

    $this->actingAs($owner)->post(route('owner.outlets.reset-password', $outlet));

    $this->assertFalse(\Illuminate\Support\Facades\Hash::check('old-password-123', $user->fresh()->password));
}

public function test_audit_log_created_on_reset(): void
{
    $owner = User::factory()->create(['role' => 'owner']);
    $outlet = Outlet::factory()->create(['status' => 'active']);
    $user = User::factory()->create(['role' => 'outlet', 'outlet_id' => $outlet->id]);
    $outlet->update(['user_id' => $user->id]);

    $this->actingAs($owner)->post(route('owner.outlets.reset-password', $outlet));

    $this->assertDatabaseHas('outlet_audit_logs', [
        'outlet_id' => $outlet->id,
        'field' => 'password',
    ]);
}
```

- [ ] **Step 2: Run all reset tests**

Run: `php artisan test --filter=OutletPasswordResetTest -v`
Expected: 7 PASS

- [ ] **Step 3: Run full suite to ensure no regression**

Run: `php artisan test 2>&1 | tail -5`
Expected: 798 tests pass (791 existing + 7 new)

- [ ] **Step 4: Commit tests**

```bash
git add tests/Feature/OutletPasswordResetTest.php
git commit -m "test: outlet password reset - strict fail, no is_active toggle, driver-agnostic token rotation, audit log"
```

---

### Task 5: Final Verification & Push

**Files:**
- All modified

- [ ] **Step 1: Build**

Run: `npm run build`

- [ ] **Step 2: Full test**

Run: `php artisan test`

- [ ] **Step 3: Push develop + main**

```bash
git push origin develop
git checkout main && git merge develop --no-edit && git push origin main && git checkout develop
```

## Self-Review
- Spec coverage: All 3 corrections applied (fail if no user, no is_active toggle, driver-agnostic token rotation). Tasks point to exact files.
- Placeholder scan: No TBD/TODO, all code blocks complete.
- Type consistency: `resetOutletPassword(Outlet $outlet): array`, credentials shape same as existing provisioning, route name `owner.outlets.reset-password` consistent in frontend `route()` helper, remember_token rotation via `Str::random(60)` (string, driver agnostic).
