# Dombi — Rencana Database & Performance Hardening

Rencana lanjutan setelah batch index/FK/presisi. Disusun dari audit schema
(152 migrasi, 63 tabel) dan audit performa aplikasi.

Setiap fase adalah satu PR yang bisa di-rollback sendiri. Urutan disusun dari
risiko terendah ke tertinggi; jangan lompat fase sebelum fase sebelumnya hijau
di staging.

## Prinsip Kerja

1. **Schema dulu, kode menyusul.** Migrasi harus kompatibel dengan kode versi
   lama yang masih berjalan, supaya deploy tidak butuh downtime. Kolom baru
   selalu nullable atau punya default.
2. **Karakterisasi dulu, refactor kemudian.** Untuk setiap perubahan yang
   menyentuh hasil query, rekam output endpoint sebelum perubahan, lalu
   bandingkan sesudahnya. Test yang ada belum tentu menangkap perbedaan angka.
3. **Ukur, jangan klaim.** Setiap fase menyertakan angka sebelum/sesudah
   (jumlah query, durasi endpoint, `EXPLAIN`). Tanpa angka, fase belum selesai.
4. **Rehearsal di data berskala production.** Belum ada dataset lokal yang
   representatif: `dombi_parity` hanya 30 order dan `dombi_test` kosong. Migrasi
   rebuild tabel pada data kecil selesai dalam ~0,6 detik, sedangkan pada data
   production bisa menit dan mengunci tabel. Sediakan snapshot production
   (minimal `orders` ≥ 100 ribu baris, `stock_movements` ≥ 1 juta baris) sebagai
   bahan rehearsal sebelum Fase 0 dijalankan.
5. **Expand → backfill → verify → contract** untuk setiap perubahan struktural.
   Tidak ada big bang rename/drop kolom dalam satu rilis.

## Fase 0 — Rilis batch index, FK, dan presisi uang

**Status:** kode siap, belum di-deploy. Risiko: rendah, kecuali durasi rebuild.

Yang sudah dikerjakan:

- 8 index duplikat dibuang, `stock_movements_product_id_created_at_index` yang
  rusak diperbaiki, 10 index baru ditambah
- FK `settlement_payments.settlement_id` ditambahkan (`SET NULL`)
- 50 kolom mata uang diseragamkan ke `decimal(14,2)` signed
- Test regresi `DatabaseSchemaHardeningTest` (5 test) mengunci seluruh invarian

Langkah rilis:

1. Backup penuh `dombi` production dan catat release SHA yang jadi rollback point.
2. Rehearsal di snapshot production. Ukur durasi dan locking tiap migrasi.
   Migrasi ke-4 menyentuh 15 tabel dan melakukan rebuild tabel — untuk `orders`
   yang besar, ini butuh maintenance window.
3. Jalankan `php artisan migrate --force` saat trafik rendah. Sebelum mulai,
   hentikan scheduler dan queue worker. `routes/console.php` menjalankan banyak
   task `everyMinute()` yang menyentuh tabel yang sedang di-rebuild — terutama
   `orders:expire-pending` (`orders`), `payments:reconcile-doku` dan
   `payments:expire-unknown` (`payment_attempts`). Task ini akan menunggu table
   lock dan menahan rebuild, jadi scheduler wajib berhenti selama rebuild.
4. Verifikasi sesudah migrasi: `EXPLAIN` pada endpoint laporan memakai
   `orders_status_completed_at_index`, `settlement_payments.settlement_id`
   punya FK, dan seluruh kolom mata uang `decimal(14,2)`.
5. Bandingkan durasi endpoint laporan revenue, finance, dan stock movement
   sebelum/sesudah. Catat hasilnya di `docs/PRODUCTION_CHECKLIST.md`.

Gate: jika rehearsal menunjukkan rebuild `orders` lebih lama dari jendela
maintenance yang tersedia, pecah migrasi ke-4 menjadi dua batch (tabel kecil
dulu, `orders`/`order_items`/`products` di batch terpisah).

## Fase 1 — Perbaikan read-path tanpa perubahan schema

**Status: SELESAI.** Risiko: rendah. Tidak menyentuh database, murni
menghilangkan query berulang. Tercatat di `CustomerReadPathQueryCountTest`.

