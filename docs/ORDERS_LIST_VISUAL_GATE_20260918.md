# Gate Visual — Daftar Pesanan Customer (Orders 1–4)

- **Tanggal:** 18 September 2026
- **Plan:** `docs/superpowers/plans/2026-09-18-orders-list-frame-application-plan.md` — Slice G.1
- **Frame acuan:** empat frame yang dipilih di kanvas — `op1pF` _Orders 1 — Aktif_, `fjKWV` _Orders 2 — Riwayat_, `ZXG0E` _Orders 3 — Kosong_, `p0C6Ta` _Orders 4 — Tanpa Hasil_ (`docs/Design_DombiApp.pen`)
- **Target render:** lokal (Laravel Herd, `https://dombi.test`), `develop` @ `c8291498`
- **Viewport:** 402 × 900 CSS px, deviceScaleFactor 2 (lebar frame kanvas = 402)
- **Alat:** Chrome for Testing headless lewat CDP (`Page.captureScreenshot`, clip scale 2, full page); login `POST /login` via curl lalu cookie `dombi-session` disuntik dengan `Network.setCookie`
- **Status:** ✅ **Lolos** untuk elemen yang digate — judul, pita section, badge, label fulfillment, format tanggal, dan label/tombol aksi — dengan **1 temuan baru (F-1)** dan deviasi yang sudah diputuskan di C.5–C.7.

Bukti: [`docs/evidence/orders-list-20260918/`](evidence/orders-list-20260918/)

| State               | Frame    | Screenshot                    |
| ------------------- | -------- | ----------------------------- |
| A — Aktif + Riwayat | `op1pF`  | `state-a-aktif.png`           |
| B — Riwayat saja    | `fjKWV`  | `state-b-riwayat.png`         |
| Kosong              | `ZXG0E`  | `orders-3-kosong.png`         |
| Tanpa hasil         | `p0C6Ta` | `orders-4-tanpa-hasil.png`    |
| F-1 (temuan)        | —        | `finding-f1-refund-badge.png` |

> Pemetaan yang berlaku: **dua frame = satu route** (`GET /customer/orders`). State A muncul saat `activeOrders` tidak kosong; State B saat kosong. Tidak ada layar kedua yang perlu dibangun.

> **Perubahan header (2026-09-18, setelah gate).** Pengguna menyeleksi komponen baru di kanvas: `hasMu` — **`Page Header/Customer`** (belum tersimpan ke `.pen` saat dibaca). Isinya: `fill=$surface`, `padding=[12,20,16,20]`, satu teks `Riwayat Pesanan` **16/700 `$font-body`, rata tengah, tanpa subtitle**. Implementasi sudah mengikuti komponen itu. Karena frame `op1pF`/`fjKWV`/`ZXG0E`/`p0C6Ta` masih menggambar header lama (judul 24/800 rata kiri + subtitle 12), baris "Judul + subjudul" pada tabel State A di bawah menggambarkan keadaan **sebelum** perubahan ini dan kanvas perlu diperbarui agar konsisten.

## 1. Cara render ulang

Fixture memakai customer khusus (`gate-customer@example.com`) dengan 3 order per state supaya tidak mencampur data dummy lokal:

- **State A:** `pending_confirmation` (belum ada attempt bayar) + `delivering` bertanggal **hari ini**, dan 1 `completed` bertanggal 27 Mei 2025.
- **State B:** `completed`, `expired`, `cancelled_by_customer` — tanpa pesanan aktif.

Catatan operator:

- **Zona waktu.** App `config('app.timezone') = UTC`, mesin/browser `WIB (UTC+7)`. Timestamp disimpan UTC sehingga waktu frame harus dimasukkan **−7 jam** ke DB (14.20 frame = 07.20 tersimpan) agar terbaca `14.20` di layar.
- **Jangan pakai `?filter=all`.** `historyFilterStatuses('all')` mengembalikan `[]` → `whereIn` kosong → riwayat hilang. UI tidak pernah mengirim nilai itu (chip "Semua" mengirim tanpa parameter); hanya berbahaya bagi yang menyusun URL manual.

## 2. State A vs `op1pF`

