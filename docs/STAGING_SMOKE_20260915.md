# Evidence Smoke Test Staging — In-App DOKU Payment Modal

- **Tanggal:** 15 September 2026 (revisi overlay: 16 September 2026)
- **Target:** https://staging.dombicenter.com (`develop` @ `21d858e0`, sandbox DOKU)
- **Feature HEAD:** `21d858e0` (overlay sendiri menggantikan JS vendor + fix settlement `order.amount`)
- **Tester:** _(isi)_
- **Tujuan:** memenuhi BLOCKER `staging smoke test selesai dan evidence disimpan`
  di `docs/PRODUCTION_CHECKLIST.md` sebelum promote `develop` → `main`.

> Catatan: produksi (`main` @ `e48b6288`) masih memakai flow redirect lama. Rilis ini
> mengubah jalur pembayaran yang sudah live → wajib smoke test + evidence.

> Catatan revisi 16 Sep 2026 (2): Ditemukan bug settlement — jalur sinkronisasi status
> membaca `transaction.amount`, padahal DOKU Check Status API menaruh nominal di
> `order.amount`. Akibatnya attempt selalu `needs_review` dan order tidak pernah
> `paid`. Sudah diperbaiki di `21d858e0` (lihat bagian B.2). **Skenario 1–5 di bawah
> harus dijalankan ulang pada build ini.**

---

## A. Pre-check otomatis (sudah dijalankan mesin)

Diisi oleh agent pada 15 Sep 2026, ±14:02 UTC.

| # | Check | Perintah / bukti | Hasil |
|---|-------|------------------|-------|
| A1 | App sehat | `curl -s https://staging.dombicenter.com/up` | `200` |
| A2 | Health API + DB/cache/storage/scheduler | `curl -s https://staging.dombicenter.com/api/health` | `{"status":"healthy","checks":{"database":true,"cache":true,"storage":true,"scheduler":true}}` |
| A3 | DOKU sandbox reachable | `curl -o /dev/null -w '%{http_code}' https://sandbox.doku.com/checkout/link/<id>?view=iframe` | `200` (iframe `src` boleh dibuka) |
| A4 | Build baru benar-benar ter-deploy | manifest staging punya entry `_doku-checkout`, `_payment`, `_confirm` | ✅ |
| A5 | Overlay modal ada di build | chunk `doku-checkout` memuat `view=iframe`, `Tutup pembayaran`, `closeJokul`, `buildDokuCheckoutUrl` | ✅ (chunk `doku-checkout-DXG7Jqlh.js` @ `21d858e0`, identik dengan build lokal; header native `pt-safe`/`pb-safe`/`bg-surface-muted` ada, 0 referensi vendor) |
| A6 | Copy modal ter-deploy | chunk `payment` memuat `Menunggu pembayaran`, `Selesaikan Pembayaran`, `Pembayaran sedang`, `payment_url`, `order_code`, `payment-status` | ✅ |
| A7 | Retry confirm ter-deploy | chunk `confirm` memuat `Bayar Sekarang`, `payment-status`, `/pay`, `Terjadi kesalahan saat memproses` | ✅ |

## B. Regresi ditemukan saat pre-check (dan diperbaiki)

**Temuan:** build staging meng-*emit* chunk test ke bundle produksi.

- Manifest staging punya 3 entry test: `_payment.test-*.js`, `_confirm.test-*.js`,
  `_test.*.js` (256 KB, berisi `vitest` + `chai`).
- Penyebab: `payment.test.tsx` & `confirm.test.tsx` (baru, ditambahkan fitur ini)
  cocok dengan pola `import.meta.glob` resolusi halaman Inertia.
- Dampak: `app.tsx` memakai glob **eager** `./pages/**/*.tsx`, sehingga chunk test
  di-*import statis* oleh entry bersama yang dipakai ketiga app (customer/internal/admin).
- Reproduksi lokal: `npm run build` → manifest 125 entry, 3 chunk test.

