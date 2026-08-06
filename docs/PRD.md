# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## Dombi — Operational Commerce Platform

**STATUS: DRAFT — TBD TERJAWAB**

| | |
| --- | --- |
| **Nama Produk** | Dombi — Platform Operasional Bisnis Susu Kambing |
| **Versi Dokumen** | v0.2 |
| **Disusun oleh** | Arya Ajisadda (Pengembang) |
| **Untuk** | Arya Ajisadda (Klien / Owner) |
| **Tanggal** | 2026-08-06 |
| **Dokumen Terkait** | Product Scope (2026-07-27), Progress Roadmap (2026-07-22), DOKU Payment Docs (2026-08-05) |

---

# 1. Ringkasan Produk (Overview)

Bisnis susu kambing Dombi saat ini dikelola secara manual — order masuk via WhatsApp/telepon, stok dicatat di kertas atau spreadsheet, pengantaran diatur langsung ke kurir, dan laporan keuangan disusun per akhir periode tanpa data real-time. Proses ini rentan kesalahan stok, keterlambatan pengantaran, dan tidak ada transparansi status order ke pelanggan.

Dombi adalah operational commerce platform berbasis web (PWA) yang menangani siklus penuh: katalog produk → checkout → pembayaran online → persiapan order → pengantaran → settlement keuangan. Sistem menyediakan 4 panel peran (Customer, Outlet, Owner, Courier) dengan mobile-first design. Tujuan besar: memusatkan operasi bisnis, menghilangkan koreksi manual, dan memberikan transparansi real-time ke semua pihak.

# 2. Tujuan & Sasaran (Goals)

- Memusatkan seluruh operasi order, stok, dan pengantaran dalam satu platform terintegrasi
- Menghilangkan koreksi transaksi manual yang disebabkan oleh kesalahan stok dan pembayaran
- Menyediakan data real-time untuk pengambilan keputusan bisnis (omset, margin, stok)
- Memberikan transparansi status order kepada pelanggan tanpa perlu menghubungi admin
- Mengotomatisasi perhitungan settlement dan pencatatan biaya kurir
- Mempercepat siklus order dari pemesanan hingga pengantaran dengan assignment dan tracking terstruktur

# 3. Pengguna & Peran (Users & Roles)

- **Customer :** Pembeli produk. Bisa guest atau terdaftar. Melihat katalog, checkout (pickup/delivery), membayar online, melacak status order, membatalkan, mengajukan refund/return/exchange, menambahkan produk ke favorit.
- **Owner :** Pemilik bisnis. Mengelola katalog, harga, zona ongkir, stok pusat dan outlet, memantau order/delivery, memverifikasi pembayaran settlement, mengelola kurir (Dombi pusat/outlet + eksternal), melihat dashboard analitik dan keuangan.
- **Outlet :** Staff toko. Memproses order masuk (confirm/prepare/ready), mengelola stok outlet, mengajukan restock ke pusat, memilih kurir untuk delivery, mencatat penjualan offline, melihat settlement dan laporan penjualan.
- **Courier :** Kurir pengantar. Melihat assignment, memperbarui status delivery (picked/delivering/failed), melihat riwayat pengantaran.

# 4. Ruang Lingkup (Scope)

## 4.1 Termasuk (MVP)

- Katalog produk (ProductCategory → Product) dengan multi-flavor bulk creation, gambar, SKU auto-generate
- Cart management dan checkout (pickup + delivery dengan validasi zona/radius)
- Pembayaran online via DOKU (QRIS, Transfer Bank, E-Wallet, Kartu Kredit) dengan webhook idempotent
- Order lifecycle 12 status (pending → confirmed → preparing → ready → delivering → completed + cancel/refund/failed states)
- Guest checkout dengan guest_token, order tracking via token, cancel dengan rate limiting
- Manajemen stok (pusat + outlet) dengan reservasi, deduction, release, restock request, stock opname
- Delivery management (Kurir Dombi pusat/outlet + Kurir Eksternal Gojek/Grab) dengan cost tracking
- Settlement keuangan dengan junction table, manual allocation UI, payment reminders
- Return dan exchange request dengan stock adjustment dan settlement adjustment
- Push notification (VAPID + FCM) untuk semua role
- Operating hours (WIB) dengan holiday schedule dan auto-select outlet buka
- Refund manual oleh owner dengan tracking ke order, payment, dan operator
- Dashboard analitik Owner (KPI cards, charts)
- PWA (Progressive Web App) untuk installasi di Android