| Elemen           | Frame `op1pF`                                                                            | Render (state-a-aktif.png)               | Hasil |
| ---------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------- | ----- |
| Judul + subjudul | `Riwayat Pesanan` 24/800 kiri + `Lacak dan lihat riwayat pesananmu` 12                   | sama                                     | ✅    |
| Filter chips     | Semua aktif (fill gelap), 3 lainnya outline                                              | sama (variant `neutral`, size `caption`) | ✅    |
| Pita section     | `Pesanan Aktif` lalu `Riwayat Pesanan`, 12/700 di plane `#F7F7F5`                        | sama                                     | ✅    |
| Kartu aktif 1    | `Pick Up` + `Menunggu Pembayaran` + `Hari ini, 14.20` + tombol solid `Bayar Sekarang`    | sama                                     | ✅    |
| Kartu aktif 2    | `Delivery` + `Dalam Pengiriman` + `Hari ini, 13.10` + tombol solid `Lihat Detail`        | sama                                     | ✅    |
| Kartu riwayat    | `Pick Up` + `Selesai` + `27 Mei 2025, 14.49` + `Beli Lagi` (surface + outline brand 2px) | sama                                     | ✅    |
| Anatomi kartu    | mark 42 px, divider 1px, Item Row 54 px, Meta Row, Total Row                             | sama                                     | ✅    |
| Bottom nav       | ikon lucide 20 px, label 10, tanpa shadow                                                | sama                                     | ✅    |

Baris tambahan yang **tidak** digambar frame dan sengaja dipertahankan (keputusan C.5–C.7): pesan `Selesaikan pembayaran untuk melanjutkan` dan baris alamat kirim pada kartu delivery.

## 3. State B vs `fjKWV`

| Elemen       | Frame `fjKWV`                                                                               | Render (state-b-riwayat.png) | Hasil |
| ------------ | ------------------------------------------------------------------------------------------- | ---------------------------- | ----- |
| Pita aktif   | tidak ada                                                                                   | tidak ada                    | ✅    |
| Pita riwayat | `Riwayat Pesanan`                                                                           | sama                         | ✅    |
| Kartu 1      | `Pick Up` + `Selesai` + `27 Mei 2025, 14.49` + `Beli Lagi` outlined                         | sama                         | ✅    |
| Kartu 2      | `Delivery` + `Kadaluarsa` (netral) + `8 Sep 2024, 17.11` + `Pesan Ulang` **solid**          | sama                         | ✅    |
| Kartu 3      | `Delivery` + `Dibatalkan Customer` (danger) + `2 Agu 2024, 09.05` + `Pesan Ulang` **solid** | sama                         | ✅    |

Ini menutup F.1: kartu `Dibatalkan Customer` sekarang punya aksi, dan `Kadaluarsa` tetap solid — bukan hanya `completed` yang punya aksi.

## 4. State Kosong vs `ZXG0E`

Render diambil dengan akun tanpa pesanan sama sekali (`viewState === 'empty'`).

| Elemen       | Frame `ZXG0E`                                                      | Render (orders-3-kosong.png)                                     | Hasil              |
| ------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------- | ------------------ |
| Pita section | `Riwayat Pesanan` 12/700 di pita `bg-canvas`, di atas kartu kosong | **tidak dirender** → kini dirender (`orders-3-kosong-after.png`) | ✅ F-2 diperbaiki  |
| Kartu kosong | putih, padding 28, gap 8, rata tengah                              | sama (`p-7`, `gap-2`, `bg-surface`)                              | ✅                 |
| Ikon         | `package` 38 px `#A1A1AA`                                          | sama (38 px, `text-text-subtle`)                                 | ✅                 |
| Judul        | `Yuk belanja lagi` 15/700 heading                                  | sama                                                             | ✅                 |
| Salinan      | 11 px, tengah, lebar 300                                           | sama (`text-caption` 11 px, `max-w-[300px]`)                     | ✅                 |
| CTA          | `Lihat Menu` fill `#047857`, r=12, padding `[10,18]`, label 12/700 | `Button primary size="md"`: h 40, r token 10, px 16              | ~ literal vs token |
| Sudut kartu  | tanpa `cornerRadius` → siku                                        | `rounded-card` 16 px                                             | ~ perlu keputusan  |
| Tambahan app | —                                                                  | kartu "Pernah pesan sebelumnya?" di bawah                        | diterima (C.5–C.7) |

## 5. State Tanpa Hasil vs `p0C6Ta`

Render diambil dengan filter `Gagal` pada akun yang punya order aktif dan tanpa pesanan gagal (`viewState === 'recovered'`, riwayat kosong).

