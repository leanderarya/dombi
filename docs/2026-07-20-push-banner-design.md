# Push Notification Prompt Banner — Design Spec

**Tujuan:** Mengajak customer mengaktifkan push notification di momen yang tepat.
**Lokasi:** Home page + Halaman konfirmasi order.
**Platform:** iOS PWA, Android PWA, Chrome desktop — semua browser support push.

---

## Komponen: `PushBanner`

**File:** `resources/js/components/shared/push-banner.tsx`

Props:
- `variant: 'home' | 'confirm'` — menentukan lokasi tampilan
- `onDismiss?: () => void` — callback dismiss (home variant only)

Hook: `usePushSubscription()` — `pushState` + `requestEnable`

```
pushState ─┬─ active/hidden ─── render null
           ├─ unsupported ─── render null
           ├─ loading ──── show button "Aktifkan Notifikasi"
           └─ denied ──── show static text "Notifikasi dimatikan"
```

---

## Layout & Posisi

### Home Page

**Lokasi:** Setelah `<GreetingCard />` (atau setelah `<PhoneBanner />` jika tampil), sebelum `<QuickActions />`.

**Tampilan:**
```
┌──────────────────────────────────────────────┐
│  🔔   Dapatkan info pesanan real-time        ✕ │
│       [Aktifkan Notifikasi]                    │
└──────────────────────────────────────────────┘
```

- Background: `bg-white` with border
- Padding: `p-3`
- Border radius: `rounded-xl`
- Tombol "✕" dismiss → simpan `localStorage dombi_push_banner_home_dismissed`
- Kalau `pushState` jadi `active` → banner hilang otomatis

### Halaman Konfirmasi Order

**Lokasi:** Setelah status card "Pembayaran Berhasil" (setelah div `rounded-2xl border ... p-6`), sebelum action buttons.

**Tampilan (loading):**
```
┌──────────────────────────────────────────────┐
│  📦   Pantau pesananmu secara real-time       │
│       [Aktifkan Notifikasi]                    │
└──────────────────────────────────────────────┘
```

- Background: `bg-emerald-50` with `border-emerald-200`
- Padding: `p-4`
- Border radius: `rounded-2xl`
- Tidak dismissible — hilang otomatis kalau `pushState` jadi `active`

**Tampilan (denied):**
```
┌──────────────────────────────────────────────┐
│  🔕   Notifikasi dimatikan                    │
│       Aktifkan lewat Settings iPhone          │
└──────────────────────────────────────────────┘
```

**Tampilan (active):**
```
┌──────────────────────────────────────────────┐
│  ✅   Notifikasi aktif ✓                       │
└──────────────────────────────────────────────┘
```

### Guest users
Jika `!isLoggedIn`, banner tidak muncul di confirm page (guest tidak punya User → push subscription tidak mungkin).

---

## File Modified

### New file
- `resources/js/components/shared/push-banner.tsx`

### Modified files
- `resources/js/pages/customer/home.tsx` — tambah `<PushBanner variant="home" />`
- `resources/js/pages/customer/orders/confirm.tsx` — tambah `<PushBanner variant="confirm" />`

---

## Behavior Details

1. `requestEnable()` dipanggil dari user gesture (tombol "Aktifkan Notifikasi")
2. Kalau sukses:
   - `pushState` jadi `active`
   - Banner di home: hilang otomatis (render null)
   - Banner di confirm: berubah jadi "Notifikasi aktif ✓"
3. Kalau gagal (denied):
   - `pushState` jadi `denied`
   - Banner berubah jadi teks "Notifikasi dimatikan"
   - Di home: tetap bisa di-dismiss dengan "✕"
4. Dismiss home banner: simpan `localStorage dombi_push_banner_home_dismissed` → tidak muncul lagi (sampai user buka Settings dan enable notifikasi sendiri)

```
ponytail: Upgrade denied state di confirm page jadi link ke iOS Settings guide ketika >5% user di iOS deny.
```
