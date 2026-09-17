# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## Dombi — Operational Commerce Platform

**STATUS: DRAFT SEMENTARA**

| | |
| --- | --- |
| **Nama Produk** | Dombi — Platform Operasional Bisnis Susu Kambing |
| **Versi Dokumen** | v0.1 |
| **Disusun oleh** | Arya Ajisadda (Pengembang) |
| **Untuk** | Arya Ajisadda (Klien / Owner) |
| **Tanggal** | 2026-09-17 |
| **Dokumen Terkait** | Product Scope (2026-07-27), PRD.md v0.2 (2026-08-06), PRD Gap Report (2026-08-09), Product Domain Specification, Production Checklist, Staging Smoke (2026-09-15) |

---

# 1. Ringkasan Produk (Overview)

Bisnis susu kambing Dombi saat ini beroperasi dengan proses yang tersebar: pesanan masuk via WhatsApp dan telepon, stok dicatat di kertas atau spreadsheet, pengantaran diatur langsung ke kurir, dan laporan keuangan disusun per akhir periode tanpa data real-time. Kondisi ini menyebabkan kesalahan stok, keterlambatan pengantaran, koreksi transaksi manual, serta tidak adanya transparansi status pesanan bagi pelanggan maupun mitra outlet.

Dombi adalah operational commerce platform berbasis web (PWA dan Android) yang menangani siklus penuh operasi harian: katalog produk → keranjang → checkout → pembayaran online → persiapan pesanan → pengantaran → penyelesaian order → settlement keuangan. Sistem menyediakan empat panel peran (Customer, Outlet, Owner, Courier) dengan pendekatan mobile-first, dilengkapi manajemen stok pusat dan outlet, restock, return/exchange, penjualan offline, serta dashboard analitik. Tujuan besarnya: memusatkan seluruh operasi bisnis dalam satu platform, menghilangkan koreksi transaksi manual, dan memberikan transparansi real-time kepada semua pihak.

# 2. Tujuan & Sasaran (Goals)

- Memusatkan seluruh operasi pesanan, stok, pengantaran, dan keuangan dalam satu platform terintegrasi.
- Menghilangkan koreksi transaksi manual yang disebabkan kesalahan stok, pembayaran, dan pencatatan pengantaran.
- Menyediakan data real-time untuk pengambilan keputusan bisnis (omset, margin, stok, performa outlet).
- Memberikan transparansi status pesanan kepada pelanggan tanpa perlu menghubungi admin.
- Mengotomatisasi perhitungan settlement dan pencatatan biaya kurir antara owner dan outlet.
- Menjaga integritas transaksi (pembayaran tepat sekali, stok tidak pernah negatif, refund tertelusuri) agar bisnis aman beroperasi tanpa pengawasan manual.

# 3. Pengguna & Peran (Users & Roles)

- **Customer :** Pembeli produk. Bisa guest atau terdaftar. Melihat katalog, mengelola keranjang dan alamat, checkout pickup/delivery, membayar online, melacak status pesanan, membatalkan, mengajukan refund/return/exchange, dan menyimpan produk favorit.
- **Outlet :** Staf titik penjualan. Memproses pesanan masuk (confirm → preparing → ready), memilih kurir pengantaran, mengelola stok outlet dan pengajuan restock ke pusat, menjalankan stock opname, mencatat penjualan offline, serta melihat settlement dan laporan penjualan.
- **Owner :** Pemilik bisnis. Mengelola katalog, kategori, harga global dan override per outlet, zona ongkir, stok pusat dan distribusi, memverifikasi pembayaran settlement, mengelola kurir internal dan eksternal, menangani refund manual, serta memantau dashboard analitik dan keuangan.
- **Courier :** Kurir pengantar. Melihat daftar penugasan, memperbarui status pengantaran (picked → delivering → delivered/failed), melihat detail pesanan dan alamat, serta melihat riwayat pengantaran.

# 4. Ruang Lingkup (Scope)

## 4.1 Termasuk (MVP)

- Katalog produk (ProductCategory → Product) dengan ProductFlavorGroup, multi-flavor bulk creation, gambar, dan SKU auto-generate.
- Keranjang, alamat pengantaran, penerima alternatif, checkout pickup, dan checkout delivery dengan validasi zona/radius.
- Guest checkout dan login (Google OAuth + verifikasi telepon) dengan order tracking berbasis token.
- Pembayaran online via DOKU (QRIS, Transfer Bank/VA, E-Wallet, Kartu Kredit) dengan modal pembayaran in-app dan webhook idempotent.
- Order lifecycle berbasis state machine (pending_confirmation → confirmed → preparing → ready_for_pickup → picked_up → delivering → completed) lengkap dengan cancel, reject, expired, dan failed_delivery.
- Manajemen stok outlet dan pusat: reservasi, deduction, release, distribusi, restock request, dan stock opname.
- Manajemen pengantaran: kurir Dombi (pusat dan outlet) dan kurir eksternal (Gojek/Grab) dengan pemisahan ongkir pelanggan dan biaya aktual kurir.
- Refund obligation end-to-end, return request, dan exchange request dengan penyesuaian stok.
- Penjualan offline outlet dan net settlement per outlet per periode (mingguan/bulanan) dengan alokasi pembayaran manual.
- Jam operasional outlet dan jadwal libur berbasis WIB dengan auto-select outlet yang buka.
- Notifikasi push (VAPID web + FCM Android) dan notifikasi in-app untuk semua peran.
- Dashboard analitik owner (KPI cards, charts) dan ekspor laporan penjualan ke CSV.
- PWA untuk instalasi di Android dan wrapper Capacitor untuk APK customer serta internal.
- Audit log untuk perubahan status pesanan, settlement, inventaris, dan harga.