1. ✅ `Product::priceForOutlet()` — `app/Models/Product.php:124`. Kini memakai
   relasi `outletPrices` bila sudah dimuat, query hanya sebagai fallback.
   Cross-sell di `ProductController::show` juga di-eager load (sebelumnya tidak,
   sehingga 4 kategori × N produk query satu per satu).
2. ✅ `Outlet::isOpen()` dan `nextOpenTime()` — `app/Models/Outlet.php`.
   Memakai helper publik `operatingHoursForDay()` yang sadar-relasi.
   Eager load `operatingHours` + `holidays` ditambah di
   `CustomerOutletController::index`, `OutletAssignmentService::findCandidateOutlets`,
   `OutletAssignmentService::findOpenOutletWithStock`. `RecommendOutletService::getNextOpenTime()`
   ikut memakai helper yang sama.
   **Terukur:** 8 outlet = 17 query pada jalur lama, endpoint sekarang 4 query total.
   Catatan: `findCandidateOutlets` **tidak** diganti dengan `isOpen()` karena
   semantiknya berbeda — ia menganggap outlet tanpa baris jam operasional sebagai
   buka, sedangkan `isOpen()` menganggapnya tutup. Perilaku lama dipertahankan.
3. ⚠️ **Klaim audit tidak terbukti, tidak ada perubahan.** Eager load `customer`
   disebut perlu karena `Order::isGuestCustomer()`. Setelah diuji, kedua scope
   daftar order customer (`visibleAsCustomerActive`, `visibleAsCustomerHistory`)
   mengecualikan `payment_status = refund_pending`, dan `queueState()` hanya
   memanggil `isGuestCustomer()` saat status resolve ke `refund_pending`.
   Selain itu daftar `select` di `Customer/OrderController` tidak menyertakan
   `refund_reason`, sehingga `selectedRefundObligation()` pun langsung
   mengembalikan null. Endpoint sudah flat; menambahkan relasi justru memperbesar
   payload Inertia karena relasi ter-load ikut terserialisasi.
   Yang tetap diperbaiki: `Owner/FinanceSettlementController` baris 267 —
   `chunk(200)` atas seluruh populasi refund memang memanggil `queueState()` per
   order tanpa `customer`, dan di sana `refund_pending` lazim.
4. ✅ `DeliveryPricingService::loadTiers()` — di-cache lewat
   `DeliveryTier::PRICING_CACHE_KEY` (TTL 1 hari) dan di-invalidate oleh event
   `saved`/`deleted` model, sehingga seeder dan tinker ikut aman.
5. ✅ `DokuConfigurationGuard` — resolver DNS kini di-inject lewat konstruktor
   (default tetap `dns_get_record`). `DokuProductionConfigTest` deterministik,
   plus dua test baru untuk cabang host tak-resolve dan alamat privat.

DoD terpenuhi: `CustomerReadPathQueryCountTest` mengukur jumlah query pada 2 vs 6
baris dan gagal bila jumlahnya tumbuh (sudah diverifikasi gagal saat perbaikan
dimatikan).

## Fase 2 — Query non-sargable

**Status: SELESAI.** Dua bagian, keduanya tanpa perubahan schema.

### 2a. Ganti `whereDate()` / `whereMonth()` / `whereYear()` dengan rentang setengah terbuka

**Selesai.** 60 lokasi di 19 file dikonversi. Karena polanya berulang, logikanya
dipusatkan sebagai empat query macro di `AppServiceProvider::configureQueryMacros()`:
`whereOnDay`, `whereFromDay`, `whereUntilDay`, `whereInMonth`.

Temuan penting saat mengerjakan:

- **Timezone.** `app.timezone` = UTC, sementara `config/database.php` tidak
  mengeset `time_zone` koneksi sehingga session MySQL memakai `SYSTEM` = WIB.
  Penggantian tetap **ekuivalen persis** karena literal string juga ditafsirkan
  di session timezone yang sama; perbedaannya hanya dihilangkannya pembungkus
  fungsi. Ini diverifikasi, bukan diasumsikan.
- **Input tanggal tidak valid.** `$request->date('date')` mengembalikan null untuk
  input rusak seperti `?date=abc`, sedangkan `CarbonImmutable::parse(null)`
  berarti "sekarang" — itu akan mengubah perilaku dari "tidak ada hasil" menjadi
  "hasil hari ini". Macro mengembalikan `1 = 0` untuk input null, kosong, atau
  tidak bisa di-parse.