## 4.2 Di Luar Lingkup Awal / Fase Lanjutan

Lihat Bab 11 untuk penjelasan masing-masing fitur.

- Auto-assignment kurir dan GPS live tracking
- Integrasi API Gojek/Grab (saat ini manual)
- COD dan rekonsiliasi uang tunai kurir
- Multi-outlet stock transfer
- Multi-language support
- Customer native mobile app (iOS/Android)
- Automated restocking
- PDF invoice generation
- Advanced analytics dan export lengkap

# 5. Asumsi & Batasan (Assumptions & Constraints)

- **Database:** MySQL 8.0+ di production (Hostinger), charset utf8mb4, timezone WIB
- **Backend:** Laravel 13 + PHP 8.3, queue via database driver
- **Frontend:** React 19 + TypeScript + Inertia.js v3 + Tailwind CSS v4
- **Hosting:** Hostinger shared hosting (staging.dombicenter.com), CI/CD via GitHub Actions (push ke `develop` trigger auto-deploy)
- **Mobile:** Capacitor wrapper untuk Android APK, PWA untuk installasi di perangkat customer
- **Pembayaran:** DOKU sandbox saat ini, production switch via `DOKU_IS_SANDBOX=false`
- **Waktu:** Semua operasi outlet mengikuti WIB (Asia/Jakarta), termasuk operating hours dan scheduler
- **Pendekatan:** Mobile-first design, 4 role dengan visual skin berbeda (Customer: emerald, Courier: blue)
- **Kurir eksternal:** Dicatat manual oleh outlet (bukan integrasi API), biaya aktual terpisah dari ongkir customer
- **Soft launch:** 1 outlet, 5–20 SKU, satu daftar harga, radius terbatas, satu metode DOKU paling stabil
- **Asumsi pengembang:** Redis opsional (database queue cukup untuk volume pilot), Sentry sudah dikonfigurasi untuk error tracking

# 6. Kebutuhan Fungsional (Functional Requirements)

## 6.1 Customer — Katalog & Checkout

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **CUST-1** | Customer dapat melihat katalog produk dengan filter kategori, pencarian nama/SKU, dan gambar produk | **Wajib** |
| **CUST-2** | Customer dapat menambahkan produk ke keranjang dan mengubah jumlah item | **Wajib** |
| **CUST-3** | Customer dapat memilih metode pengantaran (pickup atau delivery) saat checkout | **Wajib** |
| **CUST-4** | Untuk delivery, sistem memvalidasi zona/radius outlet dan menghitung ongkir tetap | **Wajib** |
| **CUST-5** | Sistem memvalidasi ketersediaan stok outlet dan mereservasi stok saat checkout | **Wajib** |
| **CUST-6** | Customer (guest) dapat checkout dengan nama dan nomor telepon tanpa registrasi | **Wajib** |
| **CUST-7** | Customer dapat menambahkan penerima (recipient) untuk pengantaran ke alamat berbeda | **Penting** |
| **CUST-8** | Customer dapat menambahkan produk ke daftar favorit | **Penting** |

## 6.2 Customer — Pembayaran

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **PAY-1** | Customer dapat memilih metode pembayaran (QRIS, Transfer Bank, E-Wallet, Kartu Kredit) dan diarahkan ke halaman DOKU | **Wajib** |
| **PAY-2** | Sistem memproses webhook pembayaran dari DOKU secara idempotent (satu pembayaran hanya mengubah status order ke paid satu kali) | **Wajib** |
| **PAY-3** | Customer dapat melakukan retry pembayaran jika pembayaran pertama gagal | **Wajib** |
| **PAY-4** | Sistem menghitung payment fee berdasarkan metode dan threshold subtotal | **Penting** |
| **PAY-5** | Sistem membatalkan order otomatis jika pembayaran tidak selesai dalam batas waktu (30 menit) | **Wajib** |
| **PAY-6** | Guest dapat melacak status order menggunakan token unik | **Wajib** |

