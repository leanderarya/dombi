# Spec: Owner Reset Password Outlet — Temp Password One-Time View

Date: 2026-07-23
Status: Approved
Author: brainstorming + owner
Context: Owner belum punya mekanisme reset password outlet. Outlet pakai email fake @dombi.local + password DMB-XXXX + must_change_password. Lupa password = tidak bisa login.

## Problem
- Outlet account creation generates fake email + temp password, visible only once via flash `outlet_provisioning`.
- No UI/API for owner to reset when outlet forgets password.
- Email reset impossible (fake domain).
- Need owner-driven reset with audit log, force logout, must_change_password.

## Goals
- Owner can reset outlet password from detail page.
- Generate new temp password `DMB-XXXXXXXX` (existing generator), set `must_change_password=true`, invalidate old sessions.
- Show credentials once in modal (copyable), not stored plain.
- Audit log who reset, when.
- Non-goal: self-service WA OTP (future iteration), email reset, expiry logic.

## Architecture & Components
- `OutletProvisioningService`:
  - `generateTemporaryPassword(): string` existing → reuse
  - New: `resetOutletPassword(Outlet $outlet): array { user, credentials }`
    - Find user by `outlet->user_id` or `User where outlet_id = outlet.id`
    - If not exists: create new user (same as create flow, email `generateOutletEmail`, name `generateAccountName`)
    - Hash new password, `must_change_password=true`, `is_active=true`, `remember_token=null`
    - Transactional

- `OutletController`:
  - New method `resetPassword(Request $request, Outlet $outlet, OutletProvisioningService $provisioning, OutletAuditService $audit)`
  - Middleware: already in `owner` group `role:owner`
  - Validate: outlet not archived, else 422
  - Call service, audit log, redirect `back()->with('outlet_provisioning', $credentials)->with('success', ...)`

- `OutletAuditService`:
  - Existing `log()` used: `log(outlet, 'password', '***', 'reset_by_owner:{ownerId}', authUser)`
  - No plain password stored.

- Routes:
  - `POST /owner/outlets/{outlet}/reset-password` name `owner.outlets.reset-password` middleware `throttle:10,1`

## Data Flow
1. Owner GET `/owner/outlets/{id}` → props: outlet (including `user.email`, `user.is_active`, `user.must_change_password`), auditLogs, settlementSummary.
2. Click Reset → confirm dialog → POST reset-password + CSRF.
3. BE transaction: find/create user, set password, must_change_password=true, remember_token=null, is_active=true.
4. Audit log insert.
5. Redirect back with flash `outlet_provisioning` = same shape as create: `{outlet_name, email, temporary_password, must_change_password}`
6. FE detects flash → shows `OutletProvisioningSummary` modal (copy button).
7. Owner shares temp password to outlet via WA (manual).
8. Outlet login with email + temp → `EnsurePasswordChanged` middleware (existing) redirects to `/password/change` → must change.
9. Outlet changes password → `must_change_password=false`, session valid, old sessions invalid due to password hash change + remember_token null.

## UI / Frontend
- File: `resources/js/pages/owner/outlets/show.tsx`
  - New card "Akun Operasional" below outlet info / above settlement:
    - Email Operasional: `outlet.user.email` or `outlet-{slug}@dombi.local` fallback
    - Status Akun: Aktif/Nonaktif badge
    - Wajib Ganti Password: badge
    - Button: "Reset Password" (Key icon, variant outline, destructive hover), disabled if status archived.
  - Confirm modal: shadcn AlertDialog — title "Reset password {outlet.name}?", description: consequences (logout paksa, wajib ganti).
  - Success: reuse `OutletProvisioningSummary` component — already expects `flash.outlet_provisioning` in index, add same handling in show.tsx (read `usePage().props.flash.outlet_provisioning`).
  - Error handling: flash error if archived, etc.

- Component reuse:
  - `OutletProvisioningSummary` already shows once, copyable.

## Security & Error Handling
- Authorization: owner only (route group).
- Throttle 10/min to prevent spam.
- Password never logged plain, only flash once.
- Audit log masks values.
- Archived outlet cannot be reset → 422 + flash error "Outlet sudah diarsipkan, tidak bisa reset password".
- If outlet has no user: create new user, same as provisioning (covers legacy data).
- Force logout: `remember_token = null` + password hash change → Laravel invalidates other sessions via `Auth` (session guard depends on password hash if using `logoutOtherDevices`? We do manual: remember_token null clears remember-me, and password change invalidates sessions if using `hash` driver? To be safe, also `DB::table('sessions')->where('user_id', $user->id)->delete()` if session driver is database, or rely on password change. Minimum: remember_token null + must_change_password true.
- No email sending (fake domain).

## Testing Plan
- Feature test `OutletPasswordResetTest` (new):
  - Owner can reset active outlet → 302, flash exists, password changed, must_change_password true, remember_token null, audit log exists.
  - Archived outlet cannot reset → 422 or error flash.
  - Non-owner (outlet/courier/customer) cannot reset → 403.
  - Outlet without user → reset creates user.
  - Temp password format: /^DMB-[A-Z0-9]{8}$/
  - Reset re-activates inactive user (is_active false → true).
  - Old temp password cannot login after reset.
- Manual QA:
  - Detail page shows akun operasional card.
  - Click reset → confirm → modal credentials appears → copy.
  - Login as outlet with temp → redirected to /password/change → change → login with new password success.

## Out of Scope / Future
- Self-service lupa password via phone/OTP WA.
- Temp password expiry 24h.
- Bulk reset.
- Sending password via WA API automatically.

## References
- `app/Services/OutletProvisioningService.php` (generateTemporaryPassword, createOutletWithAccount)
- `app/Http/Controllers/Owner/OutletController.php` (show, store)
- `resources/js/pages/owner/outlets/index.tsx` + `components/owner/outlet-provisioning-summary.tsx`
- `app/Http/Controllers/Auth/PasswordChangeController.php` (must_change_password flow)
- `app/Models/User.php` (must_change_password cast, outlet_id)