## 4.2 Di Luar Lingkup Awal / Fase Lanjutan

Fitur yang belum dibangun pada rilis ini dijelaskan pada Bab 11.

- Auto-assignment kurir, routing, dan GPS live tracking.
- Integrasi API Gojek/Grab (saat ini pencatatan manual oleh outlet).
- COD dan rekonsiliasi uang tunai kurir.
- Multi-outlet stock transfer langsung antar outlet (saat ini melalui pusat).
- Customer native app iOS/Android dengan fitur native lanjutan.
- Automated restocking berbasis velocity penjualan.
- PDF invoice generation.
- Advanced analytics (cohort, customer lifetime value, prediksi demand) dan multi-language.

# 5. Asumsi & Batasan (Assumptions & Constraints)

- **Database :** MySQL 8, charset utf8mb4, timezone operasional WIB (Asia/Jakarta).
- **Backend :** Laravel 13 + PHP 8.3, queue berbasis database driver.
- **Frontend :** React 19 + TypeScript + Inertia.js + Tailwind CSS v4.
- **Mobile :** Capacitor wrapper untuk APK Android customer dan internal; PWA untuk instalasi via browser.
- **Hosting :** Hostinger shared hosting. Staging di `staging.dombicenter.com`, production di `app.dombicenter.com`.
- **CI/CD :** GitHub Actions sebagai mekanisme canonical. Push ke `develop` men-deploy staging, push ke `main` men-deploy production, keduanya setelah quality gate lulus.
- **Pembayaran :** DOKU sebagai satu-satunya payment gateway. Model runtime canonical memakai `PaymentAttempt` sebagai satu-satunya sumber pembayaran dan `RefundObligation` sebagai satu-satunya sumber refund; tabel legacy dipertahankan untuk audit dan rollback.
- **Peran :** Tepat empat role — Customer, Outlet, Owner, Courier.
- **Asumsi pengembang — infrastruktur :** Redis tidak dipakai; database queue dinilai cukup untuk volume pilot. Sentry sudah dikonfigurasi untuk error tracking.
- **Asumsi pengembang — kurir eksternal :** Biaya aktual Gojek/Grab dicatat manual dan tidak mengubah ongkir yang dibayar pelanggan.
- **Asumsi pengembang — backup :** Backup berjalan lokal di Hostinger, tanpa offsite S3. Cakupan offsite dinyatakan waived untuk rilis ini.
- **Batasan — integritas :** Satu pembayaran hanya boleh mengubah pesanan menjadi paid tepat satu kali; stok tidak boleh negatif; pembatalan dan kedaluwarsa harus melepas reservasi stok tepat satu kali.
- **Batasan — status rilis :** Cutover production masih menunggu bukti release operasional (smoke test staging skenario 2–5, verifikasi kredensial DOKU live, konfirmasi document root production).

# 6. Kebutuhan Fungsional (Functional Requirements)

## 6.1 Customer — Katalog & Keranjang

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **CUST-1** | Customer dapat melihat katalog produk dengan filter kategori, pencarian nama/SKU/flavor/size, dan gambar produk | **Wajib** |
| **CUST-2** | Customer dapat menambahkan produk ke keranjang dan mengubah jumlah item | **Wajib** |
| **CUST-3** | Customer dapat memilih outlet tempat produk diambil atau dikirim | **Wajib** |
| **CUST-4** | Customer dapat melihat daftar favorit dan menambah/menghapus produk dari favorit | **Penting** |
| **CUST-5** | Customer dapat melihat halaman detail produk lengkap dengan harga sesuai outlet terpilih | **Wajib** |

## 6.2 Customer — Checkout & Pengantaran

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **CHK-1** | Customer dapat memilih metode pemenuhan pickup atau delivery saat checkout | **Wajib** |
| **CHK-2** | Untuk delivery, sistem memvalidasi zona/radius outlet dan menghitung ongkir tetap berdasarkan tier jarak | **Wajib** |
| **CHK-3** | Customer (guest) dapat checkout hanya dengan nama dan nomor telepon tanpa registrasi | **Wajib** |
| **CHK-4** | Customer dapat menyimpan alamat pengantaran dan menjadikannya alamat default | **Wajib** |
| **CHK-5** | Customer dapat menambahkan penerima (recipient) untuk pengantaran ke alamat berbeda | **Penting** |
| **CHK-6** | Sistem memvalidasi ketersediaan stok outlet dan mereservasi stok saat checkout | **Wajib** |
| **CHK-7** | Sistem menolak checkout ketika outlet sedang tutup dan menampilkan mode browse-only | **Wajib** |
| **CHK-8** | Sistem memvalidasi kepemilikan alamat yang dipilih agar hanya alamat milik customer terkait yang dapat dipakai | **Wajib** |

## 6.3 Customer — Akun & Preferensi

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **ACC-1** | Customer dapat masuk menggunakan Google OAuth | **Penting** |
| **ACC-2** | Customer dapat memverifikasi nomor telepon setelah pendaftaran | **Penting** |
| **ACC-3** | Sistem dapat mempromosikan guest menjadi akun terdaftar tanpa kehilangan riwayat pesanan | **Penting** |
| **ACC-4** | Customer dapat memulihkan pesanan guest menggunakan nomor telepon dan token pemulihan | **Wajib** |
| **ACC-5** | Customer dapat mengulang pesanan sebelumnya dan memulihkan keranjang dari riwayat | **Penting** |

