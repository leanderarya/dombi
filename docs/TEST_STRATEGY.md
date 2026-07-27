# Dombi — Risk-Based Test Strategy

Tujuan testing bukan mengklik semua halaman. Tujuannya memberi bukti cepat bahwa
risiko uang, stok, akses, dan lifecycle tetap terkendali.

## Test Cadence

| Kapan | Gate |
|---|---|
| Saat mengembangkan | Test terkait perubahan + lint/type check terkait |
| Sebelum merge | Full PHP/JS suite, lint, format, type check, build |
| Sebelum release | Critical suite, migration rehearsal, DOKU sandbox, restore drill, smoke test |
| Setelah deploy | Automated health check + satu transaksi canary bernilai kecil |

## Critical Invariants

Prioritaskan test berikut:

1. Authorization dan ownership untuk semua mutation.
2. Checkout atomic dan tidak oversell saat request bersamaan.
3. Webhook signature, amount/invoice match, serta idempotensi yang durable.
4. Retry, timeout, late payment, cancellation, dan stock release.
5. Transisi order hanya melalui state yang legal.
6. Refund tidak ganda dan memiliki audit trail.
7. Settlement tidak diverifikasi atau dialokasikan dua kali jika fitur diaktifkan.
8. Order delivery yang belum dibayar tidak dapat di-assign atau dikirim.
9. Assignment kurir tidak ganda dan tidak melewati batas ownership.
10. Ongkir customer dan biaya aktual kurir eksternal tidak saling mengubah.

Test relevan saat ini antara lain:

- `tests/Feature/P0CheckoutHardeningTest.php`
- `tests/Feature/DokuPaymentAtomicTest.php`
- `tests/Feature/PaymentAuthorizationMutationTest.php`
- `tests/Feature/StockValidationRaceConditionTest.php`
- `tests/Feature/OrderStatusRaceConditionTest.php`
- `tests/Feature/OwnershipBypassTest.php`
- `tests/Feature/DeliverySafetyTest.php`
- test refund di `tests/Feature/`

## Canonical Verification

Gunakan database MySQL test disposable. Jangan pernah menunjuk ke database staging
atau production.

```bash
composer install --no-interaction --prefer-dist
npm ci
php artisan migrate:fresh --env=testing
php artisan test
composer lint:check
npm run lint:check
npm run format:check
npm run types:check
npm test
npm run build
```

Targeted critical suite:

```bash
php artisan test --filter='P0CheckoutHardening|DokuPaymentAtomic|PaymentAuthorizationMutation|StockValidationRaceCondition|OrderStatusRaceCondition|OwnershipBypass|Refund'
```

## Manual Smoke Matrix

Jangan menguji setiap layar. Uji perjalanan ini:

1. Guest membuat order pickup dan membayar.
2. Guest membuat order delivery dalam radius dan membayar.
3. Alamat di luar radius ditolak sebelum pembayaran.
4. Outlet menyelesaikan delivery dengan kurir Dombi.
5. Outlet menyelesaikan delivery eksternal dan mencatat biaya aktual.
6. Webhook mengubah status; duplicate webhook tidak mengulang efek.
7. Cancel/expiry mengembalikan stok.
8. Pembayaran gagal/pending/terlambat dapat dipulihkan.
9. Owner menjalankan refund manual.
10. User lain gagal membaca atau mengubah order/delivery tersebut.
11. Scheduler, queue, dan failed jobs dapat diperiksa.

GPS, routing, auto-assignment, shift, dan integrasi API kurir bukan syarat launch.

## CI Policy

- Test dan quality workflow wajib aktif untuk pull request dan branch yang deploy.
- Production deploy wajib bergantung pada job quality yang hijau.
- Branch protection harus mencegah bypass.
- CI harus menyediakan MySQL service dan credential disposable.
- Flaky test tidak boleh diabaikan; karantina dengan owner dan batas waktu.
- Angka jumlah test di dokumen bukan bukti. Hasil CI commit yang akan dirilis adalah
  bukti.

## Kondisi Saat Audit

Pada 2026-07-27:

- workflow test dan lint hanya merespons branch `never`;
- production deploy berjalan pada push ke `main` tanpa test dependency;
- suite berisi sekitar 990 test;
- percobaan lokal menghasilkan 39 pass dan 951 error karena MySQL test tidak
  tersedia, bukan karena 951 regresi aplikasi;
- `phpunit.xml` memuat credential MySQL literal dan CI tidak menyediakan service
  MySQL.

Karena itu klaim suite hijau belum dapat dipakai sebagai release evidence sampai
environment test dibuat reproducible.
