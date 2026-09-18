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

| Elemen       | Frame `ZXG0E`                                                      | Render (orders-3-kosong.png)                        | Hasil              |
| ------------ | ------------------------------------------------------------------ | --------------------------------------------------- | ------------------ |
| Pita section | `Riwayat Pesanan` 12/700 di pita `bg-canvas`, di atas kartu kosong | **tidak dirender**                                  | ❌ F-2             |
| Kartu kosong | putih, padding 28, gap 8, rata tengah                              | sama (`p-7`, `gap-2`, `bg-surface`)                 | ✅                 |
| Ikon         | `package` 38 px `#A1A1AA`                                          | sama (38 px, `text-text-subtle`)                    | ✅                 |
| Judul        | `Yuk belanja lagi` 15/700 heading                                  | sama                                                | ✅                 |
| Salinan      | 11 px, tengah, lebar 300                                           | sama (`text-caption` 11 px, `max-w-[300px]`)        | ✅                 |
| CTA          | `Lihat Menu` fill `#047857`, r=12, padding `[10,18]`, label 12/700 | `Button primary size="md"`: h 40, r token 10, px 16 | ~ literal vs token |
| Sudut kartu  | tanpa `cornerRadius` → siku                                        | `rounded-card` 16 px                                | ~ perlu keputusan  |
| Tambahan app | —                                                                  | kartu "Pernah pesan sebelumnya?" di bawah           | diterima (C.5–C.7) |

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

### F-1 — Badge refund muncul pada pesanan yang belum dibayar 🔴

- **Bukti:** `finding-f1-refund-badge.png`
- **Perilaku:** pesanan dengan `payment_status = 'pending'` merender badge **`Proses Refund`** plus baris refund berlabel mentah `pending`, dan **tombol bayar hilang** (`refundPresentation.suppressActions`). Frame `op1pF` menggambar kartu itu dengan badge `Menunggu Pembayaran` dan tombol `Bayar Sekarang`.
- **Sebab:** `RefundPayloadService::uiStatus()` memetakan `RefundObligationStatus::Pending` (enum value `pending`) → `refund_pending`. `queueState()` memakai `payment_status` sebagai fallback saat tidak ada refund obligation, sehingga `PaymentStatus::Pending` (value yang sama: `pending`) terbaca sebagai refund pending. `paid` dan `null` tidak terpengaruh.
- **Dampak:** order yang menunggu pembayaran kehilangan CTA bayar di daftar pesanan dan salah tampil sebagai proses refund. Terverifikasi juga pada order terminal ber-`payment_status` `pending` (badge `pending` di riwayat). 11 order di DB lokal terdampak.
- **Bukan regresi Fase F** — F.1–F.3 hanya menyentuh label, tanggal, dan aksi kartu; queue refund tidak disentuh. Ditemukan oleh gate ini.
- **Usulan koreksi (slice F.5, dijadwalkan — belum dieksekusi):** batasi fallback ke status refund saja (`str_starts_with($status, 'refund_')`) atau jadikan `selectedRefundObligation()` satu-satunya sumber; tambah test `payment_status = 'pending'` → `queueState() === null` dan `payment_status = 'refund_pending'` → bukan `null`.
- **Kenapa tidak langsung diperbaiki:** menyentuh logika refund/pembayaran, di luar lingkup plan ini ("Tidak menyentuh … logika pembayaran/settlement").

### F-2 — Pita `Riwayat Pesanan` hilang pada state kosong 🟡

- **Bukti:** `orders-3-kosong.png` vs frame `ZXG0E`.
- **Perilaku:** pada akun tanpa pesanan sama sekali (`viewState === 'empty'`), kartu kosong dirender tanpa pita section di atasnya, padahal frame menggambar pita `Riwayat Pesanan` (12/700 di `bg-canvas`, padding `[18,20,8,20]`) di antara chip filter dan kartu.
- **Sebab:** `resources/js/pages/customer/orders/index.tsx` hanya membungkus kartu kosong dengan `SectionLabel` di cabang `viewState === 'recovered'`. Cabang `'empty'` merender `EmptyOrderState` langsung di dalam `<div className="px-5 pb-3">`.
- **Dampak:** kosmetik — tinggi/urutan elemen berbeda dari kanvas pada state pertama kali pengguna membuka halaman; tidak ada perilaku yang salah.
- **Usulan koreksi (slice F.6, dijadwalkan — belum dieksekusi):** bungkus cabang `'empty'` dengan `<section><SectionLabel>Riwayat Pesanan</SectionLabel>…</SectionLabel></section>` seperti cabang `'recovered'`.

### Catatan F-3 — sudut kartu state kosong (butuh keputusan, bukan bug)

Frame `ZXG0E`/`p0C6Ta` menggambar kartu state tanpa `cornerRadius` (siku), sedangkan implementasi memakai `rounded-card` (16 px) — konsisten dengan `Card/Base` dan seluruh kartu lain di kanvas. Kemungkinan besar ini kelalaian frame, bukan maksud desain; kalau kanvas dianggap mengikat, perlu koreksi `EmptyOrderState`, kalau tidak, frame yang perlu dirapikan.

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
| Kanvas       | render vs `op1pF`/`fjKWV`/`ZXG0E`/`p0C6Ta`        | setara      | ⚠️ 3 dari 4 frame setara; 1 pita hilang (F-2)     |

## 9. Kesimpulan

1. Fase F terverifikasi visual: label fulfillment seragam (`Pick Up`/`Delivery`, `via Store`/`via Aplikasi`), tanggal relatif hanya di kartu aktif (`Hari ini, 14.20`) sementara riwayat tetap absolut (`27 Mei 2025, 14.49`), dan aksi kartu terminal lengkap (`Beli Lagi` outlined vs `Pesan Ulang` solid).
2. Tiga dari empat frame yang dipilih setara dengan render: `op1pF`, `fjKWV`, dan `p0C6Ta`. Frame `ZXG0E` (Kosong) belum setara karena pita section hilang (F-2); anatomi kartu kosongnya sendiri sudah sesuai.
3. Dua temuan: **F-1** (badge refund pada order belum dibayar — serius, memblokir rilis) dan **F-2** (pita section hilang di state kosong — kosmetik). Keduanya dijadwalkan sebagai slice koreksi, belum dieksekusi.
4. Satu hal menunggu keputusan (bukan temuan): radius kartu state kosong — kanvas menggambar siku, implementasi memakai token `rounded-card`.