## 6.3 Customer — Refund, Return & Exchange

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **REF-1** | Customer dapat mengajukan refund untuk order yang sudah dibayar | **Wajib** |
| **REF-2** | Customer dapat melihat status refund dengan timeline dan destination summary | **Penting** |
| **REF-3** | Customer dapat mengajukan return request dengan alasan | **Penting** |
| **REF-4** | Customer dapat mengajukan exchange request (ganti produk) | **Penting** |
| **REF-5** | Sistem menampilkan badge status refund pada order aktif di halaman Pesanan Aktif | **Penting** |

## 6.4 Outlet — Manajemen Order

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **OUT-1** | Outlet dapat melihat daftar order masuk dan mengonfirmasi (confirmed) | **Wajib** |
| **OUT-2** | Outlet dapat mengubah status order: confirmed → preparing → ready → completed | **Wajib** |
| **OUT-3** | Outlet dapat memilih kurir untuk order delivery (Dombi atau Eksternal) | **Wajib** |
| **OUT-4** | Outlet dapat menolak order dengan alasan | **Wajib** |
| **OUT-5** | Outlet dapat melihat riwayat order dengan filter status dan tanggal | **Penting** |
| **OUT-6** | Sistem menampilkan notifikasi real-time saat order baru masuk | **Penting** |

## 6.5 Outlet — Inventaris & Restock

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **INV-1** | Outlet dapat melihat stok produk di outlet masing-masing | **Wajib** |
| **INV-2** | Outlet dapat mengajukan restock request ke pusat | **Wajib** |
| **INV-3** | Outlet dapat mencatat penerimaan stok (received_notes, damage_notes) | **Penting** |
| **OUT-7** | Outlet dapat mencatat penjualan offline | **Penting** |
| **OUT-8** | Outlet dapat melihat settlement dan laporan penjualan | **Penting** |
| **OUT-9** | Outlet dapat mengelola operating hours dan jadwal libur | **Penting** |

## 6.6 Owner — Katalog & Harga

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **OWN-1** | Owner dapat mengelola kategori produk dan produk (CRUD, bulk creation multi-flavor) | **Wajib** |
| **OWN-2** | Owner dapat mengatur harga jual global dan override harga per outlet | **Wajib** |
| **OWN-3** | Owner dapat mengaktifkan/nonaktifkan produk dan kategori | **Wajib** |
| **OWN-4** | Owner dapat mengelola zona ongkir dan delivery tier (tarif ongkir per radius) | **Wajib** |

## 6.7 Owner — Stok & Distribusi

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **STK-1** | Owner dapat mengelola stok pusat (center_stock) | **Wajib** |
| **STK-2** | Owner dapat mendistribusikan stok dari pusat ke outlet | **Wajib** |
| **STK-3** | Owner dapat menyetujui atau menolak restock request dari outlet | **Wajib** |
| **STK-4** | Owner dapat menjalankan stock opname (reconcile stok fisik vs sistem) | **Penting** |
| **STK-5** | Sistem mengirim notifikasi low-stock alert ke owner | **Penting** |

## 6.8 Owner — Finance & Settlement

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **FIN-1** | Owner dapat melihat dashboard keuangan (omset, margin, biaya kurir) | **Wajib** |
| **FIN-2** | Sistem menghasilkan net settlement per outlet per periode (mingguan/bulanan) yang menggabungkan outlet share dari online orders, biaya kurir, refund, dan setoran penjualan offline | **Wajib** |
| **FIN-3** | Owner dapat memverifikasi pembayaran settlement dari outlet (manual allocation) | **Wajib** |
| **FIN-4** | Sistem mengirim reminder pembayaran settlement ke outlet | **Penting** |
| **FIN-5** | Owner dapat melakukan refund manual dengan tracking ke order dan payment | **Wajib** |
| **FIN-6** | Owner dapat mengelola payment accounts (rekening bank) | **Penting** |

## 6.9 Owner — Kurir & Delivery

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **DEL-1** | Owner dapat mengelola kurir Dombi (pusat dan outlet) dengan approval workflow | **Wajib** |
| **DEL-2** | Owner dapat mengelola kurir eksternal (Gojek/Grab) dengan pencatatan biaya aktual | **Wajib** |
| **DEL-3** | Owner dapat melihat margin pengantaran secara real-time saat assign kurir | **Penting** |
| **DEL-4** | Owner dapat melihat delivery history dan SLA monitoring | **Penting** |