- **`findCandidateOutlets` tidak diseragamkan.** Semantiknya memang berbeda dan
  sudah dicatat di Fase 1.

Bukti (`EXPLAIN` di tabel lokal):

| Query | Bentuk lama | Bentuk baru |
|---|---|---|
| `orders` status + completed_at | `Covering index lookup (status)` + `Filter: cast(completed_at as date)`, cost 2.26 | `Covering index range scan over (status AND rentang)`, cost 0.46 |
| `offline_sales` outlet + created_at | `Index lookup (outlet_id)` + `Filter: cast(created_at as date)`, cost 1.1 | `Index range scan over (outlet_id AND rentang)`, cost 2.21 |

Jujur soal batasnya: pada tabel kecil lokal, optimizer kadang tetap memilih index
`status`/`courier_id` saja (mis. `deliveries`, `settlement_payments`), jadi
keuntungan penuh hanya terlihat pada data berskala production. Yang pasti, bentuk
baru tidak pernah lebih buruk dan membuka jalan pemakaian index.

`SargableDateFilterTest` (5 test) membandingkan hasil kedua bentuk — bukan hanya
memastikan keduanya sama, tapi juga meng-assert himpunan baris yang diharapkan —
pada baris tepat di batas hari dan bulan.

### 2b. Query stok low/critical

**Status: SELESAI, dengan premis yang dikoreksi.**

Rencana awal menyebut generated column `available_stock` akan membuat query
low-stock bisa memakai index. **Premis itu salah dan sudah diuji:** sebagian besar
query membandingkan dua kolom (`available <= minimum_stock`), dan perbandingan
antar-kolom tidak bisa memakai index walau kolomnya generated — `EXPLAIN`
menunjukkan `Filter` pada perbandingannya, bukan `Index range scan`. Kolom
generated juga akan bertabrakan dengan accessor `getAvailableStockAttribute()`
yang sudah ada.

Yang **ditemukan** saat menguji premis itu justru lebih serius: ekspresi
`current_stock - reserved_stock` melakukan pengurangan pada dua kolom
`INT UNSIGNED`. Bila ada satu baris dengan `reserved_stock > current_stock`,
MySQL melempar `ERROR 1690 BIGINT UNSIGNED value is out of range` — jadi
dashboard outlet dan halaman inventory owner **HTTP 500** tepat saat terjadi
oversell, situasi yang justru terdaftar sebagai rollback trigger di
`PRODUCTION_CHECKLIST.md`.

Perbaikan: tiga scope di `OutletInventory` (`whereLowStock`, `whereCriticalStock`,
`whereInStock`) memakai bentuk aljabar tanpa pengurangan sama sekali —
`current_stock <= reserved_stock + minimum_stock`, `current_stock <= reserved_stock`,
`current_stock > reserved_stock`. Ekuivalen secara eksak, portabel, dan tidak bisa
underflow. `OrderService::getMaxAvailableStock()` memakai `CASE` yang setara
(konstanta 0 untuk baris oversold; pemanggilnya sudah memperlakukan nilai `<= 0`
secara identik).

`OutletInventoryStockScopeTest` mengunci ini, dan sudah diverifikasi gagal dengan
`SQLSTATE[22003]` pada bentuk pengurangan lama — termasuk lewat HTTP endpoint.

DoD: bentuk baru tidak memakai fungsi atas kolom, dan hasil query identik dengan
versi lama pada dataset yang sama (diverifikasi oleh test).

## Fase 3 — Constraint status di level database

**Status: SELESAI untuk 16 kolom di 9 tabel.** Risiko: sedang, dengan pengaman
yang membuatnya aman dijalankan di production.

Dari 52 kolom status/type `varchar`, **16 dikonstraint** dan sisanya sengaja
dikecualikan. Definisi nilainya ada di `App\Support\StatusConstraints` supaya
migrasi dan test merujuk sumber yang sama.

**Akar masalahnya ketemu.** Kolom-kolom ini asalnya `ENUM`, lalu di-relax jadi
`varchar` oleh dua migrasi: `2026_06_04_000001_relax_orders_status_to_string.php`
dan `2026_07_22_000003_fix_deliveries_status_column.php`. Definisi enum terakhir
sebelum relax itulah yang jadi sumber value set kanonik — mis. `deliveries.status`
punya 10 nilai dari `2026_06_05_014030_production_hardening_fixes.php`.