**Perbaikan:** exclude `./pages/**/*.test.tsx` di ketiga glob
(`app.tsx`, `customer-app.tsx`, `internal-app.tsx`) — commit `0b30d5e4`.

| Metrik | Sebelum | Sesudah |
|--------|---------|---------|
| Manifest entry | 125 | 121 |
| Chunk test | 3 | 0 |
| Vitest/chai di bundle | ya (256 KB) | tidak |
| Vitest | 626/626 | 626/626 |
| types:check / eslint / prettier | — | bersih |

**Status perbaikan di staging:** sudah ter-deploy. Commit `0b30d5e4` di-push ke
`develop`; Deploy Staging run `34980325976` **success**. Verifikasi pasca-deploy
pada staging:

| Check | Hasil |
|-------|-------|
| Manifest entry | 121 (sebelumnya 125) |
| Chunk test | tidak ada |
| Import test di entry app/customer/internal | tidak ada |
| `/api/health` | `healthy` (db/cache/storage/scheduler `true`) |
| Chunk `payment` | copy modal + `payment_url` + `payment-status` utuh |
| Chunk `confirm` | `Bayar Sekarang` + `/pay` + `payment-status` utuh |
| Chunk `doku-checkout` | ada (overlay sendiri: `?view=iframe` + tombol tutup) |

Staging sekarang bersih dan siap untuk Skenario 1–5 di bawah.

## B.2 Regresi settlement DOKU ditemukan saat uji manual `21d858e0`

**Temuan (16 Sep 2026):** Skenario 1 gagal — setelah bayar QRIS sandbox, order tetap
"Menunggu Pembayaran", tidak pernah `paid`.

**Akar masalah:** DOKU Check Status API (`GET /checkout/v1/payment/{invoice}`) dan
payload webhook menaruh nominal di `order.amount`. Tiga jalur baca memakai
`transaction.amount` yang tidak ada di payload:

- `DokuService::syncStatusFromDoku()` — jalur polling `/payment-status`, satu-satunya
  detektor yang berfungsi di staging (webhook staging tidak masuk ke app)
- `DokuService::reconcilePaymentAttempt()` — `payments:reconcile-doku`
- `DokuService::handleWebhook()` — jalur legacy

Amount `null` membuat `CanonicalPaymentTransitionService::amountMatches()` gagal →
`verification_status = needs_review` → `OrderPaymentProjectionService::recompute()`
mensyaratkan `verified`, sehingga order **tidak akan pernah** `paid`. Selain itu
contoh resmi DOKU memakai `"amount": 120000.0` (float), sedangkan `minorUnits()`
menolak float.

**Perbaikan (commit `21d858e0`):**

- Helper `DokuService::providerAmount()` membaca `order.amount` dengan fallback
  `transaction.amount`; dipakai di keempat jalur (sync, dua reconcile, webhook, manual).
- `minorUnits()` menormalkan float alih-alih menolaknya.
- 3 test regresi baru memakai bentuk payload DOKU asli; sudah diverifikasi **gagal**
  pada kode lama dan lulus pada kode baru.
- Header overlay disamakan dengan header native aplikasi (judul tengah, tombol tutup
  44px, border, grabber mobile, safe-area).

| Metrik | Hasil |
|--------|-------|
| Vitest | 641/641 |
| PHP | 1503 passed / 1 skipped |
| types:check / eslint / prettier / Pint | bersih |
| Build | sukses |

Staging sekarang siap untuk Skenario 1–5 di bawah pada build `21d858e0`.

---

## B.3 Akar masalah sebenarnya: endpoint Check Status salah (17 Sep 2026)

**Temuan:** setelah perbaikan amount (`21d858e0`) ter-deploy, Skenario 1 **tetap** gagal.
Diagnostik read-only di staging (`diagnose-staging.yml`, run `35057272232`) menunjukkan
setiap attempt tersimpan dengan `gateway_status = UNKNOWN`, `settlement_status = unknown`,
`verification_status = needs_review`, dan `raw_response` berupa fallback
`reason = provider_session_lookup_ambiguous`. Log berulang: `DOKU status check: session not found (404)`.

