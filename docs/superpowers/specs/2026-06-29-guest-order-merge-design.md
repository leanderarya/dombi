# Guest Order Merge & Tracking Design

## Problem

1. Guest bisa lihat semua orders (termasuk history) — seharusnya hanya active orders
2. Guest tidak bisa cancel pesanan — perlu UX yang mengarahkan ke login/register
3. Guest orders tidak ter-merge ke akun baru — saat guest register, orders tetap terpisah

## Solution

### 1. Guest Tracking → Active Only

**Backend:** `GuestOrderRecoveryService::recover()`
- Guest (no auth): hanya return `active_orders`, `recent_orders` = empty array
- Authenticated user: return keduanya (tidak berubah)

**Frontend:** Customer orders index
- Guest view: hanya tampilkan section "Pesanan Aktif"
- Tidak ada section "Riwayat" untuk guest

### 2. Merge Guest Orders ke Account

**Data model:**
- `Customer` punya `user_id` (null untuk guest)
- `Order` punya `customer_id`
- `User` hasOne `Customer`

**Merge logic:** `GuestOrderMerger::merge(User $user)`
1. Get user's phone
2. Find all `Customer` where `phone = $phone` AND `user_id = null`
3. For each: update `user_id = $user->id`, `is_registered = true`
4. Clear `guest_recovery` session

**Trigger points:**
- After Google login/register (`SocialAuthController`)
- After phone login/register
- After email register

### 3. Cancel UX untuk Guest

**Track page:**
- Guest: tampilkan banner "Ingin membatalkan? Masuk atau buat akun" dengan button
- Button → redirect ke login dengan `?redirect=/track/{token}`
- Setelah login → redirect back → tombol cancel muncul
- `canCancel` prop: `true` hanya jika authenticated

## Files to Modify

| # | File | Change |
|---|------|--------|
| 1 | `app/Services/GuestOrderRecoveryService.php` | Return active only for guest |
| 2 | `app/Services/GuestOrderMerger.php` | Create — merge guest customers |
| 3 | `app/Http/Controllers/Auth/SocialAuthController.php` | Call merger after login |
| 4 | `resources/js/pages/track.tsx` | Add login CTA for cancel |
| 5 | `resources/js/pages/customer/orders/index.tsx` | Hide history for guest |

## Success Criteria

1. Guest recovery hanya tampilkan active orders
2. Guest orders otomatis ter-merge saat user login/register
3. Track page tampilkan "Masuk untuk membatalkan" untuk guest
4. Setelah login, redirect kembali ke track page
5. Tombol cancel muncul setelah authenticated