## 6.4 Customer — Pesanan, Tracking & Pembatalan

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **ORD-1** | Customer dapat melihat daftar pesanan aktif dan riwayat pesanan | **Wajib** |
| **ORD-2** | Customer dapat melihat detail pesanan beserta ringkasan pembayaran, pengantaran, dan status refund | **Wajib** |
| **ORD-3** | Guest dapat melacak status pesanan menggunakan token unik pada halaman tracking | **Wajib** |
| **ORD-4** | Customer dapat membatalkan pesanan selama status masih mengizinkan dan belum melewati cutoff | **Wajib** |
| **ORD-5** | Sistem membatasi pembatalan guest dengan rate limiting pada endpoint terkait | **Wajib** |
| **ORD-6** | Customer dapat melihat halaman konfirmasi pesanan setelah pembayaran berhasil | **Wajib** |
| **ORD-7** | Customer dapat melaporkan masalah pada pesanan (order report) dengan kategori dan catatan | **Penting** |

## 6.5 Customer — Refund, Return & Exchange

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **REF-1** | Customer dapat mengajukan refund untuk pesanan yang sudah dibayar | **Wajib** |
| **REF-2** | Customer dapat melengkapi dan memperbarui data tujuan refund (bank/e-wallet) | **Wajib** |
| **REF-3** | Customer dapat melihat status refund beserta timeline dan ringkasan tujuan refund | **Penting** |
| **REF-4** | Sistem menampilkan badge status refund pada pesanan aktif di halaman riwayat pesanan | **Penting** |
| **REF-5** | Customer dapat mengajukan return request dengan alasan dan bukti pendukung | **Penting** |
| **REF-6** | Customer/sistem dapat membuat exchange request sebagai kelanjutan return request | **Penting** |

## 6.6 Sistem — Pembayaran DOKU

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **PAY-1** | Customer dapat memilih metode pembayaran (QRIS, Transfer Bank, E-Wallet, Kartu Kredit) dan sistem membuat sesi pembayaran DOKU | **Wajib** |
| **PAY-2** | Sistem menampilkan modal pembayaran DOKU secara in-app tanpa berpindah halaman penuh | **Wajib** |
| **PAY-3** | Sistem memproses webhook DOKU secara idempotent sehingga satu pembayaran hanya mengubah status menjadi paid satu kali | **Wajib** |
| **PAY-4** | Sistem menyediakan sinkronisasi status pembayaran (polling dan rekonsiliasi terjadwal) sebagai jalur cadangan bila webhook tidak masuk | **Wajib** |
| **PAY-5** | Customer dapat melakukan retry pembayaran ketika pembayaran sebelumnya gagal atau kedaluwarsa | **Wajib** |
| **PAY-6** | Sistem menghitung payment fee berdasarkan metode pembayaran dan ambang subtotal, serta memisahkan fee yang diserap | **Penting** |
| **PAY-7** | Sistem membatalkan pesanan otomatis bila pembayaran tidak selesai sebelum batas waktu konfirmasi outlet | **Wajib** |
| **PAY-8** | Sistem mencatat setiap upaya pembayaran beserta status gateway, status settlement, dan status verifikasi | **Wajib** |
| **PAY-9** | Sistem menangani pembayaran yang masuk setelah pesanan kedaluwarsa sebagai kewajiban refund late payment | **Penting** |
| **PAY-10** | Sistem menyelaraskan batas waktu pembayaran DOKU dengan batas waktu konfirmasi pesanan pada aplikasi | **Penting** |

## 6.7 Outlet — Manajemen Pesanan

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **OUT-1** | Outlet dapat melihat daftar pesanan masuk dan mengonfirmasinya | **Wajib** |
| **OUT-2** | Outlet dapat memajukan status pesanan: confirmed → preparing → ready_for_pickup → completed | **Wajib** |
| **OUT-3** | Outlet dapat memilih kurir untuk pesanan delivery, baik kurir Dombi maupun kurir eksternal | **Wajib** |
| **OUT-4** | Outlet dapat menolak pesanan dengan alasan yang telah ditentukan | **Wajib** |
| **OUT-5** | Outlet dapat melihat riwayat pesanan dengan filter status dan tanggal | **Penting** |
| **OUT-6** | Outlet dapat melihat detail pesanan lengkap dengan item, pembayaran, dan pengantaran | **Wajib** |
| **OUT-7** | Sistem menampilkan notifikasi pesanan baru kepada outlet | **Penting** |

## 6.8 Outlet — Inventaris, Restock & Opname

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **INV-1** | Outlet dapat melihat stok produk di outlet masing-masing beserta indikator stok minimum | **Wajib** |
| **INV-2** | Outlet dapat mengajukan restock request ke pusat beserta item dan jumlahnya | **Wajib** |
| **INV-3** | Outlet dapat mencatat penerimaan stok dengan catatan penerimaan dan catatan kerusakan | **Wajib** |
| **INV-4** | Outlet dapat menjalankan stock opname untuk merekonsiliasi stok fisik dengan stok sistem | **Penting** |
| **INV-5** | Sistem mencatat setiap pergerakan stok (movement) beserta stok sebelum dan sesudah | **Wajib** |

## 6.9 Outlet — Penjualan Offline, Settlement & Laporan

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **OSL-1** | Outlet dapat mencatat penjualan offline beserta produk, jumlah, dan metode pembayaran | **Penting** |
| **OSL-2** | Outlet dapat melihat settlement periode berjalan beserta rinciannya | **Penting** |
| **OSL-3** | Outlet dapat melihat laporan penjualan dengan filter periode dan status | **Penting** |
| **OSL-4** | Outlet dapat mengirim bukti pembayaran settlement kepada owner | **Penting** |

## 6.10 Outlet — Jam Operasional

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **HRS-1** | Outlet dapat mengatur jam buka dan tutup per hari dalam seminggu | **Wajib** |
| **HRS-2** | Outlet dapat mengatur jadwal libur dengan rentang tanggal dan alasan | **Penting** |
| **HRS-3** | Sistem menentukan status buka/tutup outlet berdasarkan waktu WIB dan jadwal yang berlaku | **Wajib** |

