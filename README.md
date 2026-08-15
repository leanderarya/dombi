# Dombi

[![Deploy Staging](https://github.com/leanderarya/dombi/actions/workflows/deploy-staging.yml/badge.svg)](https://github.com/leanderarya/dombi/actions/workflows/deploy-staging.yml)

Operational commerce platform untuk distribusi produk segar harian.

## Tech Stack

- **Backend:** Laravel 13, PHP 8.3, MySQL 8
- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Inertia.js
- **Mobile:** Capacitor (Android)
- **Payment:** DOKU (QRIS, Transfer, VA)
- **Auth:** Google OAuth + session-based
- **Maps:** Leaflet + OpenStreetMap
- **Monitoring:** Sentry

## Roles

| Role | Description |
|------|-------------|
| **Customer** | Belanja produk via app Android / PWA |
| **Outlet** | Kelola pesanan, stok, restock, settlement |
| **Owner** | Kelola produk, outlet, pricing, keuangan, kurir |
| **Courier** | Antar pesanan ke customer |

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

Pull requests and pushes to `develop` or `main` run the GitHub Actions
`Quality Gate`: PHP tests on disposable MySQL 8, PHP formatting, frontend
format/lint/type checks, Vitest, and the production frontend build.

```bash
# Run all tests
php artisan test

# Run specific test suite
php artisan test --testsuite=Feature
```

## Deployment

GitHub Actions menjalankan quality gate untuk push dan pull request ke `develop` atau `main`.

- Push ke `develop` → deploy staging: `https://staging.dombicenter.com`
- Push ke `main` → deploy production: `https://app.dombicenter.com`

Detail pre-cutover gate, deployment, health check, APK, dan rollback:
[Deployment Runbook](docs/DEPLOYMENT.md)

## Documentation

- [Product Scope](docs/PRODUCT_SCOPE.md) - Scope soft launch dan batas fitur
- [Production Checklist](docs/PRODUCTION_CHECKLIST.md) - Gate go/no-go berbasis bukti
- [Test Strategy](docs/TEST_STRATEGY.md) - Pengujian berbasis risiko
- [Runbook](docs/RUNBOOK.md) - Operasi dan penanganan insiden
- [Product Images](docs/PRODUCT-IMAGES.md) - Image management guide
- [DOKU Payment](docs/doku-payment.md) - Payment integration docs

`PRD.md`, `PROGRESS.md`, `ROADMAP.md`, `TESTING.md`, dan `DEPLOYMENT.md` memuat
snapshot serta riwayat lama. Jangan gunakan dokumen tersebut sebagai keputusan
release tanpa memverifikasinya terhadap empat dokumen operasional di atas.

## License

Proprietary - Dombi Team
