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

**Flow Testing (step + expected result):**

**0. Login / Guest**
- Welcome → tap "Masuk dengan Google" (native Sign-In) ATAU "Lewati Tahap Ini".
- Expected: login → masuk Home; guest → masuk Home tanpa akun.

**1. Browse & Cart**
- Home → Produk → tap produk → pilih variant → tap tambah ke cart.
- Buka cart → ubah quantity (+) / (−) → hapus item.
- Expected: subtotal & jumlah item update real-time; hapus menghapus item.

**2. Checkout — pilih fulfillment**
- Cart → tap "Checkout".
- Expected: halaman Checkout, toggle **Pickup / Delivery**, default Pickup.
- Pilih mode → detail kartu menyesuaikan (pickup: "Ambil di Outlet", delivery: "Kurir Dombi"). Guest yang pilih Delivery diminta login dulu.

**3. Checkout — info pemesan**
- Login Google: langkah ini **dilewati** (prefill dari profil) → langsung ke Pembayaran.
- Guest: isi Nama + Nomor WhatsApp (format `08xx`, valid Indonesia) → lanjut.
- Expected: validasi WA format/duplikat; ke halaman Pembayaran.

**4. Checkout — pembayaran**
- Cek ringkasan (items, subtotal, ongkir kalo delivery, biaya layanan, total).
- Pilih metode bayar (QRIS / Transfer / E-Wallet / Kartu Kredit) → tap "Bayar Rp X".
- Expected: redirect ke halaman DOKU (atau langsung ke konfirmasi kalo sudah paid).

**5. Tracking & Riwayat**
- Buka `/customer/orders` → lihat status pesanan.
- Expected: status mengikuti lifecycle (pending → paid → confirmed → ...).