| Elemen       | Frame `p0C6Ta`                                                               | Render (orders-4-tanpa-hasil.png) | Hasil              |
| ------------ | ---------------------------------------------------------------------------- | --------------------------------- | ------------------ |
| Pita section | `Riwayat Pesanan`                                                            | sama                              | ✅                 |
| Ikon         | `search` 38 px `#A1A1AA`                                                     | sama                              | ✅                 |
| Judul        | `Pesanan tidak ditemukan` 15/700 heading                                     | sama                              | ✅                 |
| Salinan      | `Coba ubah filter atau cari dengan kata kunci lain.` 11 px tengah, lebar 300 | sama                              | ✅                 |
| CTA          | tidak ada                                                                    | tidak ada                         | ✅                 |
| Chip aktif   | frame menggambar `Semua` aktif                                               | `Gagal` aktif                     | ✅ (lihat catatan) |

Catatan: frame `p0C6Ta` menggambar chip **Semua** sebagai aktif padahal isinya keadaan "tanpa hasil" — sebuah kontradiksi di dalam frame. Implementasi menandai chip yang benar-benar dipakai (`Gagal`); di sini perilaku implementasi yang benar.

## 6. Deviasi yang sudah diputuskan (diwarisi C.5–C.7, bukan temuan baru)

| #   | Frame (literal di dalam frame)    | Implementasi                                                  | Keputusan                        |
| --- | --------------------------------- | ------------------------------------------------------------- | -------------------------------- |
| 1   | `cornerRadius 18` di Order Card   | `--radius-card` 16 (variable + `Card/Base`)                   | variable menang; literal = drift |
| 2   | `cornerRadius 999` di tombol aksi | `--radius-control`                                            | variable menang                  |
| 3   | padding pill `[6,10]`             | `size="md"` → `[4,10]`                                        | library menang                   |
| 4   | `#DCFCE7`/`#15803D` (selesai)     | `--color-success-bg #ECFDF5` / `--color-success-text #047857` | token menang                     |
| 5   | `#FEF3C7`/`#A16207` (menunggu)    | `--color-warning-bg #FFFBEB` / `--color-warning-text #B45309` | token menang                     |
| 6   | `#FEE2E2` (batal)                 | `--color-danger-bg #FEF2F2`; teks `#B91C1C` identik           | token menang                     |
| 7   | `#DBEAFE` (kirim)                 | `--color-info-bg #EFF6FF`; teks `#1D4ED8` identik             | token menang                     |
| 8   | —                                 | baris `reason` status, alamat kirim, pesan pembayaran         | tambahan app-only, dipertahankan |

## 7. Temuan

### F-1 — Badge refund muncul pada pesanan yang belum dibayar ✅ diperbaiki (slice F.5)

- **Bukti:** `finding-f1-refund-badge.png`
- **Perilaku:** pesanan dengan `payment_status = 'pending'` merender badge **`Proses Refund`** plus baris refund berlabel mentah `pending`, dan **tombol bayar hilang** (`refundPresentation.suppressActions`). Frame `op1pF` menggambar kartu itu dengan badge `Menunggu Pembayaran` dan tombol `Bayar Sekarang`.
- **Sebab:** `RefundPayloadService::uiStatus()` memetakan `RefundObligationStatus::Pending` (enum value `pending`) → `refund_pending`. `queueState()` memakai `payment_status` sebagai fallback saat tidak ada refund obligation, sehingga `PaymentStatus::Pending` (value yang sama: `pending`) terbaca sebagai refund pending. `paid` dan `null` tidak terpengaruh.
- **Dampak:** order yang menunggu pembayaran kehilangan CTA bayar di daftar pesanan dan salah tampil sebagai proses refund. Terverifikasi juga pada order terminal ber-`payment_status` `pending` (badge `pending` di riwayat). 11 order di DB lokal terdampak.
- **Bukan regresi Fase F** — F.1–F.3 hanya menyentuh label, tanggal, dan aksi kartu; queue refund tidak disentuh. Ditemukan oleh gate ini.
- **Perbaikan (izin pengguna 2026-09-18):** `queueState()` hanya memakai `payment_status` sebagai pengganti obligation bila nilainya salah satu status refund eksplisit (`REFUND_PAYMENT_STATUSES`: `refund_pending`, `refund_in_progress`, `refunded`, `refund_rejected`, `refund_failed`). Nilai `pending` dan `failed` — dua-duanya bertabrakan dengan `RefundObligationStatus` — tidak lagi dibaca sebagai refund. Semua status refund sungguhan tetap berperilaku sama.
- **Verifikasi:** test baru `test_unpaid_order_has_no_refund_queue`, `test_failed_payment_has_no_refund_queue` (`RefundPayloadPrivacyTest`) dan `test_unpaid_active_order_carries_no_refund_badge` (`ActiveRefundOrderVisibilityTest`, lewat endpoint `/customer/orders`); `php artisan test --filter=Refund` **221 test lolos**.