Yang dikonstraint: `orders.status`, `orders.fulfillment_type`,
`orders.refund_destination_status`, `deliveries.status`, `deliveries.courier_type`,
`deliveries.resolution_status`, `deliveries.return_status`, `outlets.status`,
`settlements.status`, `settlements.period_type`, `settlements.direction`,
`settlement_payments.direction`, `return_requests.status`, `exchange_requests.status`,
`order_reports.status`, `order_reports.type`.

**Nilai legacy dipisah dari nilai terkini.** `orders.status` menerima 13 status
yang ditulis kode sekarang plus 3 nilai lama (`pending`, `cancelled`, `failed`)
yang masih bisa ada di baris lama. Strukturnya `['current' => [...], 'legacy' => [...]]`
sehingga alasannya terbaca dari kode, dan drift test hanya membandingkan
`current` terhadap konstanta model — jadi menghapus nilai legacy adalah keputusan
eksplisit, bukan kecelakaan.

**Yang sengaja tidak dikonstraint, beserta alasannya:**

- **Kolom polymorphic** — `stock_movements.reference_type`, `notifications.entity_type`,
  `notifications.user_type`, `order_status_histories.changed_by_type`,
  `delivery_status_histories.changed_by_type`, `refund_status_histories.actor_type`,
  `payment_outbox_events.aggregate_type`, `push_subscriptions.subscribable_type`,
  `outlet_payables.reference_type`. Isinya nama kelas model; constraint-nya rapuh
  karena menambah model baru akan mematahkan write.
- **Status dari sistem eksternal** — `payment_attempts.gateway_status`,
  `payment_observability_events.provider_status`. Isinya apa pun yang dikirim DOKU;
  status baru dari mereka akan menggagalkan ingestion webhook.
- **Kolom mirror riwayat** — `*_status_histories.from_status` / `to_status` serta
  `delivery_resolution_logs.previous_status` / `new_status`. Nilainya mencerminkan
  status induk yang sudah dikonstraint; mengulangnya menggandakan jumlah constraint
  tanpa menambah jaminan baru.
- **Status internal alur pembayaran** — `payment_outbox_events.*`,
  `payment_webhook_logs.*`, `payment_transactions.status`,
  `payment_attempts.reconciliation_status`. Perlu sesi tersendiri karena
  melibatkan state machine pembayaran.
- `push_fcm_tokens.device_type` — nilai bergantung platform klien.

**Pengaman yang membuat ini aman di production.** Migrasi menjalankan pre-flight:
sebelum memasang constraint, ia mencari nilai di luar daftar dan **gagal berisik**
bila menemukannya, mengikuti pola yang sudah dipakai
`2026_08_24_000008_add_fulfilment_integrity_constraints.php`. Sudah diverifikasi:
menyisipkan `wild_status` lalu menjalankan migrasi menghasilkan
`Cannot constrain orders.status; values outside the allowed set require reconciliation first: wild_status`.
Jadi bila production punya nilai tak terduga, migrasi menolak jalan dan menyebut
nilainya — bukan memasang constraint yang nanti menggagalkan write saat runtime.

`StatusConstraintTest` (12 test) mengunci ini:

- **Drift guard** — membandingkan `current` setiap kolom terhadap konstanta model
  lewat reflection (`Order::STATUS_*`, `Settlement::STATUS_*`, `Delivery::RESOLUTION_STATUSES`,
  dst). Menambah satu status di kode tanpa memperbarui constraint akan
  menggagalkan test ini, bukan meledak di production.
- **Penolakan** — nilai tak dikenal ditolak untuk `orders.status`,
  `orders.fulfillment_type`, `outlets.status`, `settlements.status`,
  `return_requests.status`, `deliveries.status`.
- **Penerimaan** — seluruh 13 status `orders` yang sah bisa disimpan.

### Yang ditemukan begitu constraint dipasang

Constraint ini langsung membongkar dua hal yang tidak terlihat sebelumnya:

