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

```bash
# Run all tests
php artisan test

# Run specific test suite
php artisan test --testsuite=Feature
```

## Deployment

Auto-deploy to staging on push to `develop` branch via GitHub Actions.

**Staging:** https://staging.dombicenter.com

## Documentation

- [Testing Guide](docs/TESTING.md) - Comprehensive testing guide for all roles
- [Product Images](docs/PRODUCT-IMAGES.md) - Image management guide
- [DOKU Payment](docs/doku-payment.md) - Payment integration docs

## License

Proprietary - Dombi Team