## 6.10 Owner — Analitik & Pelaporan

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **ANA-1** | Owner dapat melihat dashboard analitik (KPI cards, charts penjualan) | **Penting** |
| **ANA-2** | Owner dapat mengekspor laporan penjualan ke CSV | **Penting** |
| **ANA-3** | Owner dapat melihat laporan per periode dengan filter tanggal | **Penting** |

## 6.11 Courier — Delivery

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **CR-1** | Courier dapat melihat daftar delivery assignment | **Wajib** |
| **CR-2** | Courier dapat memperbarui status delivery: picked → delivering → delivered/failed | **Wajib** |
| **CR-3** | Courier dapat melihat detail order dan alamat pengantaran | **Wajib** |
| **CR-4** | Courier dapat melihat riwayat pengantaran | **Penting** |
| **CR-5** | Sistem menampilkan notifikasi saat ada assignment baru | **Penting** |

## 6.12 Sistem — Notifikasi & Operasional

| **ID** | **Kebutuhan Fungsional** | **Prioritas** |
| --- | --- | --- |
| **SYS-1** | Sistem mengirim push notification (VAPID + FCM) untuk semua peristiwa penting (order baru, status change, restock, settlement) | **Wajib** |
| **SYS-2** | Sistem mengelola operating hours outlet dengan timezone WIB dan jadwal libur | **Wajib** |
| **SYS-3** | Sistem membatalkan order otomatis yang melewati batas waktu pembayaran | **Wajib** |
| **SYS-4** | Sistem mencatat audit log untuk perubahan status order, settlement, dan inventaris | **Penting** |
| **SYS-5** | Sistem menyediakan dashboard in-app notification dengan bell icon dan notification sheet | **Wajib** |
| **SYS-6** | Sistem membatalkan order oleh guest dengan rate limiting (3/min per IP, 10/10min per token) | **Wajib** |

# 7. Alur Pengguna Utama (Key User Flows)

## 7.1 Customer — Order Delivery (Happy Path)

1. Customer membuka katalog, memilih produk, menambahkan ke keranjang.
2. Customer memilih "Delivery", memasukkan alamat, sistem validasi zona/radius dan menghitung ongkir.
3. Sistem validasi stok outlet dan mereservasi.
4. Customer mengisi nama dan nomor telepon (guest checkout), submit order.
5. Customer memilih metode pembayaran (QRIS/Transfer/E-Wallet/CC), diarahkan ke halaman DOKU.
6. Customer menyelesaikan pembayaran di DOKU.
7. Webhook DOKU masuk → sistem verifikasi signature → status order berubah ke `paid` (idempotent).
8. Outlet menerima notifikasi order baru → mengonfirmasi (status `confirmed`).
9. Outlet menyiapkan pesanan (status `preparing`), lalu selesai (status `ready`).
10. Outlet memilih kurir (Dombi atau Eksternal Gojek/Grab).
11. Kurir mengambil pesanan (status `picked`), mengantarkan (status `delivering`).
12. Kurir menandai selesai (status `delivered`) → order otomatis `completed`.
13. Sistem mencatat stok terjual, biaya kurir, dan menyiapkan settlement.

## 7.2 Customer — Order Pickup

1. Customer memilih "Pickup" saat checkout, sistem menampilkan outlet terdekat yang buka.
2. Alur sama dengan delivery sampai status `ready`.
3. Customer mengambil pesanan di outlet → outlet menandai `completed`.

## 7.3 Customer — Pembatalan Order

1. Guest mengakses halaman tracking via token.
2. Guest menekan "Batalkan Order", sistem menampilkan confirmation wall.
3. Sistem validasi: order belum paid, belum diproses outlet, belum melewati cutoff.
4. Status berubah ke `cancelled`, stok reservasi dilepas.
5. Rate limiting aktif: 3 kali per IP per menit, 10 kali per token per 10 menit.

## 7.4 Outlet — Proses Order

1. Outlet menerima push notification order baru.
2. Outlet membuka dashboard, melihat order masuk (status `paid`).
3. Outlet mengonfirmasi (status `confirmed`).
4. Outlet menyiapkan pesanan (status `preparing`).
5. Outlet menandai siap (status `ready`).
6. Untuk delivery: outlet membuka sheet assign kurir, memilih kurir Dombi atau input kurir eksternal.
7. Outlet dapat membatalkan order dengan alasan (status `rejected`).