## 6.11 Owner — Katalog, Kategori & Harga

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **OWN-1** | Owner dapat mengelola kategori produk (ProductCategory) beserta gambar dan status aktif | **Wajib** |
| **OWN-2** | Owner dapat mengelola produk (Product) termasuk flavor, size, SKU, gambar, dan status aktif | **Wajib** |
| **OWN-3** | Owner dapat membuat banyak produk sekaligus dalam satu kategori (multi-flavor bulk creation) | **Wajib** |
| **OWN-4** | Sistem menghasilkan SKU otomatis bila kolom SKU dikosongkan, dengan pola deterministik dan unik | **Penting** |
| **OWN-5** | Owner dapat mengelompokkan produk berdasarkan flavor group | **Penting** |
| **OWN-6** | Owner dapat mengatur harga pusat, harga jual global, dan override harga per outlet | **Wajib** |
| **OWN-7** | Sistem menegakkan validasi harga: harga pusat ≥ 0 dan harga jual ≥ harga pusat | **Wajib** |
| **OWN-8** | Owner dapat mengelola zona ongkir dan tarif berdasarkan tier jarak | **Wajib** |
| **OWN-9** | Owner dapat menonaktifkan atau menghapus produk/kategori sesuai aturan riwayat transaksi | **Penting** |
| **OWN-10** | Owner dapat menetapkan produk sebagai rekomendasi untuk ditampilkan ke customer | **Penting** |

## 6.12 Owner — Stok Pusat & Distribusi

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **STK-1** | Owner dapat mengelola stok pusat (center stock) | **Wajib** |
| **STK-2** | Owner dapat mendistribusikan stok dari pusat ke outlet | **Wajib** |
| **STK-3** | Owner dapat menyetujui atau menolak restock request dari outlet beserta jumlah yang disetujui | **Wajib** |
| **STK-4** | Owner dapat menetapkan stok awal produk saat produk baru dibuat | **Penting** |
| **STK-5** | Sistem mengirim notifikasi low-stock kepada owner | **Penting** |

## 6.13 Owner — Keuangan & Settlement

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **FIN-1** | Owner dapat melihat dashboard keuangan (omset, margin, biaya kurir) | **Wajib** |
| **FIN-2** | Sistem menghasilkan net settlement per outlet per periode (mingguan/bulanan) yang menggabungkan outlet share pesanan online, biaya kurir, refund, dan setoran penjualan offline | **Wajib** |
| **FIN-3** | Owner dapat memverifikasi pembayaran settlement dan mengalokasikannya ke settlement tertentu | **Wajib** |
| **FIN-4** | Sistem mengirim reminder pembayaran settlement kepada outlet | **Penting** |
| **FIN-5** | Owner dapat melakukan refund manual dengan penelusuran ke pesanan, pembayaran, nominal, dan operator | **Wajib** |
| **FIN-6** | Owner dapat mengelola rekening pembayaran (payment account) | **Penting** |
| **FIN-7** | Sistem mencatat kewajiban dan piutang outlet (OutletPayable) beserta sisa pembayaran | **Penting** |
| **FIN-8** | Sistem menyediakan audit log untuk perubahan settlement dan keuangan | **Penting** |

## 6.14 Owner — Kurir & Pengantaran

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **DEL-1** | Owner dapat mengelola kurir Dombi pusat dan outlet, termasuk undangan, nominasi, dan persetujuan | **Wajib** |
| **DEL-2** | Owner dapat mengelola kurir eksternal (Gojek/Grab) beserta pencatatan biaya aktual | **Wajib** |
| **DEL-3** | Owner dapat melihat margin pengantaran secara real-time saat menugaskan kurir | **Penting** |
| **DEL-4** | Owner dapat melihat riwayat pengantaran dan pemantauan SLA | **Penting** |
| **DEL-5** | Owner dapat menangani pengantaran gagal (failed delivery) beserta resolusi dan retry | **Penting** |

## 6.15 Owner — Analitik & Pelaporan

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **ANA-1** | Owner dapat melihat dashboard analitik dengan KPI dan chart penjualan | **Penting** |
| **ANA-2** | Owner dapat mengekspor laporan penjualan ke CSV | **Penting** |
| **ANA-3** | Owner dapat melihat laporan per periode dengan filter tanggal | **Penting** |
| **ANA-4** | Owner dapat melihat tren pendapatan dan ringkasan performa per outlet | **Penting** |

## 6.16 Courier — Pengantaran

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **CR-1** | Courier dapat melihat daftar penugasan pengantaran miliknya sendiri | **Wajib** |
| **CR-2** | Courier dapat memperbarui status pengantaran: picked_up → delivering → delivered atau failed | **Wajib** |
| **CR-3** | Courier dapat melihat detail pesanan dan alamat pengantaran | **Wajib** |
| **CR-4** | Courier dapat melihat riwayat pengantaran | **Penting** |
| **CR-5** | Courier dapat mencatat penerima, catatan pengantaran, dan bukti pengantaran | **Penting** |
| **CR-6** | Sistem menampilkan notifikasi saat ada penugasan baru | **Penting** |
| **CR-7** | Courier dapat menerima undangan kurir dan melengkapi data profilnya | **Penting** |