### F-2 — Pita `Riwayat Pesanan` hilang pada state kosong ✅ diperbaiki (slice F.6)

- **Bukti:** `orders-3-kosong.png` (sebelum) vs `orders-3-kosong-after.png` (sesudah) vs frame `ZXG0E`.
- **Perilaku:** pada akun tanpa pesanan sama sekali (`viewState === 'empty'`), kartu kosong dirender tanpa pita section di atasnya, padahal frame menggambar pita `Riwayat Pesanan` (12/700 di `bg-canvas`, padding `[18,20,8,20]`) di antara chip filter dan kartu.
- **Sebab:** `resources/js/pages/customer/orders/index.tsx` hanya membungkus kartu kosong dengan `SectionLabel` di cabang `viewState === 'recovered'`. Cabang `'empty'` merender `EmptyOrderState` langsung di dalam `<div className="px-5 pb-3">`.
- **Dampak:** kosmetik — tinggi/urutan elemen berbeda dari kanvas pada state pertama kali pengguna membuka halaman; tidak ada perilaku yang salah.
- **Perbaikan:** cabang `'empty'` kini dibungkus `<section>` + `<SectionLabel>Riwayat Pesanan</SectionLabel>`, sama seperti cabang `'recovered'`. Test `index.test.tsx` menambahkan penjaga: teks `Riwayat Pesanan` muncul **dua kali** di state kosong (judul halaman + pita).
- **Verifikasi:** render ulang state kosong (fixture akun tanpa order) menunjukkan urutan judul → chip → pita → kartu kosong; `npm test` 148/148.

### Catatan F-3 — sudut kartu state kosong ✅ diputuskan: pakai token

Frame `ZXG0E`/`p0C6Ta` menggambar kartu state tanpa `cornerRadius` (siku), sedangkan implementasi memakai `rounded-card` (16 px) — konsisten dengan `Card/Base` dan seluruh kartu lain di kanvas. **Keputusan pengguna 2026-09-18:** tetap memakai token `rounded-card`; ketiadaan radius di frame dianggap kelalaian kanvas, bukan maksud desain. Tidak ada perubahan kode.

### F-4 — Ukuran pil filter & label tombol (✅ diperbaiki 2026-09-18)

- **Dilaporkan pengguna:** "pil filter besar pada mobile" (header ikut terlihat terlalu tinggi).
- **Sebab:** `tailwind-merge` tidak mengenal skala teks kustom proyek (`--text-control`, `--text-control-sm`, `--text-caption`) dan menganggapnya kelas **warna**. Akibatnya `cn('text-caption', 'text-text-muted')` membuang `text-caption` → pil jatuh ke 16 px warisan (tinggi 42 px), dan `cn('text-control', 'text-white')` membuang `text-white` → label tombol primary ber-`size="sm"` mewarisi warna teks gelap, bukan putih.
- **Perbaikan:** `resources/js/lib/utils.ts` — `extendTailwindMerge` dengan `font-size: [{ text: ['control', 'control-sm', 'caption'] }]`. Terukur di halaman ini: pil **16 px/42 px → 11 px/31,75 px**; label tombol primary kembali putih.
- **Ikut dirapikan agar header sama dengan kanvas:** `pt-safe-header` (inset minimum 12 px; sebelumnya `pt-safe` 8 px **ditambah** `pt-3` 12 px = 20 px), padding bawah baris filter 16 px (sebelumnya 16 px + 4 px bawaan `FilterChips`), dan `leading-tight` pada pil. Header **142,5 px → 127,75 px** (kanvas ≈ 125 px; blok judul 80 px persis sama).
- **Efek samping & keputusan lanjutan (2026-09-18):** tombol berukuran selain `sm` kini memakai skala tombol; **pengguna memilih menyelaraskan ke kanvas** — `Button` base menjadi `text-sm font-semibold` (**14/600**, sesuai `Button/Primary`, `Button/Secondary`, `Button/Primary CTA`), menggantikan `text-control` 13/500. Terukur setelah perubahan: CTA `size="cta"` = 14/600, tombol `size="sm"` di kartu = 12/600 (kanvas menggambar aksi dalam kartu 12/700 — selisih bobot ini masih ada dan belum diputuskan).