**Yang perlu dites:**
- [OK] Login Google
- [OK] Guest mode (tanpa login)
- [FIXED batch4] Browse produk + filter. Search rasa (Stroberi, Coklat, dll) sekarang match flavor names.
- [OK] Cart: tambah, ubah quantity, hapus
- [OK] Checkout: pickup
- [OK] Checkout: delivery
- [OK] Pembayaran DOKU (Kartu Kredit sandbox; QRIS/transfer belum ada simulator)
- [OK] Order tracking (guest: akses via nomor HP, lihat order aktif saja)
- [OK] Riwayat pesanan (guest: hanya order aktif, bukan riwayat penuh)
- [OK] Repeat order (clear cart lama)
- [OK] Favorit produk (guest: tersimpan session lokal, hilang jika app dihapus; tidak ada halaman favorit tersendiri)
- [OK] Alamat pengiriman (CRUD + default + map) — [FIXED batch4] red border on validation errors
- [OK] Penerima — belum ada halaman profil; saat ini input manual di checkout (deferred ke post-live)

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
- [OK] Login outlet
- [OK] Dashboard stats
- [OK] Order lifecycle: confirm → prepare → ready → complete
- [OK] Assign courier ke order delivery
- [OK] Inventory monitoring
- [OK] Stock opname — [FIXED batch1+batch3] update stok + guard reserve error + notes wajib saat selisih
- [OK] Restock request — [FIXED batch1] page + dialog bisa buat request; note: info stok hanya tampil kalo produk punya inventory outlet
- [OK] Settlement + upload bukti bayar — [FIXED batch3] input type=text + strip dots sebelum submit
- [OK] Offline sale — [NO] belum ada metode pembayaran (hanya pilih produk + jumlah + catatan)
- [OK] Return request — [FIXED batch2A] show page render `item.product`; create button disabled selama belum pilih produk (expected)
- [OK] Exchange request — [FIXED batch2A] prop mismatch + dialog duplikat fixed
- [OK] QR scan untuk lookup order

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
- [OK] Login owner
- [OK] Dashboard KPI — [FIXED batch5] grafik Tren Pendapatan: x-axis labels sparse render (every 5th) untuk 30 hari
- [OK] CRUD product family & variant (hapus via deactivate saat ada riwayat transaksi)
- [OK] Pricing: center + per-outlet
- [OK] Inventory: central stock — [FIXED batch1] tab Outlet muncul produk + grouping + SKU; note: filter outlet belum fungsi, sort hanya nama
- [OK] Restock approval workflow
- [OK] Order management — [FIXED batch2A] assign courier (`courier_type` ditambah); tidak ada mekanisme cancel order (perlu enhancement/konfirmasi kebutuhan)
- [OK] Delivery monitoring (list + detail) — resolve belum diuji (belum ada delivery bermasalah)
- [OK] Return/Exchange management (approve/reject) — [FIXED batch2A] nama produk render `item.product`
- [OK] Finance: settlement, payment verification, reconcile
- [OK] Refund management (manual transfer dari owner, bukan via DOKU)
- [OK] Courier management (CRUD jalan di `/owner/couriers`) — [FIXED batch3] menu sidebar link ke `/owner/couriers`
- [NO] Delivery tier configuration — edit simpan tapi nilai tak berubah (bug; lihat Known Issues)
- [OK] Analytics dashboard — [INFO] revenue analytics vs tagihan settlement beda by design (ongkir: analytics include, settlement exclude)
- [OK] CSV export reports — [NO] format belum mudah dibaca owner (enhancement)

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
- [OK] Courier invitation flow
- [OK] Login courier
- [OK] Online/offline toggle
- [OK] Delivery task list
- [OK] Pickup confirmation
- [OK] Start delivery
- [OK] Complete delivery
- [ ] Fail/return to outlet — [FIXED batch2A] popup auto-close fixed; resolve re-assign still blocked by `courier_type` bug (deferred)
- [ ] GPS location update — tidak pakai GPS/map tracking saat ini (deferred)
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
| 5 TypeScript errors (pre-existing) | **Closed batch5** | Already 0 errors |
| Delivery login sheet: "Masuk dengan Google" tanpa redirect → habis login balik ke Home, bukan checkout (cart tetap ada) | **Closed batch3** | Google redirect ke checkout |
| Delivery step Info: ganti alamat via LocationSheet → quote radius/ongkir tidak re-fetch, tetap stale di props (alamat jauh bisa Lanjutkan, stop di step 3 blocker subscription; balik ganti alamat valid tetap quote lama) | **Closed batch3** | router.reload + await syncCustomerLocationDraft |
| Form validasi alamat/penerima: error tidak jelas (tanpa toast / warna merah pada field) | **Closed batch4** | Red border on Field + CompactField when error |
| Outlet UI: semua halaman ada glitch visual tiap interval beberapa detik (detail belum diidentifikasi) | **Closed batch5** | useInertiaLoading skip polling reloads |
| Stock opname: catatan (notes) opsional, padahal selisih stok butuh keterangan asal-usul | **Closed batch3** | Notes wajib saat ada selisih |
| **Akar bug key mismatch:** UI outlet kirim `product_variant_id`, backend validasi `product_id` — stock opname & restock gagal silent → **FIXED batch 1** (renamed frontend key ke `product_id`, backend utuh) | Closed | Batch 1 ^ fix key `product_id` |
| Return create (outlet): submit silent — root: browser cache kirim `product_variant_id` (old JS), backend validasi `product_id` → 422 errors gak render (Inertia useForm tanpa onError). Fix: (1) frontend rename key, (2) backend mapping `product_variant_id`→`product_id` safety net | **Closed batch2A** | Mapping di controller + rebuild assets |
| Settlement payment: input "323.000" tersimpan `323` (format titik ribuan dikirim sebagai desimal, bukan dikali 1000/parse). Backend validasi `amount` numeric rupiah | **Closed batch3** | input type=text + strip dots |
| Return show page: nama produk kosong — controller `load('items.product')` tapi UI baca `item.variant.*` (relation `variant` tak di-load) | **Closed batch2A** | Render `item.product` |
| Exchange create: selalu empty state "Tidak ada return" — controller kirim prop `returnRequests`, UI baca `exchangeEligibleReturns` (mismatch) | **Closed batch2A** | Samakan nama prop + hapus dialog duplikat |
| Delivery tier edit: simpan → toast sukses tapi nilai tak berubah (folder DB `updated_at` tetap lama). Route/controller/request/model/fillable/cast konsisten; perlu investigasi runtime staging (kode terdeploy / proxy cache) | **Closed batch4** | Route parameter mismatch `{delivery_tier}` vs `$tier` |
| Owner assign courier: UI cuma kirim `courier_id`, backend `AssignCourierRequest` wajibkan `courier_type` → error "The courier type field is required." | **Closed batch2A** | Tambah field `courier_type` (dombi/eksternal) di UI |
| Owner menu Courier ngarah ke `/owner/couriers/management` (list+approve, tanpa CRUD), padahal tombol Buat/Edit ada di `/owner/couriers` (resource). `owner-layout.tsx:40` salah link | **Closed batch3** | Ubah menu link ke `/owner/couriers` |
| Courier return-to-outlet: dialog "Ya, Kembalikan" tak auto-close setelah sukses (`router.post` tanpa `onSuccess`) | **Closed batch2A** | Tambah `onSuccess` close sheet |
| Delivery login sheet: guest click luar dialog → toggle tetap Delivery + bisa Lanjutkan (harus reset ke Pickup) | **Closed batch3** | Dialog dismiss reset state + Google redirect |
| Checkout step 3 (Payment): stok berubah → subtotal di UI lama (3 item) tapi DOKU pakai harga benar (2 item). Saat stock 0, notif muncul tapi total UI tetap; DOKU benar | **Closed batch3** | router.reload setelah stok adjust |
| Courier resolve → re-assign kurir: error "courier type field required" (akar sama bug assign `courier_type` tak dikirim UI) | **Closed batch2A** | Already fixed — assign-courier-sheet has courier_type |
| Owner inventory tab Outlet: `buildProductGroups` baca `product_variant_id/variant` tapi controller load `product` → semua di-skip → **FIXED batch 1** | Closed | Batch 1 ^ baca `product_id`/`product` |

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
- [ ] Auto-save recipient ke profil (checkout "Simpan penerima ini") — defer ke post-live; UI checkbox dihapus karena over-engineering saat ini

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