## 7.5 Owner — Verifikasi Settlement

1. Sistem menghasilkan settlement per outlet per periode.
2. Owner melihat daftar settlement di dashboard finance.
3. Owner membuka detail settlement, melihat breakdown order.
4. Outlet melakukan pembayaran dan mengirim bukti.
5. Owner membuka PaymentVerifySheet, mengalokasikan amount ke settlement tertentu.
6. Sistem mencatat allocation dan mengupdate status settlement.

# 8. Model Data (High-Level)

| **Entitas** | **Field Utama** | **Keterangan** |
| --- | --- | --- |
| **ProductCategory** | id, name, brand, description, image, is_active | Kategori produk (dulu ProductFamily) |
| **Product** | id, product_category_id, name, flavor, size, sku, center_price, selling_price, is_active | Produk/variant (dulu ProductVariant) |
| **Outlet** | id, name, address, latitude, longitude, is_active, operating_hours | Outlet penjualan |
| **OutletProductPrice** | id, outlet_id, product_id, selling_price | Override harga per outlet |
| **OutletInventory** | id, outlet_id, product_id, stock, min_stock | Stok per outlet |
| **Customer** | id, name, phone, email, password | Customer terdaftar |
| **CustomerAddress** | id, customer_id, label, address, latitude, longitude | Alamat pengantaran |
| **Recipient** | id, customer_id, name, phone, address | Penerima pesanan |
| **Favorite** | id, customer_id, product_id | Produk favorit |
| **Order** | id, customer_id, outlet_id, order_number, type (pickup/delivery), status, payment_status, payment_method, subtotal, delivery_fee, total, guest_token, paid_at, cancelled_at | Pesanan utama |
| **OrderItem** | id, order_id, product_id, quantity, unit_price, subtotal | Item pesanan |
| **OrderStatusHistory** | id, order_id, from_status, to_status, changed_by, notes | Riwayat status order |
| **PaymentTransaction** | id, order_id, doku_order_id, session_id, token_id, status, raw_response | Log transaksi DOKU |
| **PaymentWebhookLog** | id, order_id, headers, body, signature_valid | Audit log webhook |
| **Delivery** | id, order_id, courier_profile_id, type (dombi/eksternal), status, eksternal_provider, eksternal_cost | Pengantaran |
| **DeliveryTier** | id, name, min_distance, max_distance, fee | Zona ongkir |
| **CourierProfile** | id, user_id, type (pusat/outlet/eksternal), source, status, outlet_id | Profil kurir |
| **Settlement** | id, outlet_id, period_start, period_end, period_type (weekly/monthly), total_orders, total_online_share, total_delivery_cost, total_refund, total_offline_sales, net_amount, status | Net settlement per outlet per periode |
| **SettlementPayment** | id, settlement_id, amount, payment_account_id, proof_image, verified_at | Pembayaran settlement |
| **SettlementPaymentAllocation** | id, settlement_payment_id, settlement_id, amount | Alokasi pembayaran ke settlement |
| **StockMovement** | id, product_id, outlet_id, type, quantity, reference_type, reference_id | Pergerakan stok |
| **RestockRequest** | id, outlet_id, status, notes | Permintaan restock |
| **RestockRequestItem** | id, restock_request_id, product_id, quantity_requested, quantity_approved | Item restock |
| **ReturnRequest** | id, order_id, reason, status, [photo_evidence] | Pengembalian barang |
| **ExchangeRequest** | id, order_id, return_request_id, status | Tukar barang |
| **RefundStatusHistory** | id, order_id, from_status, to_status, changed_by | Riwayat status refund |
| **Notification** | id, user_id, type, title, body, data, read_at | Notifikasi in-app |
| **OutletOperatingHours** | id, outlet_id, day_of_week, open_time, close_time, is_closed | Jam operasional |
| **OutletHoliday** | id, outlet_id, date, name, is_closed | Jadwal libur |
| **OfflineSale** | id, outlet_id, product_id, quantity, unit_price | Penjualan offline |
| **PaymentAccount** | id, owner_id, bank_name, account_number, account_name | Rekening pembayaran |
| **PushFcmToken** | id, user_id, token, platform | FCM token push notification |