## 6.17 Sistem — Notifikasi, Operasional & Keamanan

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **SYS-1** | Sistem mengirim push notification (VAPID web dan FCM Android) untuk peristiwa penting: pesanan baru, perubahan status, restock, dan settlement | **Wajib** |
| **SYS-2** | Sistem menyediakan pusat notifikasi in-app dengan bell icon dan notification sheet | **Wajib** |
| **SYS-3** | Sistem mengelola operating hours berbasis WIB dan memilih outlet yang buka secara otomatis | **Wajib** |
| **SYS-4** | Sistem membatalkan pesanan otomatis yang melewati batas waktu pembayaran melalui scheduler | **Wajib** |
| **SYS-5** | Sistem mencatat audit log untuk perubahan status pesanan, settlement, inventaris, dan harga | **Penting** |
| **SYS-6** | Sistem memberlakukan role-based access control pada setiap route dan aksi | **Wajib** |
| **SYS-7** | Sistem memverifikasi signature webhook DOKU, memvalidasi umur pesan, dan mengunci status pembayaran terminal | **Wajib** |
| **SYS-8** | Sistem menyediakan endpoint health check dan version untuk pemantauan | **Penting** |
| **SYS-9** | Sistem memproses pekerjaan latar (queue) untuk notifikasi dan outbox event | **Penting** |
| **SYS-10** | Sistem menyediakan command pemeliharaan untuk rekonsiliasi pembayaran dan verifikasi status runtime | **Penting** |

# 7. Alur Pengguna Utama (Key User Flows)

## 7.1 Customer — Pesanan Delivery (Happy Path)

1. Customer membuka katalog, memilih produk, dan menambahkan ke keranjang.
2. Customer memilih "Delivery", memilih atau memasukkan alamat; sistem memvalidasi zona/radius dan menghitung ongkir.
3. Sistem memvalidasi stok outlet dan mereservasi stok.
4. Customer mengisi nama dan nomor telepon (guest checkout) lalu mengirim pesanan.
5. Customer memilih metode pembayaran dan modal pembayaran DOKU terbuka secara in-app.
6. Customer menyelesaikan pembayaran di DOKU.
7. Sistem menerima webhook atau mendeteksi status via polling, memverifikasi signature dan nominal, lalu mengubah status pembayaran menjadi "paid" tepat satu kali.
8. Outlet menerima notifikasi pesanan baru dan mengonfirmasi pesanan.
9. Outlet menyiapkan pesanan, lalu menandai siap.
10. Outlet memilih kurir (Dombi atau eksternal Gojek/Grab).
11. Kurir mengambil pesanan, mengantarkan, dan menandai selesai.
12. Sistem menyelesaikan pesanan, mencatat stok terjual, biaya kurir, dan menyiapkan komponen settlement.

## 7.2 Customer — Pesanan Pickup

1. Customer memilih "Pickup" saat checkout dan memilih outlet yang tersedia.
2. Alur berjalan sama dengan delivery hingga status siap diambil.
3. Customer mengambil pesanan di outlet, lalu outlet menandai pesanan selesai.

## 7.3 Customer — Pembatalan Pesanan

1. Customer atau guest (melalui halaman tracking) memilih membatalkan pesanan.
2. Sistem menampilkan dialog pembatalan dan meminta alasan.
3. Sistem memvalidasi bahwa status pesanan masih mengizinkan pembatalan dan cutoff belum terlewati.
4. Status pesanan berubah menjadi "dibatalkan oleh customer" dan reservasi stok dilepas tepat satu kali.
5. Rate limiting pada endpoint pembatalan mencegah penyalahgunaan.
6. Setelah berhasil, customer diarahkan kembali ke halaman daftar pesanan secara in-app.

## 7.4 Outlet — Memproses Pesanan

1. Outlet menerima notifikasi pesanan baru.
2. Outlet membuka dashboard dan melihat pesanan berstatus dibayar.
3. Outlet mengonfirmasi pesanan.
4. Outlet menyiapkan pesanan.
5. Outlet menandai pesanan siap diambil atau siap dikirim.
6. Untuk delivery, outlet membuka panel penugasan kurir dan memilih kurir Dombi atau memasukkan data kurir eksternal.
7. Outlet dapat menolak pesanan dengan alasan bila tidak dapat dipenuhi.

## 7.5 Owner — Verifikasi Settlement

1. Sistem menghasilkan settlement per outlet per periode.
2. Owner melihat daftar settlement pada dashboard keuangan.
3. Owner membuka detail settlement dan meninjau rincian serta komponennya.
4. Outlet melakukan pembayaran dan mengirim bukti.
5. Owner memverifikasi pembayaran dan mengalokasikan nominal ke settlement terkait.
6. Sistem mencatat alokasi dan memperbarui status settlement.

## 7.6 Owner — Refund Manual

1. Customer mengajukan refund pada pesanan yang sudah dibayar dan melengkapi data tujuan refund.
2. Sistem mencatat kewajiban refund dan menampilkan statusnya.
3. Owner meninjau permintaan refund beserta data tujuan.
4. Owner memproses transfer dan mengunggah bukti.
5. Sistem mencatat referensi transfer dan menandai refund selesai, tertelusuri ke pesanan, pembayaran, nominal, dan operator.

# 8. Model Data (High-Level)

