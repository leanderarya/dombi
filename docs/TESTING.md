# Dombi — Testing Guide

Ringkasan project, arsitektur, cara testing 4 role, dan rekomendasi selanjutnya.

---

## 1. Project Overview

**Dombi** adalah operational commerce platform untuk distribusi produk segar harian dengan 4 role:

| Role | Deskripsi |
|------|----------|
| **Customer** | Belanja produk via app Android / PWA |
| **Outlet** | Kelola pesanan, stok, restock, settlement |
| **Owner** | Kelola produk, outlet, pricing, keuangan, kurir |
| **Courier** | Antar pesanan ke customer |

**Status:** Staging (v1 beta). 511 test passing, 38 model, 100+ komponen UI.

**Tech Stack:**
- Backend: Laravel 13, MySQL 8
- Frontend: React 19, TypeScript, Tailwind CSS v4, Inertia.js
- Mobile: Capacitor (Android APK)
- Payment: DOKU (QRIS, transfer, VA)
- Auth: Google OAuth + session-based
- Maps: Leaflet + OpenStreetMap
- Monitoring: Sentry

---

## 2. Arsitektur

```
┌─────────────────────────────────────────────────┐
│                  Customer App                    │
│  Android APK (Capacitor) / PWA Browser           │
│  React + Inertia.js                              │
└─────────────────┬───────────────────────────────┘
                  │ HTTPS
┌─────────────────▼───────────────────────────────┐
│              Laravel Backend                     │
│  staging.dombicenter.com                         │
│                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Customer │ │  Outlet  │ │ Owner + Courier  │ │
│  │ Controllers│ │Controllers│ │ Controllers      │ │
│  └──────────┘ └──────────┘ └──────────────────┘ │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │              MySQL Database              │   │
│  │  44 models, 100+ migrations              │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │           DOKU Payment Gateway           │   │
│  │  QRIS / Transfer / VA / COD              │   │
│  └──────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

**Flow Utama:**
1. Customer browse produk → tambah ke cart → checkout
2. Pilih pickup (ambil di outlet) atau delivery (diantar kurir)
3. Bayar via DOKU
4. Outlet konfirmasi → siapkan → serahkan ke kurir / customer pickup
5. Courier pickup → delivery → complete
6. Owner monitor semua + kelola pricing, stok, keuangan

---

## 3. Cara Testing

### URL
```
https://staging.dombicenter.com
```

### A. Customer

**Install APK:**
- Download `dombi-customer.apk` dari Desktop
- Install di Android (minimal Android 8)

**Flow Testing:**
1. **Welcome** → "Masuk dengan Google" (native Sign-In) atau "Lewati Tahap Ini" (guest mode)
2. **Home** → browse produk, pilih Produk / Outlet Terdekat / Riwayat Pesanan
3. **Produk** → tap produk → pilih variant → tambah ke cart
4. **Cart** → checkout → pilih Pickup atau Delivery
5. **Checkout** → isi info pengiriman → pilih metode bayar → bayar
6. **Tracking** → buka /customer/orders → lihat status pesanan

**Yang perlu dites:**
- [ ] Login Google
- [ ] Guest mode (tanpa login)
- [ ] Browse produk + filter
- [ ] Cart: tambah, ubah quantity, hapus
- [ ] Checkout: pickup
- [ ] Checkout: delivery
- [ ] Pembayaran DOKU (QRIS/transfer)
- [ ] Order tracking
- [ ] Riwayat pesanan
- [ ] Repeat order
- [ ] Favorit produk
- [ ] Alamat pengiriman
- [ ] Penerima

### B. Outlet

**Demo Account:**
```
Email: outlet@dombi.test
Password: password
```

**Flow Testing:**
1. Login di `/login` dengan kredensial outlet
2. **Dashboard** → lihat stats hari ini, pending orders
3. **Orders** → konfirmasi pesanan → siapkan → selesai pickup
4. **Inventory** → cek stok, stock opname
5. **Restock** → buat permintaan restock ke pusat
6. **Settlement** → lihat tagihan, upload bukti bayar
7. **Offline Sales** → catat penjualan offline
8. **Returns/Exchanges** → buat retur/penukaran

**Yang perlu dites:**
- [ ] Login outlet
- [ ] Dashboard stats
- [ ] Order lifecycle: confirm → prepare → ready → complete
- [ ] Assign courier ke order delivery
- [ ] Inventory monitoring
- [ ] Stock opname
- [ ] Restock request
- [ ] Settlement + upload bukti bayar
- [ ] Offline sale
- [ ] Return request
- [ ] Exchange request
- [ ] QR scan untuk lookup order

### C. Owner

**Demo Account:**
```
Email: owner@dombi.test
Password: password
```

**Flow Testing:**
1. Login di `/login` dengan kredensial owner
2. **Dashboard** → KPI strip, billing hero
3. **Produk** → kelola product families + variants
4. **Pricing** → atur harga pusat + per-outlet
5. **Inventory** → stok pusat + stok outlet
6. **Orders** → lihat semua pesanan, assign courier
7. **Deliveries** → monitor pengiriman, resolve masalah
8. **Finance** → settlement dashboard, verifikasi pembayaran
9. **Analytics** → revenue charts, top products, export CSV

**Yang perlu dites:**
- [ ] Login owner
- [ ] Dashboard KPI
- [ ] CRUD product family & variant
- [ ] Pricing: center + per-outlet
- [ ] Inventory: central stock + outlet stock
- [ ] Restock approval workflow
- [ ] Order management
- [ ] Delivery monitoring + resolution
- [ ] Return/Exchange management
- [ ] Finance: settlement, payment verification
- [ ] Refund management
- [ ] Courier management
- [ ] Delivery tier configuration
- [ ] Analytics dashboard
- [ ] CSV export reports

### D. Courier

**Setup:**
- Owner buat akun courier di `/owner/couriers`
- Kirim invitation link ke email courier
- Courier klik link invitation → set password

**Flow Testing:**
1. Login dengan kredensial courier
2. **Dashboard** → lihat tugas hari ini
3. **Availability** → toggle online/offline
4. **Deliveries** → pickup → start delivery → complete / fail
5. **Location** → GPS tracking

**Yang perlu dites:**
- [ ] Courier invitation flow
- [ ] Login courier
- [ ] Online/offline toggle
- [ ] Delivery task list
- [ ] Pickup confirmation
- [ ] Start delivery
- [ ] Complete delivery
- [ ] Fail/return to outlet
- [ ] GPS location update

---

## 4. Instalasi APK

**Customer:**
1. Download `dombi-customer.apk`
2. Buka di Android → Install
3. Buka app → login Google

**Internal (Dombi Kurir untuk Outlet/Owner/Courier):**
1. Download `dombi-internal.apk`
2. Install di Android
3. Buka app → diarahkan ke halaman login
4. Login dengan kredensial role masing-masing

---

## 5. Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Customer | (Google Login) | — |
| Outlet | `outlet@dombi.test` | `password` |
| Owner | `owner@dombi.test` | `password` |
| Courier | (via invitation) | (set saat invitation) |

---

## 6. Known Issues

| Issue | Status | Workaround |
|-------|--------|------------|
| Staging deploy manual (auto-deploy belum otomatis) | Open | SSH + git pull |
| `google-services.json` per-package (customer vs internal) | Open | Rename file saat build APK |
| Biogoat image Unplash dead | Closed | Fallback ke emoji susu |
| 5 TypeScript errors (pre-existing) | Open | Tidak mempengaruhi runtime |

---

## 7. Rekomendasi Selanjutnya

### Phase 1: Testing & Bug Fixing (1-2 minggu)
- [ ] 4 teman test masing-masing role secara bersamaan
- [ ] Catat semua bug di spreadsheet
- [ ] Prioritaskan: critical → high → medium → low
- [ ] Fix bug sebelum lanjut ke fitur baru

### Phase 2: Production Readiness
- [ ] Setup production domain (dombicenter.com)
- [ ] Setup production server (Hostinger)
- [ ] Setup production .env
- [ ] Setup production DOKU (live mode, bukan sandbox)
- [ ] Google OAuth verification (publish app, bukan testing mode)
- [ ] SSL certificate
- [ ] Database backup strategy
- [ ] Sentry error monitoring production

### Phase 3: Fitur Tambahan
- [ ] Courier routing optimization (multi-stop)
- [ ] Push notification real-time (order status updates)
- [ ] Image upload untuk produk (via owner panel)
- [ ] Dashboard analytics completion (70% → 100%)
- [ ] Invoice PDF generation
- [ ] Customer review/rating produk
- [ ] Multi-language (EN/ID)
- [ ] iOS app (Capacitor)

### Phase 4: Operasional
- [ ] Onboarding guide untuk outlet
- [ ] SOP untuk owner (pricing, restock, settlement)
- [ ] Training kurir
- [ ] Customer support flow (WhatsApp integration)
- [ ] Monitoring dashboard (uptime, error rate, transaction volume)

---

## 8. Kontak

**Developer:** Arya Ajisadda Haryanto
**Staging:** https://staging.dombicenter.com
**GitHub:** https://github.com/leanderarya/dombi