**Catatan:** field dalam [tanda kurung siku] merupakan bagian dari fitur usulan/Fase Lanjutan (Bab 11).

# 9. Kebutuhan Non-Fungsional (Non-Functional Requirements)

- **Responsivitas :** Seluruh antarmuka harus berfungsi sempurna pada mobile (360px+), tablet, dan desktop. Mobile-first design dengan breakpoint Tailwind standar.
- **Keamanan :** Rate limiting pada endpoint sensitif (guest cancel: 3/min IP, 10/10min token). Hash verification untuk guest token (hash_equals). Webhook signature verification DOKU. CSRF protection pada semua mutation. Role-based access control pada setiap route.
- **Ketahanan Koneksi :** Push notification via VAPID + FCM agar user tetap mendapat informasi meskipun tidak membuka web. PWA service worker untuk caching aset statis.
- **Skalabilitas :** Queue-based processing untuk push notification dan scheduler jobs. Lock-based concurrency (lockForUpdate) pada stock check dan payment webhook untuk mencegah race condition.
- **Privasi Data :** Guest data (nama, telepon) hanya disimpan selama order aktif. Data pembayaran diproses oleh DOKU, tidak disimpan lokal.
- **Performa :** Target response time < 500ms untuk halaman utama. Optimasi query dengan eager loading, N+1 prevention. Minimal 600px min-width pada tabel desktop.
- **Ketahanan Pembayaran :** Webhook DOKU diproses secara idempotent. Max age check pada timestamp webhook (300 detik). Payment status terminal guard (paid/failed/expired tidak bisa berubah).

# 10. Integrasi Pihak Ketiga

| **Layanan** | **Fungsi** | **Catatan** |
| --- | --- | --- |
| **DOKU** | Payment gateway (QRIS, VA, E-Wallet, CC) | Sandbox aktif, production via `DOKU_IS_SANDBOX=false`. Webhook + redirect flow. |
| **Firebase Cloud Messaging (FCM)** | Push notification ke Android/Chrome | VAPID key untuk web, FCM untuk Android APK via Capacitor |
| **Capacitor** | Wrapper Android APK | Build APK dari PWA, native push notification |
| **Hostinger** | Hosting production | Shared hosting, SSH deploy via GitHub Actions |
| **GitHub Actions** | CI/CD pipeline | Push ke `develop` trigger quality gate + deploy |
| **Sentry** | Error tracking | Dikonfigurasi, belum diaktifkan di production |
| **Spatie Backup** | Database backup | Dikonfigurasi, belum diaktifkan di production |
| **Gojek/Grab** | Kurir eksternal | Pencatatan manual (bukan API integration) |

# 11. Fitur Usulan / Fase Lanjutan

- **Auto-assignment Kurir.** Sistem otomatis menugaskan kurir berdasarkan ketersediaan dan jarak. Menghilangkan proses manual outlet memilih kurir.
- **GPS Live Tracking.** Customer dapat melihat posisi kurir secara real-time di peta. Meningkatkan transparansi pengantaran.
- **Integrasi API Gojek/Grab.** Pengiriman langsung via API GoSend/GrabExpress tanpa input manual oleh outlet. Mengurangi kesalahan pencatatan biaya.
- **Multi-outlet Stock Transfer.** Transfer stok antar outlet tanpa melalui pusat. Mempercepat restock untuk outlet dengan stok rendah.
- **COD (Cash on Delivery).** Pembayaran tunai saat pengantaran. Memerlukan rekonsiliasi uang tunai kurir.
- **PDF Invoice Generation.** Generate invoice PDF otomatis untuk setiap order. Berguna untuk pembukuan dan klaim.
- **Customer Native App (iOS/Android).** Aplikasi native dengan fitur lengkap (camera, GPS, biometric auth). Pengalaman lebih baik dari PWA.
- **Automated Restocking.** Sistem otomatis mengajukan restock berdasarkan min_stock threshold dan velocity penjualan.
- **Multi-language Support.** Interface Bahasa Indonesia dan Inggris.
- **Advanced Analytics.** Dashboard analitik lanjutan: cohort analysis, customer lifetime value, prediksi demand.
- **Return Photo Evidence.** Upload foto bukti kerusakan saat mengajukan return. Mempercepat verifikasi owner.
- **Offline Sales Integration.** Penjualan offline terintegrasi dengan settlement dan stok otomatis (saat ini terpisah).