| **Entitas** | **Field Utama** | **Keterangan** |
| --- | --- | --- |
| **User** | id, name, email, phone, role, outlet_id, provider, is_active, latitude, longitude | Akun untuk role owner, outlet, courier, dan customer tertentu |
| **Customer** | id, name, phone, email, password | Data customer terdaftar |
| **CustomerAddress** | id, customer_id, label, recipient_name, phone, address, latitude, longitude, is_default | Alamat pengantaran tersimpan |
| **Recipient** | id, customer_id, label, name, phone, address_line, latitude, longitude, is_default | Penerima alternatif untuk pengantaran |
| **Favorite** | id, customer_id, product_id | Produk favorit customer |
| **ProductCategory** | id, name, brand, description, image, is_active | Kategori produk |
| **ProductFlavorGroup** | id, product_category_id, flavor, normalized_flavor, image, is_active | Pengelompokan rasa dalam kategori |
| **Product** | id, product_category_id, product_flavor_group_id, name, flavor, size, sku, center_price, selling_price, center_stock, image, is_active, is_recommended | Produk/variant |
| **OutletProductPrice** | id, outlet_id, product_id, selling_price | Override harga per outlet |
| **Outlet** | id, user_id, name, address, latitude, longitude, delivery_radius_km, prep_estimate_minutes, status, confirmation_timeout_minutes, bank_name, bank_account_number | Titik penjualan |
| **OutletInventory** | id, outlet_id, product_id, current_stock, reserved_stock, minimum_stock, is_active, last_restock_at | Stok per outlet |
| **StockMovement** | id, outlet_id, product_id, type, quantity, before_stock, after_stock, before_reserved, after_reserved, reference_type, reference_id | Pergerakan stok |
| **OutletOperatingHours** | id, outlet_id, day_of_week, open_time, close_time, is_closed | Jam operasional per hari |
| **OutletHoliday** | id, outlet_id, start_date, end_date, reason | Jadwal libur outlet |
| **Order** | id, customer_id, outlet_id, order_code, recovery_token, guest_token, status, fulfillment_type, subtotal, delivery_fee, payment_method, payment_fee, total, payment_status, paid_at, confirmation_expires_at, cancelled_at, completed_at | Pesanan utama |
| **OrderItem** | id, order_id, product_id, product_name, variant_name_snapshot, quantity, price, center_price_snapshot, selling_price_snapshot, outlet_margin_snapshot, subtotal | Item pesanan |
| **OrderStatusHistory** | id, order_id, from_status, to_status, reason, notes, changed_by, changed_by_type | Riwayat status pesanan |
| **OrderReport** | id, order_id, customer_id, type, notes, status | Laporan masalah pesanan |
| **DeliveryTier** | id, min_km, max_km, fee, is_active, sort_order | Zona ongkir berdasarkan jarak |
| **Delivery** | id, order_id, courier_id, status, courier_type, courier_cost, external_courier_name, external_provider, external_reference, resolution_status, proof_image | Pengantaran pesanan |
| **DeliveryStatusHistory** | id, delivery_id, from_status, to_status, changed_by_type, changed_by_id, reason, notes | Riwayat status pengantaran |
| **DeliveryResolutionLog** | id, delivery_id, resolution_status, notes, resolved_by | Log resolusi pengantaran gagal |
| **CourierProfile** | id, user_id, courier_source, outlet_id, invitation_status, approved_by, total_deliveries, rating | Profil kurir Dombi |
| **CourierInvitation** | id, invited_by, courier_user_id, phone, name, token, status, expires_at | Undangan kurir |
| **CourierNominationReview** | id, courier_profile_id, reviewer_id, decision, notes | Review nominasi kurir |
| **PaymentAttempt** | id, order_id, attempt_key, invoice_number, session_token, payment_method, amount_snapshot, gateway_amount, gateway_status, creation_state, settlement_status, verification_status, reconciliation_status, raw_response | Sumber pembayaran runtime canonical |
| **PaymentWebhookLog** | id, request_id, source, invoice_number, status, signature_valid, mapped_status, payload, body_digest, error | Audit log webhook pembayaran |
| **PaymentOutboxEvent** | id, event_key, event_type, aggregate_type, aggregate_id, payload, status, attempts, next_attempt_at, consumer_status | Outbox event pembayaran |
| **PaymentAccount** | id, bank_name, account_number, account_holder, is_active | Rekening pembayaran owner |
| **RefundObligation** | id, payment_attempt_id, amount, currency, reason, status, destination_type, bank_name, account_number, transfer_reference, proof_image, processed_by, requested_at, completed_at | Sumber refund runtime canonical |
| **RefundStatusHistory** | id, order_id, from_status, to_status, event, actor_type, actor_id, reason_code, note | Riwayat status refund |
| **ReturnRequest** | id, outlet_id, requested_by, reason, evidence_images, status, reviewed_by, received_by, total_value | Permintaan pengembalian barang |
| **ReturnRequestItem** | id, return_request_id, product_id, quantity, unit_price, subtotal, disposition | Item pengembalian |
| **ExchangeRequest** | id, return_request_id, outlet_id, requested_by, status, reviewed_by, shipped_by, received_by, return_value, exchange_value | Permintaan tukar barang |
| **ExchangeRequestItem** | id, exchange_request_id, product_id, replacement_product_id, quantity, replacement_quantity, unit_price, subtotal | Item tukar barang |
| **RestockRequest** | id, outlet_id, requested_by, status, notes, owner_notes, approved_by, sent_by, received_by, received_notes, damage_notes | Permintaan restock outlet ke pusat |
| **RestockRequestItem** | id, restock_request_id, product_id, requested_quantity, approved_quantity | Item restock |
| **OfflineSale** | id, outlet_id, product_id, quantity, center_price, total_amount, payment_method, created_by | Penjualan langsung di outlet |
| **Settlement** | id, outlet_id, period_start, period_end, period_type, total_online_share, total_delivery_cost, total_refund, total_offline_sales, net_amount, direction, status, paid_amount, adjustment_amount | Net settlement per outlet per periode |
| **SettlementPayment** | id, outlet_id, direction, settlement_id, reference_number, payment_date, amount, proof_image, status, verified_by | Pembayaran settlement |
| **SettlementPaymentAllocation** | id, settlement_payment_id, settlement_id, allocated_amount | Alokasi pembayaran ke settlement |
| **SettlementAuditLog** | id, settlement_id, action, actor_id, payload | Audit log settlement |
| **OutletPayable** | id, outlet_id, order_id, type, amount, center_share, outlet_margin, due_date, paid_amount, remaining_amount | Kewajiban/piutang outlet |
| **OutletAuditLog** | id, outlet_id, field, old_value, new_value, changed_by | Audit perubahan data outlet |
| **PricingAuditLog** | id, product_id, outlet_id, old_price, new_price, changed_by | Audit perubahan harga |
| **Notification** | id, user_type, user_id, customer_id, type, title, message, data, entity_type, entity_id, read_at | Notifikasi in-app |
| **PushFcmToken** | id, user_id, customer_id, fcm_token, device_type | Token push notification perangkat |

