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
    - Find user STRICT: `Outlet->user` or `User where outlet_id = outlet.id` or `user_id`. If not found → throw `ModelNotFoundException` → controller returns 422 "Akun outlet tidak ditemukan, hubungi support".
    - NO stealth creation. Fail explicitly.
    - Hash new password, `must_change_password=true`
    - Do NOT touch `is_active` (reset password must not change active status)
    - Invalidate remember-me: `remember_token = Str::random(60)` (driver agnostic, no raw DB)
    - Transactional, no raw `DB::table('sessions')` query.

- `OutletController`:
  - New method `resetPassword(Request $request, Outlet $outlet, OutletProvisioningService $provisioning, OutletAuditService $audit)`
  - Middleware: already in `owner` group `role:owner`
  - Validate: outlet not archived, else 422. User must exist, else 422 explicit.
  - Call service, audit log, redirect `back()->with('outlet_provisioning', $credentials)->with('success', ...)`
  - Session invalidation: rely on `must_change_password` + `remember_token` rotation (driver agnostic). Existing sessions remain valid until next request but will be forced to `/password/change` due to `must_change_password` check. No raw DB session delete (would break Redis).

- `OutletAuditService`:
  - Existing `log()` used: `log(outlet, 'password', '***', 'reset_by_owner:{ownerId}', authUser)`
  - No plain password stored.

- Routes:
  - `POST /owner/outlets/{outlet}/reset-password` name `owner.outlets.reset-password` middleware `throttle:10,1`

## Data Flow
1. Owner GET `/owner/outlets/{id}` → props: outlet (including `user.email`, `user.is_active`, `user.must_change_password`), auditLogs, settlementSummary.
2. Click Reset → confirm dialog → POST reset-password + CSRF.
3. BE transaction:
   - Find user STRICT, if not found → 422 explicit "Akun outlet tidak ditemukan..."
   - Set password = hash(new), `must_change_password=true`, rotate `remember_token = Str::random(60)` (driver agnostic invalidation of remember-me, no raw DB session delete)
   - Do NOT modify `is_active`
4. Audit log insert.
5. Redirect back with flash `outlet_provisioning` = same shape as create: `{outlet_name, email, temporary_password, must_change_password}`
6. FE detects flash → shows `OutletProvisioningSummary` modal (copy button).
7. Owner shares temp password to outlet via WA (manual).
8. Outlet login with email + temp → `EnsurePasswordChanged` middleware redirects to `/password/change` → must change.
9. Outlet changes password → `must_change_password=false`. Existing sessions (if any) on other devices will be forced to change password on next request due to `must_change_password` check; remember-me cookies invalid via token rotation. No raw `sessions` table query (Redis compatible).

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
- If outlet has no user: FAIL explicitly → 422 "Akun outlet tidak ditemukan. Buat ulang outlet atau hubungi support." No stealth creation.
- Reset password MUST NOT modify `is_active`. If account is inactive, it stays inactive; owner must activate separately.
- Force logout (driver agnostic): rotate `remember_token = Str::random(60)` → invalidates remember-me cookies. Do NOT use raw `DB::table('sessions')` delete (breaks Redis). Existing active sessions remain but will hit `must_change_password=true` check and be forced to `/password/change` on next request. This is compatible with file, database, redis, dynamodb session drivers.
- No email sending (fake domain).

## Testing Plan
- Feature test `OutletPasswordResetTest` (new):
  - Owner can reset active outlet → 302, flash exists, password changed, must_change_password true, remember_token rotated (not null, different), audit log exists, is_active unchanged.
  - Archived outlet cannot reset → 422.
  - Non-owner (outlet/courier/customer) cannot reset → 403.
  - Outlet without user → FAIL 422 explicit "Akun outlet tidak ditemukan", no user created.
  - Temp password format: /^DMB-[A-Z0-9]{8}$/
  - Reset does NOT re-activate inactive user (is_active stays false).
  - Old password cannot login after reset.
  - remember_token rotated (driver agnostic check, no DB sessions table query).
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