**Bukti probe endpoint (dua kandidat diuji dengan signature asli ke sandbox DOKU):**

| Endpoint | Hasil |
|----------|-------|
| `GET /checkout/v1/payment/{invoice}` | **HTTP 404** `No static resource v1/payment/{invoice}` — path tidak ada |
| `GET /orders/v1/status/{invoice}` | **HTTP 400 `invalid_signature`** — path benar, signature kita salah |

**Tiga cacat yang diperbaiki (commit `f74cf25a`):**

1. **Endpoint salah.** `/checkout/v1/payment` hanya untuk create; lookup status 404
   selamanya. Endpoint resmi non-SNAP Check Status API = `GET /orders/v1/status/{invoice_number}`
   (`DokuService::STATUS_ENDPOINT`), dipakai di `checkStatus()` dan `reconcilePaymentAttempt()`.
2. **Signature GET salah.** Komponen signature GET menyertakan baris `Digest:`; DOKU
   mewajibkan `Digest` hanya untuk POST dan membalas `400 invalid_signature` bila ada di
   GET. `generateHeaders()` sekarang menerima flag `$withDigest` (GET = `false`, tanpa
   newline di ujung).
3. **`payment_due_date` di objek salah.** Dikirim di `order`, padahal DOKU membacanya di
   `payment` → diabaikan → DOKU memakai default **60 menit** sementara app memakai 15–30
   menit (inkonsistensi yang diangkat user). Sekarang nilainya diturunkan
   `paymentDueDateMinutes()` dari `order.confirmation_expires_at`, sehingga jam DOKU dan
   jam Dombi berhenti bersamaan.

Tambahan: `providerStatus()` memetakan `order.status` (`ORDER_EXPIRED` → `EXPIRED`) saat
`transaction.status` masih `PENDING`, dan status terminal dari sync menutup
`creation_state = created` agar retry tidak terkunci 409 "sedang diproses".

| Metrik | Hasil |
|--------|-------|
| Test regresi baru | 5, diverifikasi **gagal** di kode lama |
| PHP | 1509 passed / 1 skipped |
| Vitest | 641/641 |

Skenario 1–5 di bawah dijalankan ulang pada build `f74cf25a`.

### Bukti settlement end-to-end pada build `f74cf25a` (17 Sep 2026)

Probe read-only terhadap attempt yang sebelumnya nyangkut, lewat `checkStatus()`
yang sudah diperbaiki:

| Order | `order.status` | `transaction.status` | Amount |
|-------|----------------|----------------------|--------|
| DOMBI-20260916-0006 | ORDER_EXPIRED | EXPIRED | 13000 |
| DOMBI-20260916-0005 | ORDER_GENERATED | **SUCCESS** | 30000 |
| DOMBI-20260916-0004 | ORDER_GENERATED | **SUCCESS** | 12000 |

Dua order yang tadinya macet ternyata memang sudah dibayar. Dijalankan lewat
`syncStatusFromDoku()` — jalur yang sama dengan polling `/payment-status`:

| Order | Hasil | payment_status | verification | gateway_amount |
|-------|-------|----------------|--------------|----------------|
| DOMBI-20260916-0005 | `paid` | `paid` | `verified` | 30000.00 |
| DOMBI-20260916-0004 | `paid` | `paid` | `verified` | 12000.00 |
| DOMBI-20260916-0006 | tetap `pending` | `pending` | — | — |

Order 0006 tetap `pending` dengan benar: DOKU `ORDER_EXPIRED` berarti sesi
kedaluwarsa tanpa pembayaran.

Catatan: kedua order tersebut sudah `expired` saat settle, sehingga transisi
membentuk kewajiban refund `late_payment` — perilaku yang benar dan sekaligus
membuktikan jalur late-payment bekerja.

`payments:verify-cutover` di staging: `READY: canonical payment runtime valid and legacy writes disabled.`