**Catatan:** field dalam [tanda kurung siku] merupakan bagian dari fitur usulan/Fase Lanjutan (Bab 11). Tidak ada field Fase Lanjutan pada tabel di atas karena seluruh entitas yang tercantum sudah termasuk dalam lingkup MVP rilis ini.

# 9. Kebutuhan Non-Fungsional (Non-Functional Requirements)

- **Responsivitas :** Seluruh antarmuka berfungsi pada mobile (360px ke atas), tablet, dan desktop. Pendekatan mobile-first dengan breakpoint Tailwind standar. Setiap elemen interaktif memiliki touch target minimal 44x44px.
- **Keamanan :** Role-based access control pada setiap route. CSRF protection untuk semua mutasi. Verifikasi signature webhook DOKU. Pengecekan umur pesan webhook dan guard status pembayaran terminal. Pengecekan kepemilikan data pada alamat, pesanan, dan penugasan kurir.
- **Integritas Transaksi :** Satu pembayaran mengubah status paid tepat satu kali (compare-and-swap). Reservasi stok dilepas tepat satu kali pada pembatalan/kedaluwarsa. Stok tidak pernah negatif. Transisi status mengikuti state machine yang sah. Perhitungan stok dan webhook memakai locking untuk mencegah race condition.
- **Ketahanan Koneksi :** Push notification via VAPID (web) dan FCM (Android) agar pengguna tetap menerima informasi tanpa membuka aplikasi. PWA service worker untuk caching aset statis.
- **Skalabilitas :** Pemrosesan berbasis queue untuk notifikasi dan outbox event. Scheduler untuk pembatalan otomatis, rekonsiliasi pembayaran, dan reminder settlement.
- **Privasi Data :** Data pembayaran diproses oleh DOKU dan tidak disimpan sebagai data kartu di sistem. Data guest disimpan sebatas kebutuhan pemrosesan pesanan dan pemulihan.
- **Performa :** Target waktu respons di bawah 500ms untuk halaman utama. Pencegahan N+1 dengan eager loading. Penggunaan skeleton screen pada transisi halaman Inertia.
- **Observabilitas :** Endpoint health check dan version. Error tracking via Sentry. Pencatatan audit log untuk status, keuangan, inventaris, dan harga.
- **Konsistensi Waktu :** Seluruh operasi outlet mengikuti WIB (Asia/Jakarta), termasuk jam operasional, scheduler, dan batas waktu konfirmasi pesanan.

# 10. Integrasi Pihak Ketiga

| **Layanan** | **Fungsi** | **Catatan** |
| --- | --- | --- |
| **DOKU** | Payment gateway (QRIS, Transfer Bank/VA, E-Wallet, Kartu Kredit) | Sandbox aktif untuk staging; production menunggu kredensial DOKU live. Callback `https://app.dombicenter.com/payment/doku/notify`. Modal pembayaran in-app |
| **Firebase Cloud Messaging (FCM)** | Push notification ke perangkat Android | Dipakai melalui Capacitor untuk APK. Jalur FCM masih memakai API legacy dan menjadi kandidat migrasi ke HTTP v1 |
| **Google OAuth** | Login customer | Redirect URI production `https://app.dombicenter.com/oauth/google/callback` |
| **Capacitor** | Wrapper Android APK | Build APK customer dan internal dari basis PWA |
| **Hostinger** | Hosting staging dan production | Shared hosting. Staging `staging.dombicenter.com`, production `app.dombicenter.com` |
| **GitHub Actions** | CI/CD dan quality gate | Push ke `develop` deploy staging; push ke `main` deploy production setelah quality gate lulus |
| **Sentry** | Error tracking | Sudah dikonfigurasi |
| **Spatie Backup** | Backup database | Backup lokal harian di Hostinger; offsite S3 dinyatakan waived untuk rilis ini |
| **Gojek/Grab** | Kurir eksternal | Pencatatan manual oleh outlet, bukan integrasi API. Biaya aktual dicatat terpisah dari ongkir pelanggan |

# 11. Fitur Usulan / Fase Lanjutan

- **Auto-assignment Kurir.** Sistem menugaskan kurir secara otomatis berdasarkan ketersediaan dan jarak, menghilangkan proses manual outlet. Memanfaatkan data penugasan dan performa kurir yang sudah tercatat.
- **GPS Live Tracking.** Customer melihat posisi kurir secara real-time pada peta. Melengkapi halaman tracking pesanan yang sudah berjalan.
- **Integrasi API Gojek/Grab.** Pengiriman langsung via GoSend/GrabExpress tanpa input manual outlet, sehingga biaya aktual tercatat otomatis dan konsisten.
- **Multi-outlet Stock Transfer.** Transfer stok langsung antar outlet tanpa melalui pusat, mempercepat restock untuk outlet dengan stok rendah. Mengembangkan modul distribusi pusat-ke-outlet yang sudah ada.
- **COD dan Rekonsiliasi Uang Tunai Kurir.** Pembayaran tunai saat pengantaran beserta rekonsiliasi setoran kurir. Memerlukan perluasan model settlement dan pengantaran.
- **PDF Invoice Generation.** Invoice PDF otomatis per pesanan untuk kebutuhan pembukuan dan klaim.
- **Customer Native App (iOS/Android).** Aplikasi native dengan fitur kamera, GPS, dan autentikasi biometrik. Meningkatkan pengalaman dibanding PWA dan memanfaatkan backend yang sudah ada.
- **Automated Restocking.** Pengajuan restock otomatis berdasarkan ambang stok minimum dan kecepatan penjualan.
- **Advanced Analytics.** Analitik lanjutan: cohort analysis, customer lifetime value, dan prediksi permintaan. Mengembangkan dashboard analitik owner yang sudah ada.
- **Multi-language Support.** Antarmuka Bahasa Indonesia dan Inggris.
- **Migrasi FCM ke HTTP v1.** Meningkatkan jalur push android agar setara dengan jalur web VAPID, mendukung multi-platform secara penuh.