### F-5 — Layar konfirmasi pembayaran belum ikut migrasi ✅ diperbaiki 2026-09-18

- **Temuan audit:** `resources/js/pages/customer/orders/confirm.tsx` adalah satu-satunya layar alur order customer yang belum pakai token/komponen bersama — 23 kelas palette mentah (`emerald`/`amber`/`red`/`slate`/`blue`/`gray`) dan 12 `<button>` mentah.
- **Perbaikan:** seluruh warna dipindah ke token (`success`/`warning`/`danger`/`info`/`text-*`/`surface*`), radius ke `rounded-card`/`rounded-control`, dan 12 `<button>` menjadi `Button` (varian `primary`+`cta`, `outline`+`cta`, `danger`+`cta`, `ghost`+`lg`, `secondary-brand`+`lg`, `ghost`+`icon`). Tombol ikon kembali (chevron) diberi `aria-label="Kembali"` — sebelumnya tanpa nama aksesibel.
- **Verifikasi:** `types:check`, `lint:check`, `format:check`, Vitest 148/148, `build` hijau; render lokal `/customer/orders/confirm/DOMBI-GATE-A1` — CTA 14/600 h 48, "Salin" 12/600, tidak ada kelas palette tersisa di file.

### Catatan F-6 — Tombol "Batalkan Pesanan" di layar konfirmasi tidak pernah tampil 🟡 (belum diperbaiki)

- Layar konfirmasi menjaga tombol itu dengan `isLoggedIn && order.status === 'pending_confirmation'`, tetapi `OrderController::confirm()` **tidak mengirim** `status` di payload `order` (hanya id, kode, items, total, fulfillment, expiry, payment_method, payment_status, recovery_token, outlet). Jadi `order.status` selalu `undefined` dan tombolnya dead code — di cabang `pending` maupun `paid`.
- **Bukan regresi migrasi F-5** (kondisi itu sudah ada sebelumnya dan markup-nya dipertahankan apa adanya). Diperbaiki = mengirim `'status' => $order->status` dari controller; itu memunculkan tombol baru bagi customer, jadi keputusan produk — belum dieksekusi.

## 8. Hasil gate

| Gate         | Perintah                                          | Target      | Hasil                                             |
| ------------ | ------------------------------------------------- | ----------- | ------------------------------------------------- |
| Types        | `npm run types:check`                             | 0 error     | ✅                                                |
| Lint         | `npm run lint:check`                              | 0 error     | ✅ (1 warning pra-ada di `checkout/customer.tsx`) |
| Format       | `npm run format:check`                            | lolos       | ✅                                                |
| Unit/JS      | `npm run test`                                    | semua lolos | ✅ 33 file, 148 test                              |
| Build        | `npm run build`                                   | sukses      | ✅                                                |
| Hex literal  | grep `#[0-9a-f]{6}` pada file tersentuh           | 0           | ✅                                                |
| Palet mentah | grep `bg-emerald-\|text-red-` pada file tersentuh | 0           | ✅                                                |
| Kanvas       | render vs `op1pF`/`fjKWV`/`ZXG0E`/`p0C6Ta`        | setara      | ✅ 4 dari 4 frame setara (F-2 diperbaiki)         |

## 9. Kesimpulan

1. Fase F terverifikasi visual: label fulfillment seragam (`Pick Up`/`Delivery`, `via Store`/`via Aplikasi`), tanggal relatif hanya di kartu aktif (`Hari ini, 14.20`) sementara riwayat tetap absolut (`27 Mei 2025, 14.49`), dan aksi kartu terminal lengkap (`Beli Lagi` outlined vs `Pesan Ulang` solid).
2. Keempat frame yang dipilih setara dengan render: `op1pF`, `fjKWV`, `p0C6Ta`, dan `ZXG0E` (pita section-nya kini dirender — F-2 diperbaiki lewat slice F.6).
3. Satu temuan masih terbuka: **F-1** (badge refund pada order belum dibayar — serius, memblokir rilis), dijadwalkan sebagai slice F.5 dan belum dieksekusi.
4. Satu hal menunggu keputusan (bukan temuan): radius kartu state kosong — kanvas menggambar siku, implementasi memakai token `rounded-card`.