# 12. Pertanyaan Terbuka / TBD

> **Status: Semua pertanyaan telah dijawab (2026-08-06)**

- ~~Berapa jumlah outlet yang akan diaktifkan setelah soft launch pertama?~~ → **3 outlet**
- ~~Apakah ada rencana menambah metode pembayaran selain DOKU?~~ → **Tidak.** Hanya DOKU.
- ~~Apakah operating hours berlaku sama untuk semua outlet atau bisa berbeda per hari?~~ → **Beda per hari per outlet.** Setiap outlet bisa atur jam buka/tutup berbeda per hari dalam seminggu.
- ~~Berapa lama periode settlement yang diinginkan?~~ → **Mingguan dan Bulanan.** Owner bisa generate settlement per minggu atau per bulan.
- ~~Apakah ada rencana integrasi dengan sistem akuntansi?~~ → **Tidak.** Tidak ada rencana integrasi Jurnal/Accurate.
- ~~Bagaimana kebijakan refund yang sudah settled ke outlet?~~ → **Potong dari settlement outlet berikutnya.** Model net settlement: refund mengurangi outlet share di periode berikutnya.
- ~~Apakah ada rencana menambah role selain 4?~~ → **Tidak.** Hanya 4 role: Customer, Outlet, Owner, Courier.
- ~~Kapan production DOKU credentials akan disiapkan?~~ → **Setelah semua fitur terkonfirmasi oleh Client saat meet berikutnya.**
- ~~Apakah ada budget untuk dedicated server?~~ → **Sementara Hostinger Shared.** Re-evaluasi setelah traffic naik.
- ~~Apakah push notification perlu support iOS PWA?~~ → **Sudah aman.** Sudah diuji dan berfungsi di iOS PWA (Safari web push).

# 13. Glosarium

- **Net Settlement :** Model settlement yang menggabungkan outlet share dari online orders (dikurangi biaya kurir, refund) dengan setoran penjualan offline. Angka positif = Owner bayar outlet, angka negatif = outlet setor ke Owner. Perhitungan: `(online_outlet_share - delivery_costs - refunds) - offline_sales`.
- **Offline Sale :** Penjualan langsung di outlet (cash). Uang diterima outlet, harus disetor ke Owner melalui net settlement.
- **Online Outlet Share :** Bagian outlet dari penjualan online (harga jual - harga pusat), dibayarkan oleh Owner melalui settlement.
- **Dombi :** Nama brand bisnis susu kambing, sekaligus nama platform.
- **ProductCategory :** Kelompok produk (dulu disebut ProductFamily). Contoh: "Susu Kambing Segar".
- **Product :** Item/variant spesifik dalam kategori (dulu disebut ProductVariant). Contoh: "Susu Kambing Cokelat 250ml".
- **Outlet :** Titik penjualan fisik. Bisa melayani pickup dan delivery.
- **Center Stock :** Stok di gudang pusat yang didistribusikan ke outlet-outlet.
- **Settlement :** Ringkasan keuangan per outlet per periode. Berisi total order, amount, dan status pembayaran.
- **Delivery Tier :** Zona ongkir berdasarkan jarak/radius dari outlet.
- **Kurir Dombi :** Kurir internal yang terdaftar di sistem (pusat atau outlet).
- **Kurir Eksternal :** Kurir pihak ketiga (Gojek/Grab) yang dicatat manual oleh outlet.
- **Guest Token :** Token unik (32 karakter) yang diberikan ke guest saat checkout untuk tracking dan cancel order.
- **Stock Opname :** Proses rekonsiliasi stok fisik di outlet/gudang dengan stok di sistem.
- **VAPID :** Voluntary Application Server Identification, protokol untuk push notification web.
- **FCM :** Firebase Cloud Messaging, layanan push notification dari Google untuk Android/Chrome.
- **PWA :** Progressive Web App, teknologi web yang bisa diinstall seperti aplikasi native.
- **WIB :** Waktu Indonesia Barat (Asia/Jakarta, UTC+7). Semua operasi outlet mengikuti timezone ini.

---

*Dokumen ini merupakan draft. Semua TBD telah dijawab per 2026-08-06. Menunggu konfirmasi final dari client.*