# 12. Pertanyaan Terbuka / TBD

- Kapan kredensial DOKU live akan disiapkan dan diverifikasi di DOKU Back Office untuk production?
- Apakah document root subdomain `app` pada Hostinger sudah dikonfirmasi sebagai `/domains/dombicenter.com/public_html/app/` via SSH?
- Apakah skenario smoke test staging 2–5 (abandon & resume, retry terminal, webhook sync, overlay close) sudah dijalankan dan lulus pada build bersih?
- Apakah cutover production akan dilakukan dengan maintenance window atau tanpa downtime?
- Apakah backup offsite akan diaktifkan kembali setelah traffic pilot naik?
- Kapan filter tanggal pada riwayat pesanan outlet akan diimplementasikan?
- Kapan margin pengantaran akan ditampilkan pada panel penugasan kurir?
- Apakah ekspor laporan perlu diperluas ke format selain CSV (misalnya Excel atau PDF)?
- Apakah return/exchange dan penjualan offline akan tetap aktif pada rilis production atau diaktifkan bertahap setelah pilot?
- Apakah ada target metrik pilot yang disepakati sebagai kriteria sukses (checkout completion rate, payment success rate, order tanpa koreksi manual)?

# 13. Glosarium

- **Dombi :** Nama brand bisnis susu kambing sekaligus nama platform.
- **ProductCategory :** Kelompok produk, contoh "Susu Kambing Segar". Sebelumnya disebut ProductFamily.
- **Product :** Item/variant spesifik dalam sebuah kategori, contoh "Susu Kambing Cokelat 250ml". Sebelumnya disebut ProductVariant.
- **ProductFlavorGroup :** Pengelompokan produk berdasarkan rasa dalam satu kategori.
- **Outlet :** Titik penjualan fisik yang melayani pickup dan delivery.
- **Center Stock :** Stok di gudang pusat yang didistribusikan ke outlet.
- **Reserved Stock :** Jumlah stok yang telah direservasi untuk pesanan yang belum selesai.
- **Stock Opname :** Proses rekonsiliasi stok fisik dengan stok sistem.
- **Restock Request :** Permintaan outlet kepada pusat untuk menambah stok.
- **Delivery Tier :** Zona ongkir berdasarkan rentang jarak dari outlet.
- **Kurir Dombi :** Kurir internal yang terdaftar di sistem, berasal dari pusat atau outlet.
- **Kurir Eksternal :** Kurir pihak ketiga (Gojek/Grab) yang dicatat manual oleh outlet.
- **Guest Token / Recovery Token :** Token unik yang diberikan kepada guest untuk melacak dan memulihkan pesanan.
- **Payment Attempt :** Satu upaya pembayaran DOKU untuk sebuah pesanan, mencakup invoice, status gateway, status settlement, dan status verifikasi. Merupakan sumber pembayaran runtime canonical.
- **Refund Obligation :** Kewajiban refund yang tercatat terhadap sebuah payment attempt, mencakup nominal, tujuan refund, dan status pemrosesan. Merupakan sumber refund runtime canonical.
- **Net Settlement :** Model settlement yang menggabungkan outlet share dari pesanan online (dikurangi biaya kurir dan refund) dengan setoran penjualan offline. Nominal positif berarti owner membayar outlet; nominal negatif berarti outlet menyetor ke owner.
- **Offline Sale :** Penjualan langsung di outlet yang uangnya diterima outlet dan disetor ke owner melalui net settlement.
- **Online Outlet Share :** Bagian outlet dari penjualan online, yaitu selisih antara harga jual dan harga pusat, dibayarkan owner melalui settlement.
- **OutletPayable :** Catatan kewajiban atau piutang antara owner dan outlet beserta sisa pembayarannya.
- **Settlement :** Ringkasan keuangan per outlet per periode yang berisi komponen penjualan, biaya, refund, dan status pembayaran.
- **Late Payment :** Kondisi ketika pembayaran berhasil masuk setelah pesanan sudah kedaluwarsa, sehingga menimbulkan kewajiban refund.
- **State Machine Pesanan :** Himpunan transisi status pesanan yang sah, dari pembuatan hingga selesai, dibatalkan, ditolak, atau gagal.
- **VAPID :** Voluntary Application Server Identification, protokol untuk push notification web.
- **FCM :** Firebase Cloud Messaging, layanan push notification Google untuk Android/Chrome.
- **PWA :** Progressive Web App, teknologi web yang dapat diinstal menyerupai aplikasi native.
- **Capacitor :** Framework pembungkus yang mengubah aplikasi web menjadi APK Android.
- **WIB :** Waktu Indonesia Barat (Asia/Jakarta, UTC+7). Seluruh operasi outlet mengikuti zona waktu ini.
- **Quality Gate :** Rangkaian pemeriksaan otomatis (test, lint, format, type check, build) yang wajib lulus sebelum deploy.
- **Soft Launch :** Peluncuran terbatas dengan satu outlet, jumlah SKU terbatas, dan radius pengantaran terbatas untuk membuktikan journey utama.

---

*Dokumen ini merupakan draft sementara dan dapat berubah seiring pembahasan lebih lanjut dengan klien.*
