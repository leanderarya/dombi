# Remove Recovery Verification

## Problem

Customer yang lupa token pemulihan DAN kode pesanan tidak bisa melacak pesanan. Mereka stuck di step verifikasi.

## Solution

Hapus step verifikasi dari recovery flow. Nomor HP sendiri sudah jadi bukti kepemilikan.

## Current Flow (3 steps)

1. Masukkan nomor HP
2. Verifikasi: minta Kode Pesanan atau Token Pemulihan
3. Tampilkan pesanan

## New Flow (2 steps)

1. Masukkan nomor HP
2. Langsung tampilkan pesanan

## Changes

### Backend

**File:** `app/Http/Controllers/Customer/RecoveryController.php` (or wherever recovery logic lives)

- Remove `requires_verification` response
- If phone matches orders, return orders directly

### Frontend

**File:** `resources/js/components/customer/recovery-sheet.tsx`

- Remove states: `needsVerification`, `lookupMode`, `credential`
- Remove functions: `handleVerify`, `switchMode`
- Remove UI: verification step (segmented control, credential input)
- Keep: phone input, `handleRecover`, error handling

### Risk Assessment

- Low risk: no sensitive data exposed (no full address, no payment info)
- Phone number is semi-public knowledge
- Only order status and items visible

## Files to Modify

| # | File | Change |
|---|------|--------|
| 1 | `app/Http/Controllers/Customer/RecoveryController.php` | Remove verification logic |
| 2 | `resources/js/components/customer/recovery-sheet.tsx` | Remove verification UI |