1. **Bug finansial.** `SettlementGeneratorService` memfilter
   `deliveries.status = 'delivered'` — nilai yang tidak pernah ada, karena status
   pengiriman yang sah adalah `completed`. Akibatnya `total_delivery_cost` selalu
   0 dan **settlement outlet kelebihan** sebesar seluruh biaya kurir. Komentar di
   kode itu sendiri berbunyi "for ALL deliveries (dombi + eksternal)", dan
   `SettlementReconciliationService` serta `CourierRevenueService` menjumlahkan
   `courier_cost` tanpa filter status — jadi filter itu memang keliru. Sesuai
   keputusan owner, filternya dihapus sehingga biaya kurir benar-benar dipotong,
   dan perilakunya dikunci oleh
   `test_delivery_cost_is_charged_even_when_the_delivery_did_not_complete`.
2. **Fixture test yang memakai nilai tidak sah.** Tiga tempat: `NetSettlementTest`
   membuat order dengan `fulfillment_type = 'delivery'` dan delivery dengan
   `status = 'delivered'`, serta `GuestOrderMergerTest` memakai
   `order_reports.type = 'wrong_item'` (nilai sahnya `wrong_items`, plural).
   Semuanya bukan nilai yang sah. Test pertama lolos selama ini justru karena
   fixture-nya dan query produksi memakai literal salah yang **sama**, sehingga
   saling menutupi. Setelah diperbaiki, ketiganya jadi penjaga yang nyata.
3. **Nilai legacy yang hampir terlewat.** `settlements.period_type` ternyata bisa
   bernilai `daily`: migrasi `2026_07_01_140000_add_weekly_period_fields_to_settlements.php`
   mem-backfill baris lama ke `daily` sebelum default berubah ke `weekly`.
   Constraint awal saya hanya mengizinkan `weekly`, jadi nilai ini masuk daftar
   `legacy` setelah ditemukan lewat penyisiran literal di seluruh repo. Tanpa itu,
   migrasi akan gagal di production pada baris settlement lama.

**Batas pengaman yang perlu disadari.** Pre-flight check hanya memvalidasi data
yang ada di DB saat migrasi dijalankan. Ia tidak bisa menangkap literal tidak sah
di jalur kode yang belum pernah dieksekusi — ketiga temuan di atas justru
tertangkap oleh test suite dan penyisiran, bukan oleh pre-flight. Inilah sebabnya
drift guard dan test perilaku tetap diperlukan, bukan sekadar pengaman migrasi.

**Kandidat batch berikutnya** (teridentifikasi saat penyisiran, belum
dikonstraint): `orders.refund_destination_type` dan
`refund_obligations.destination_type` — dua-duanya hanya bernilai `bank` atau
`ewallet` (`RefundPayloadService`), dan belum pernah berupa ENUM sehingga tidak
ada nilai legacy tersembunyi.

DoD terpenuhi untuk kolom yang dikonstraint.

## Fase 4 — Perbaikan cascade pada tabel audit dan finansial

**Status: SELESAI untuk 14 foreign key.** Risiko: sedang, karena ini mengubah
perilaku delete, bukan sekadar performa.

Ada 52 FK `ON DELETE CASCADE`. Langkah pertama bukan mengubahnya, tapi menjawab
satu pertanyaan: **apakah ada kode yang benar-benar menghapus parent-nya?**
Jawabannya menentukan apakah perubahan ini aman atau mematahkan sesuatu.

Hasil penelusuran:

- **Tidak pernah dihapus di kode mana pun:** `users`, `outlets`, `orders`,
  `payment_attempts`. Outlet hanya di-archive (`OutletController::destroy`
  menulis `status = 'archived'`, bukan delete) dan modelnya memakai SoftDeletes,
  jadi `delete()` pun tidak pernah menghapus barisnya.
- **Dihapus di kode:** `settlements` dan `deliveries`, keduanya sengaja.

**14 FK diubah dari CASCADE ke RESTRICT:**

`settlement_audit_logs.user_id`, `pricing_audit_logs.outlet_id`,
`pricing_audit_logs.product_id`, `outlet_audit_logs.outlet_id`,
`outlet_payables.outlet_id`, `settlement_payments.outlet_id`,
`settlements.outlet_id`, `stock_movements.outlet_id`,
`payment_attempts.order_id`, `payment_transactions.order_id`,
`refund_obligations.payment_attempt_id`, `order_status_histories.order_id`,
`refund_status_histories.order_id`, `delivery_resolution_logs.order_id`.