### Hasil uji manual Skenario 1 pada build `ab33f6ea` (17 Sep 2026)

Checkout segar + bayar QRIS sandbox sampai selesai, di `staging.dombicenter.com`:

| Field | Nilai |
|-------|-------|
| `order_code` | `DOMBI-20260917-0001` |
| `invoice_number` | `DMB-85-6B0E65089E46` |
| `order_status` | `completed` |
| `payment_status` | `paid` |
| `settlement_status` | `paid` |
| `verification_status` | `verified` |
| `gateway_amount` | `13000.00` (cocok dengan snapshot) |
| `raw_response.transaction.status` | `SUCCESS` |
| `raw_response.order.amount` | `13000` |
| `last_event_source` | `doku-status-sync` |

Order **tidak** `expired` saat settle, jadi tidak ada kewajiban refund
`late_payment` — berbeda dengan order lama yang macet sebelum fix.

**Konsistensi window (keluhan user):** tester mengonfirmasi halaman pembayaran
DOKU kini menampilkan countdown **±15 menit** yang sama dengan hitungan aplikasi,
bukan lagi 60 menit default DOKU. Jadi `payment.payment_due_date` yang diturunkan
dari `order.confirmation_expires_at` benar-benar dibaca DOKU.

> Catatan: nilai `payment_due_date` yang di-echo DOKU tidak dapat diverifikasi
> dari DB setelahnya, karena `raw_response` attempt tertimpa payload status sync
> (`orders/v1/status`) saat pembayaran selesai.

---

## C. Skenario uji manual (diisi tester)

### Skenario 1 — Happy path (checkout QRIS → modal in-app → paid → redirect in-app)

- [x] Buat pesanan sampai halaman checkout pembayaran.
- [x] Klik CTA **`Bayar Rp <total>`** (POST `/customer/checkout/payment`, JSON).
- [x] **Observasi:** modal DOKU terbuka sebagai overlay; header/navbar Dombi tetap terlihat di belakang.
- [x] Scan QRIS sandbox.
- [x] **Observasi:** polling `GET /customer/orders/{order}/payment-status` (interval 5s, timeout 5 menit) mendeteksi `paid`.
- [x] **Observasi:** pindah in-app (tanpa full page reload) ke `/customer/orders/confirm/{order_code}` dengan status lunas.

Evidence:
- `order_code`: `DOMBI-20260917-0001` (build `ab33f6ea`, 17 Sep 2026)
- Response JSON checkout: `{"payment_url": "https://sandbox.doku.com/..."}` (overlay in-app, tanpa pindah halaman)
- Waktu polling → transisi: `paid_at = 2026-09-17T11:25:40Z`; `raw_response.transaction.date = 2026-09-17T11:25:33Z`
  → terdeteksi ±7 detik setelah pembayaran DOKU sukses
- Hasil DB: `order_status=completed`, `payment_status=paid`, `settlement_status=paid`,
  `verification_status=verified`, `gateway_amount=13000.00`
- Window DOKU vs app: **sama (±15 menit)** — konsisten, bukan 60 menit default

### Skenario 2 — Abandon & resume (tutup modal → pakai URL yang sama)

- [ ] Checkout sampai modal QRIS tampil, lalu tutup modal.
- [ ] **Observasi:** halaman masuk mode **"Menunggu pembayaran"** (panel "Pembayaran sedang diproses di DOKU").
- [ ] Klik **"Selesaikan Pembayaran"**.
- [ ] **Observasi:** modal terbuka lagi memakai `payment_url` yang **sama** (tanpa attempt/order baru).

Evidence:
- `order_code`: `...`
- URL DOKU identik?: `...`

### Skenario 3 — Terminal state → attempt baru

- [ ] Buat invoice QRIS kedaluwarsa/gagal (tunggu expiry).

