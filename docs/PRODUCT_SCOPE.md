# Dombi — Product Scope

**Status:** Draft keputusan soft launch
**Last verified:** 2026-07-27, commit `3a30a9c`, branch `develop`

Dokumen ini adalah sumber kebenaran untuk scope peluncuran. Dokumen roadmap lama
menjelaskan sejarah pengembangan, bukan syarat untuk menunda peluncuran.

## Tujuan Peluncuran

Membuktikan bahwa pelanggan dapat memesan produk yang benar-benar tersedia,
membayar, lalu menerima pesanan melalui pickup atau delivery dari satu outlet tanpa
koreksi transaksi manual.

## Vertical Slice yang Diluncurkan

Peluncuran pertama dibatasi menjadi:

- satu outlet;
- pickup dan delivery dalam zona/radius terbatas;
- 5–20 SKU/variant;
- satu daftar harga;
- guest-first checkout dengan nama dan nomor telepon;
- satu metode pembayaran DOKU yang paling stabil;
- pembayaran online saja, tanpa COD;
- ongkir customer tetap berdasarkan zona/radius;
- tracking order berbasis token;
- antrean outlet: `confirmed → preparing → ready → completed`;
- assignment manual ke kurir Dombi atau Gojek/Grab;
- status delivery manual tanpa GPS live tracking;
- biaya aktual Gojek/Grab dicatat terpisah dari ongkir customer;
- reservasi, expiry, release, dan deduction stok;
- pembatalan sebelum cutoff;
- refund manual minimum oleh owner;
- dukungan exception melalui kanal manual.

### Journey utama

1. Customer melihat katalog, memilih produk, dan memilih pickup atau delivery.
2. Untuk delivery, sistem memvalidasi zona/radius dan menentukan ongkir tetap.
3. Sistem memvalidasi dan mereservasi stok outlet.
4. Customer membuat order dan membayar online.
5. Webhook pembayaran mengonfirmasi pembayaran tepat satu kali.
6. Outlet menyiapkan pesanan.
7. Untuk delivery, outlet memilih kurir Dombi atau mencatat Gojek/Grab secara manual.
8. Kurir Dombi atau operator outlet memperbarui status secara manual.
9. Sistem menyelesaikan order serta mencatat stok dan biaya kurir.

## Role yang Aktif

| Role | Scope launch |
|---|---|
| Customer/guest | Katalog, cart, checkout pickup/delivery, pembayaran online, tracking, cancel |
| Outlet | Memproses order, memilih kurir, mengelola delivery eksternal, melihat stok |
| Owner | Katalog, harga, zona/ongkir, stok, monitoring order/delivery, refund manual |
| Courier | Melihat assignment sendiri dan memperbarui status delivery secara manual |

## Di Luar Scope

Fitur berikut tidak boleh menahan soft launch dan sebaiknya disembunyikan dari
navigasi launch:

- auto-assignment, routing, GPS, shift, dan multi-stop delivery;
- integrasi API Gojek/Grab dan dynamic courier pricing;
- COD dan rekonsiliasi uang tunai kurir;
- invitation/nomination/approval courier sebagai syarat launch;
- multi-outlet dan pricing override per outlet;
- restock pusat, settlement multi-outlet, dan allocation;
- return dan exchange state machine;
- offline sales;
- analytics lanjutan dan export;
- favorites, recipients, repeat order, serta polish retention;
- push notification multi-platform;
- UI standardization, skeleton, empty state, dan redesign non-blocking.

Refund tidak dihapus karena pembayaran online membutuhkan jalur pemulihan dana.
Yang ditunda adalah workflow refund kompleks, bukan kemampuan refund minimum.

## Invariant Bisnis

Peluncuran tidak boleh melanggar aturan berikut:

1. Satu pembayaran hanya boleh mengubah order menjadi paid satu kali.
2. Retry webhook tidak boleh menggandakan efek finansial atau stok.
3. Stok tidak boleh negatif atau dijual melebihi ketersediaan.
4. Cancel/expire harus melepas reservasi stok tepat satu kali.
5. Hanya pemilik order atau role berwenang yang boleh membaca/mengubah order.
6. Transisi status harus mengikuti state machine yang sah.
7. Refund harus dapat ditelusuri ke order, pembayaran, jumlah, dan operator.
8. Order yang belum dibayar tidak boleh di-assign atau dikirim.
9. Ongkir customer tidak boleh berubah karena biaya aktual kurir eksternal.
10. Kurir hanya boleh mengubah delivery yang ditugaskan kepadanya.

## Production Gate

Soft launch hanya boleh dilakukan jika:

- CI otomatis hijau dan wajib sebelum deploy;
- critical-path tests hijau pada MySQL yang reproducible;
- deploy menjalankan migrasi yang sudah direhearsal dan health check;
- rollback atau roll-forward sudah dicoba di staging;
- backup terenkripsi tersimpan offsite dan berhasil direstore;
- DOKU sandbox diuji end-to-end, termasuk webhook duplikat;
- smoke test journey utama berhasil di staging;
- monitoring error, scheduler, queue, dan failed jobs aktif.

UI polish, analytics, dan kelengkapan semua role bukan production gate.

## Metrik Pilot

Ukur hanya metrik yang mengubah keputusan:

- checkout completion rate;
- payment success rate;
- jumlah webhook/payment mismatch;
- stock mismatch dan oversell;
- median waktu preparing sampai ready;
- cancellation dan refund rate;
- order yang membutuhkan koreksi manual;
- repeat purchase setelah jumlah pelanggan memadai.

## Aturan Perubahan Scope

Fitur baru hanya masuk launch scope bila:

1. kegagalan journey utama terbukti terjadi;
2. ada risiko uang, data, keamanan, atau operasional;
3. solusi manual tidak layak untuk volume pilot; dan
4. satu item lain dikeluarkan atau tanggal launch diubah secara sadar.

Keinginan untuk membuat tampilan lebih rapi bukan bukti.

## Bukti Implementasi

- Route dan role: `routes/web.php`
- Order: `app/Services/OrderService.php`
- Inventory: `app/Services/InventoryService.php`
- Payment: `app/Services/PaymentStatusService.php`
- Lifecycle: `app/Services/OrderStatusService.php`
- DOKU: `app/Http/Controllers/DokuPaymentController.php`