Efeknya: menghapus user tidak lagi bisa menghapus audit settlement; menghapus
outlet tidak bisa menghapus ledger stok, settlement, dan payable-nya; dan
menghapus order tidak bisa menghapus attempt pembayaran serta riwayat statusnya.
Sebuah order yang punya attempt pembayaran kini praktis tidak bisa dihapus —
dan itu memang tujuannya.

**Yang sengaja tetap CASCADE, beserta alasannya:**

- `settlement_audit_logs.settlement_id` dan
  `settlement_payment_allocations.settlement_id` — command
  `settlement:backfill --delete-old` memang menghapus settlement non-weekly saat
  regenerasi. Mengubahnya jadi RESTRICT akan mematahkan command itu.
- `delivery_status_histories.delivery_id` — `DeliveryService` menghapus delivery
  berstatus `rejected_by_courier` supaya order bisa di-assign ulang. RESTRICT
  akan memblokir reassignment driver.
- Cascade pada `customer_id` (`customer_addresses`, `favorites`, `recipients`,
  `order_reports`) — diverifikasi bahwa `GuestOrderMerger` memindahkan seluruh
  baris anak ke customer terdaftar sebelum menghapus customer guest, jadi
  cascade ini hanya jaring pengaman dan tidak pernah kehilangan data.
- Cascade operasional lain (`order_items`, `deliveries`, `outlet_inventories`,
  `outlet_holidays`, `outlet_operating_hours`, `outlet_product_prices`,
  `products`, `restock_*`, `return_*`, `exchange_*`, `courier_*`) — baris anak
  tidak bermakna tanpa parentnya, jadi CASCADE memang semantik yang benar.

**Kesalahan yang saya buat dan perbaiki sendiri.** Versi pertama migrasi ini
melaporkan DONE tapi tidak mengubah apa pun. Penyebabnya: MySQL mengembalikan
nama kolom `information_schema` dalam huruf besar (`CONSTRAINT_NAME`), sedangkan
saya mengaksesnya sebagai `constraint_name` — dan akses properti objek di PHP
case-sensitive, jadi nama constraint selalu terbaca `null` dan seluruh loop
ter-skip. Dua perbaikan: pencarian nama yang toleran huruf besar/kecil, dan
migrasi ini sekarang **gagal berisik** kalau FK yang seharusnya ada tidak
ditemukan. Migrasi integritas tidak boleh melaporkan sukses padahal tidak
melindungi apa pun.

`AuditCascadeProtectionTest` (7 test) mengunci perilakunya: lima test membuktikan
penghapusan user/outlet/order yang punya catatan terlindungi ditolak, dan dua
test membuktikan outlet serta order tanpa catatan terlindungi tetap bisa dihapus
sehingga constraint-nya tidak berlebihan. Sudah diverifikasi gagal saat rule
dikembalikan ke CASCADE.

**Satu test lama justru mengunci perilaku yang berbahaya.**
`RefundStatusHistoryTest` punya test bernama
`test_cascade_deletes_on_parent_order_delete_at_database_level` yang menegaskan
bahwa menghapus order ikut menghapus riwayat refund-nya. Di file yang sama ada
`test_prevents_delete` yang memastikan `RefundStatusHistory` **immutable**. Dua
test itu saling bertentangan: model menolak penghapusan riwayat, tapi cascade
order menghapusnya tanpa melewati model sama sekali. Test-nya diganti menjadi
`test_refund_history_blocks_its_order_from_being_deleted`, yang membuktikan
penghapusan order ditolak dan baik order maupun riwayatnya tetap ada — sehingga
invarian immutability-nya kini benar-benar berlaku.

DoD terpenuhi.

**Kandidat yang belum diubah:** `order_reports.order_id` dan
`order_items.order_id` masih CASCADE. Risikonya rendah karena penghapusan order
kini sudah terblokir oleh attempt pembayaran dan riwayat statusnya, tapi
`order_reports` menyimpan keluhan customer sehingga secara semantik lebih dekat
ke catatan yang perlu dilindungi ketimbang baris anak biasa.

## Fase 5 — Refund destination dan duplikasi aktor di `orders`

**Status: SELESAI untuk masalah refund destination. Premis awal plan dikoreksi.**

### Premis yang tidak terbukti

Rencana awal menyebut memindahkan 9 kolom refund destination dari `orders` ke
tabel `order_refund_destinations` dengan **satu baris per order**. Setelah
diperiksa, itu bukan perbaikan:

- Memindahkan sebagian kolom ke tabel 1:1 adalah *vertical partitioning*, bukan
  normalisasi. Jumlah barisnya tetap satu per order, jadi tidak ada redundansi
  yang hilang.
- Redundansi yang nyata justru antara `orders.refund_*` dan `refund_obligations.*`.
  Pola itu disengaja: `orders` menyimpan tujuan terkini, `refund_obligations`
  menyimpan snapshot per-attempt. Memindahkan sisi `orders` tidak menyentuhnya.
- Enam kolom itu **terenkripsi** (`Order.php` cast `'encrypted'`), sehingga
  dual-write berarti menulis ciphertext ke dua tempat. Kalau keduanya menyimpang,
  membandingkan ciphertext tidak akan menunjukkan apa pun — drift-nya tak
  terdeteksi sampai ada yang mendekripsi.

### Yang ditemukan sebagai gantinya

**Riwayat tujuan refund hilang saat diubah.** `RefundService::buildDestinationUpdateData()`
menimpa kolom lama dan men-null-kan cabang lainnya, sementara
`RefundStatusHistory::create([... 'metadata' => ['destination_type' => $destinationType]])`
hanya mencatat tipenya. Jadi kalau customer mengganti rekening, nama bank, nomor
rekening, dan nama pemilik yang lama **lenyap permanen** — yang tersisa hanya
catatan bahwa pernah terjadi perubahan dan tipenya apa. Untuk alur uang, itu
celah audit yang nyata.

Kedua, **invariant bank-XOR-ewallet tidak dijaga apa pun.** Tidak ada yang
mencegah satu baris memuat `refund_bank_name` **dan** `refund_ewallet_number`
sekaligus. Kalau itu terjadi, `RefundPayloadService` membaca
`$order->refund_bank_name ?? $order->refund_ewallet_provider` sehingga cabang
bank menang diam-diam dan data ewallet tersembunyi.

### Yang dikerjakan

Dengan keputusan owner, arahnya diganti menjadi:

1. **Tabel append-only `order_refund_destinations`, satu baris per pengiriman.**
   Kolomnya self-contained: `event`, `destination_type`, enam kolom tujuan
   (terenkripsi), `actor_type`, `actor_id`, `created_at`. Modelnya immutable
   (guard `updating`/`deleting`) mengikuti pola `RefundStatusHistory`. FK
   `order_id` memakai RESTRICT sesuai keputusan Fase 4.
2. **Pencatatan di setiap pengiriman** lewat `RefundService::recordDestinationHistory()`,
   dipanggil di kedua jalur (pengiriman normal dan jalur pembukaan ulang setelah
   refund ditolak). Event-nya `submitted` saat belum ada tujuan sah, `updated`
   saat mengganti yang sudah sah.
3. **Backfill sebagai command idempoten** `refunds:backfill-destinations`
   (mendukung `--dry-run`), **bukan** di dalam migrasi. Alasannya: `orders` bisa
   besar, backfill di dalam migrasi tidak bisa diamati atau dijalankan ulang
   sebagian, dan tidak bisa diuji — sedangkan command bisa ketiganya.
4. **CHECK constraint bank-XOR-ewallet** pada `orders` **dan**
   `refund_obligations`, karena keduanya menyimpan bentuk data yang sama.
   Constraint-nya hanya menuntut salah satu cabang kosong, sehingga tujuan yang
   belum lengkap tetap bisa disimpan — status `missing`/`invalid` di
   `refund_destination_status` memang memodelkan keadaan itu.

`orders.refund_*` **tetap** sebagai tujuan terkini. Tidak ada kolom yang di-drop
dan tidak ada dual-write pada kolom terenkripsi, sehingga langkah contract yang
paling berisiko di rencana awal tidak diperlukan sama sekali.

### Detail teknis yang menentukan

Nilai di `orders` tersimpan sebagai ciphertext. Backfill menyalinnya **mentah
lewat query builder**, bukan lewat model — memakai model dengan cast `encrypted`
akan mengenkripsi ulang nilai yang sudah terdekripsi. Ciphertext Laravel bersifat
portabel antar tabel selama `APP_KEY` sama, jadi baris hasil salinan tetap bisa
didekripsi. Ini **dibuktikan test**, bukan diasumsikan:
`test_backfill_copies_encrypted_destination_values` menulis lewat model, menyalin
lewat command, dan membaca kembali lewat model baru.