**3A — halaman checkout:**
- [ ] Tampil pesan terminal ("Waktu pembayaran telah habis..." / "Pembayaran tidak berhasil diproses...").
- [ ] Klik **"Selesaikan Pembayaran"** → request ke `POST /customer/orders/{order}/pay` (JSON).
- [ ] Modal terbuka dengan URL/attempt **baru** (bukan URL void lama).

**3B — halaman konfirmasi:**
- [ ] Buka `/customer/orders/confirm/{order_code}` dari order berstatus terminal.
- [ ] Klik **"Bayar Sekarang"** → `POST /customer/orders/{order}/pay` (JSON).
- [ ] Polling ter-*re-arm* (kembali ke `pending`) dan modal in-app muncul.

Evidence:
- `order_code`: `...`
- attempt lama vs baru: `...`

### Skenario 4 — Webhook ingestion & status sync

> Kolom aktual tabel `payment_webhook_logs`: `request_id`, `source`, `invoice_number`,
> `status`, `signature_valid`, `mapped_status`, `payload`, `error`.
> **Tidak ada** kolom `order_code` maupun status HTTP.

- [ ] Pastikan notifikasi DOKU ke `/payment/doku/notify` tercatat.
- [ ] `signature_valid = 1` dan `mapped_status` sesuai.

Evidence (query):
```sql
SELECT id, invoice_number, mapped_status, signature_valid, created_at
FROM payment_webhook_logs
ORDER BY id DESC
LIMIT 5;
```
Output: `...`

> Sandbox: webhook tidak selalu dikirim DOKU. Bila perlu, gunakan
> `php artisan doku:mark-paid {order_code}` (staging) — atau workflow
> **Staging Payment Operations** (`workflow_dispatch`, action `verify`).

### Skenario 5 — Overlay bisa ditutup (fix navbar/tombol retry)

> Sejak overlay dirender sendiri (tanpa `jokul-checkout-1.0.0.js`), tidak ada lagi
> script CDN yang bisa gagal dimuat. Yang diuji di sini adalah **jalan keluar dari
> overlay**, yang sebelumnya tidak mungkin di HP.

- [ ] Buka modal pembayaran dari checkout.
- [ ] **Observasi:** header Dombi "Pembayaran" + tombol tutup (X) terlihat di atas iframe.
- [ ] Klik tombol tutup → **Observasi:** overlay hilang, tombol **"Selesaikan Pembayaran"** bisa ditekan.
- [ ] Buka ulang modal, tekan **ESC** → overlay hilang.
- [ ] Buka ulang modal, klik area gelap di luar panel (tampilan ≥ tablet) → overlay hilang.
- [ ] Buka ulang modal, tekan tombol kembali/close di dalam iframe DOKU (bila ada) → overlay hilang via `postMessage`.
- [ ] **Observasi:** body tidak bisa di-scroll selama overlay terbuka, dan bisa lagi setelah ditutup.
- [ ] Klik **"Selesaikan Pembayaran"** setelah overlay ditutup → `payment_url` yang sama terbuka lagi.

Evidence:
- Metode penutupan yang berhasil: `...`
- Screenshot/teks tombol X: `...`

---

## D. Hasil & keputusan

| Skenario | Hasil | Catatan |
|----------|-------|---------|
| 1 Happy path | ✅ Pass | `DOMBI-20260917-0001` → `completed`/`paid`/`verified`, window DOKU = app (±15 mnt), build `ab33f6ea` |
| 2 Abandon & resume | ⬜ Pass / ⬜ Fail | |
| 3 Terminal retry | ⬜ Pass / ⬜ Fail | |
| 4 Webhook sync | ⬜ Pass / ⬜ Fail | |
| 5 Overlay bisa ditutup | ⬜ Pass / ⬜ Fail | perlu tester (belum dicoba) |

- [ ] Semua skenario PASS → BLOCKER staging smoke test terpenuhi.
- [ ] Deploy ulang staging setelah commit overlay dan **ulangi Skenario 1–5** di atas build bersih.
      Skenario 1 sudah diulang pada build `ab33f6ea`; 2–5 belum.
