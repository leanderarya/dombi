# Dombi

[![Deploy Staging](https://github.com/leanderarya/dombi/actions/workflows/deploy-staging.yml/badge.svg)](https://github.com/leanderarya/dombi/actions/workflows/deploy-staging.yml)

Operational commerce platform untuk bisnis susu kambing Dombi. Satu sistem menangani
siklus penuh operasi harian: katalog → keranjang → checkout → pembayaran online →
persiapan order → pengantaran → settlement keuangan. Tujuannya memusatkan operasi yang
sebelumnya tersebar (order via WhatsApp, stok di kertas, laporan manual) dan
menghilangkan koreksi transaksi manual.

## Empat Panel

Aplikasi **customer** menghadap pelanggan lewat APK Android (`com.dombi.customer`,
sideload) dan PWA. Tiga panel **internal** (Owner, Outlet, Courier) diakses lewat browser.

| Panel | Pengguna | Inti pekerjaan |
|---|---|---|
| **Customer** | Pelanggan (guest atau terdaftar) | Katalog, checkout pickup/delivery, bayar online, tracking berbasis token, cancel, refund/return/exchange |
| **Outlet** | Staf titik penjualan | Proses order masuk (`confirmed → preparing → ready`), stok & restock, pilih kurir, penjualan offline, settlement |
| **Owner** | Pemilik bisnis | Katalog, harga & zona ongkir, stok pusat, verifikasi settlement, kelola kurir, refund manual, dashboard analitik |
| **Courier** | Kurir pengantar | Lihat assignment sendiri, update status pengantaran, riwayat |

## Tech Stack

- **Backend:** Laravel 13.8, PHP 8.3, MySQL 8
- **Frontend:** React 19, TypeScript, Inertia.js 3, Tailwind CSS v4, Vite
- **Mobile:** Capacitor Android (`com.dombi.customer`)
- **Pembayaran:** DOKU — QRIS, Transfer Bank, VA, E-Wallet, Kartu (webhook idempotent)
- **Push:** Web Push (VAPID) + FCM
- **Auth:** Google OAuth + guest checkout (nama, nomor telepon, guest token)
- **Maps:** Leaflet + OpenStreetMap
- **Monitoring:** Sentry
- **Backup:** spatie/laravel-backup

## Status Rilis

| Environment | URL | Sumber |
|---|---|---|
| Production | `https://app.dombicenter.com` | branch `main`, tag `release-YYYY-MM-DD` |
| Staging | `https://staging.dombicenter.com` | branch `develop` |

- **Web** live di production. Rilis terakhir: tag `release-2026-10-11.2`.
- **Android (customer)** dirilis sebagai **APK bertanda tangan sideload**, v1.1
  (`versionCode 2`) — belum Play Store. Ritual: [RELEASE_ANDROID.md](docs/RELEASE_ANDROID.md).
- Branch `main` dan `develop` diproteksi: push langsung ditolak, semua lewat PR.

## Development

```bash
# Clone
git clone https://github.com/leanderarya/dombi.git
cd dombi

# Install dependencies
composer install
npm install

# Setup environment
cp .env.example .env
php artisan key:generate

# Database
php artisan migrate
php artisan db:seed

# Build frontend
npm run dev

# Run server
php artisan serve
```

## Testing

Pull requests dan push ke `develop` atau `main` menjalankan GitHub Actions **Quality
Gate**: PHP test di MySQL 8 sekali pakai, format PHP, format/lint/type frontend, Vitest,
dan production build frontend.

```bash
# Quality gate lokal (perintah yang sama dengan CI)
composer lint:check && npm run lint && npm run format:check && npx tsc --noEmit && php artisan test

# Run all tests
php artisan test

# Run specific test suite
php artisan test --testsuite=Feature
```

## Release

Dua jalur rilis yang tidak saling menggantikan. SOP operator tunggal lengkap ada di
[Deployment Runbook](docs/DEPLOYMENT.md).

### Web (develop → main)

```text
ubah kode lokal
  → quality gate lokal hijau
  → PR ke develop                → quality gate CI
  → merge ke develop             → deploy staging otomatis
  → verifikasi di staging        → simpan bukti
  → PR develop → main            → setujui environment production
  → health gate (/up + /api/health 2xx)
  → tag annotated + push
```

Detail pre-cutover gate, health check, dan rollback: [DEPLOYMENT.md](docs/DEPLOYMENT.md).

### Android APK

APK memuat situs langsung, jadi perubahan web sudah terlihat tanpa merilis APK baru. APK
baru hanya perlu kalau ada perubahan native (plugin, izin, ikon, splash, nama, URL server).

```bash
# 1. Naikkan versionCode (wajib) + versionName di android/app/build.gradle
# 2. Build production (URL dibake ke APK)
CAP_SERVER_URL=https://app.dombicenter.com ./scripts/build-apk.sh customer release
# 3. Verifikasi: apksigner, aapt2, install di perangkat, uji kamera/barcode/lokasi
# 4. Catat evidence, lalu serahkan APK
```

Tanpa `CAP_SERVER_URL`, build memakai staging — sengaja, supaya build produksi tidak
pernah terjadi karena lupa. Langkah lengkap + penandatanganan: [RELEASE_ANDROID.md](docs/RELEASE_ANDROID.md).

## Documentation

- [Product Scope](docs/PRODUCT_SCOPE.md) - Sumber kebenaran scope soft launch dan invariant bisnis
- [Production Checklist](docs/PRODUCTION_CHECKLIST.md) - Gate go/no-go berbasis bukti
- [Deployment Runbook](docs/DEPLOYMENT.md) - SOP rilis, health gate, rollback
- [Android Release](docs/RELEASE_ANDROID.md) - Ritual rilis APK dan keystore
- [Testing](docs/TESTING.md) - Strategi dan panduan pengujian
- [Runbook](docs/RUNBOOK.md) - Operasi dan penanganan insiden
- [Bug Log](docs/BUG_LOG.md) - Bug hasil testing manual
- [Backup & Restore](docs/BACKUP_RESTORE.md) - Prosedur backup
- [Product Images](docs/PRODUCT-IMAGES.md) - Image management guide
- [DOKU Payment](docs/doku-payment.md) - Payment integration docs

`docs/PRD.md` adalah draft (v0.4) dan memuat riwayat lama. Untuk keputusan release,
acu ke Product Scope dan Production Checklist di atas.

## License

Proprietary - Dombi Team