### Test

`RefundDestinationHistoryTest` (9 test): riwayat bertambah dan rekening lama tetap
terbaca, tujuan ewallet hanya mengisi kolom ewallet, aktor owner tercatat,
immutability pada update dan delete, penolakan baris yang memuat bank **dan**
ewallet sekaligus, backfill mempertahankan nilai terenkripsi, backfill idempoten,
dan `--dry-run` tidak menulis apa pun. Sudah diverifikasi gagal saat pencatatan
riwayat dimatikan.

**Catatan integritas yang lebih ketat dari tabel kembarannya.** Tabel baru ini
memberi FK pada `actor_id` → `users` (SET NULL), sedangkan `refund_status_histories.actor_id`
tidak punya FK sama sekali. Konsekuensinya terlihat saat test suite berjalan:
`RefundServiceTest` memakai `actor_id = 1` hardcoded tanpa membuat user, dan dulu
itu lolos karena tidak ada FK yang menahannya. Dua test itu diperbaiki agar
membuat owner sungguhan. Pemanggil produksi tidak terpengaruh karena
`Owner/RefundController` mengirim id owner yang terautentikasi dan
`Customer/OrderController` mengirim `null`.

**CHECK constraint juga membongkar test yang memakai data tidak koheren.** Tiga
test enkripsi — di `RefundObligationTest` dan `OrderPaymentStatusTest` —
mengisi **keenam** kolom sekaligus (bank dan ewallet) hanya demi kemudahan,
padahal bentuk itu memang tidak valid. Ketiganya dipecah menjadi test cabang bank
dan test cabang ewallet. Cakupannya justru bertambah karena cabang ewallet kini
diuji eksplisit, bukan sekadar ikut terisi.

### Sisa untuk fase berikutnya

Duplikasi aktor dan timestamp di `orders`: `confirmed_by/at`, `rejected_by/at`,
`cancelled_by/at`. `order_status_histories` sudah mencatat `changed_by` dan
`to_status` untuk setiap transisi, jadi kolom-kolom itu berpotensi jadi cache yang
bisa di-drop — tapi perlu diverifikasi lebih dulu bahwa tidak ada transisi yang
histories-nya hilang, dan keputusan itu belum diambil.

## Fase 6 — Satukan sumber relasi pembayaran ke settlement

**Risiko:** tinggi. Menyentuh uang.

Hari ini ada dua jalur: kolom `settlement_payments.settlement_id` (kini sudah
punya FK) dan tabel `settlement_payment_allocations` (many-to-many dengan
`allocated_amount`). Keduanya bisa berbeda dan tidak ada yang menjamin
konsistensinya.

Langkah:

1. Audit: cari baris yang `settlement_id`-nya tidak cocok dengan isi
   allocations, atau yang jumlah `allocated_amount`-nya tidak sama dengan
   `amount`.
2. Tambahkan test invariant yang mengunci aturan yang dipilih.
3. Baru putuskan arah: jadikan allocations satu-satunya sumber, atau jadikan
   `settlement_id` turunan yang dihitung.
4. Migrasi data dengan verifikasi nol selisih, lalu hapus jalur yang kalah.

## Tabel Risiko

| Fase | Risiko | Butuh maintenance | Rollback |
|---|---|---|---|
| 0 | Rendah (durasi rebuild) | Ya, untuk migrasi presisi | `down()` sudah diuji, faithful |
| 1 | Rendah | Tidak | Revert kode |
| 2a | Rendah | Tidak | Revert kode |
| 2b | Rendah (tanpa schema) | Tidak | Revert kode |
| 3 | Sedang | Tidak | Drop constraint |
| 4 | Sedang | Tidak | Kembalikan rule FK |
| 5 | Tinggi | Ya | Expand/contract memungkinkan rollback per langkah |
| 6 | Tinggi | Ya | Butuh backup, verifikasi nol selisih |

## Prasyarat Sebelum Fase 5 dan 6

- Snapshot production tersedia dan bisa direstore berulang
- Backup terjadwal terverifikasi (saat ini offsite backup di-WAIVE, hanya lokal)
- CI tidak lagi flaky (Fase 1 poin 5)
- Ada test yang menghitung jumlah query untuk mendeteksi regresi N+1
