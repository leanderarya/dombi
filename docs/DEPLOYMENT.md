# Dombi — Deployment & Operations Guide

## Architecture Overview

Dombi is a goat milk distribution operational system built with:
- **Backend**: Laravel 11 + MySQL
- **Frontend**: Inertia.js + React + TypeScript + Tailwind CSS
- **Mobile**: PWA (installable, offline-capable)
- **Roles**: Owner, Outlet, Courier, Customer

## Inventory Flow

```
Order Created → reserved_stock ↑ (current_stock unchanged)
Delivery Completed → current_stock ↓, reserved_stock ↓
Order Cancelled → reserved_stock ↓
Restock Received → current_stock ↑
```

All stock mutations are atomic (DB::transaction + lockForUpdate).

## Production Setup

### Requirements
- PHP 8.2+
- MySQL 8.0+
- Node.js 20+
- Composer 2.x

### Deployment Steps

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
composer install --no-dev --optimize-autoloader
npm ci

# 3. Build frontend
npm run build

# 4. Run migrations
php artisan migrate --force

# 5. Cache config/routes/views
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 6. Restart queue workers (if using)
php artisan queue:restart
```

### Environment Variables (Production)

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.com
APP_VERSION=1.x.x

DB_CONNECTION=mysql
SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database

LOG_CHANNEL=stack
LOG_STACK=daily
LOG_LEVEL=warning
```

### Health Check

- `GET /api/health` — Returns 200 if healthy, 503 if degraded
- `GET /api/version` — Returns current app version + build timestamp
- `GET /api/status` — Detailed system info (owner-only, requires auth)

## Rollback Procedure

```bash
# 1. Revert code
git checkout <previous-tag>

# 2. Reinstall
composer install --no-dev --optimize-autoloader
npm ci && npm run build

# 3. Rollback migration (if needed)
php artisan migrate:rollback --step=1

# 4. Re-cache
php artisan config:cache && php artisan route:cache
```

## Operational Recovery

### Inventory Mismatch
1. Go to Owner → Inventory → Edit
2. Set correct `current_stock` with reason in notes
3. System validates: `current_stock >= reserved_stock`
4. All adjustments logged in Audit Trail

### Failed Delivery
1. Go to Owner → Deliveries → filter "failed"
2. Choose resolution:
   - **Retry**: Order goes back to ready_for_pickup
   - **Return to Outlet**: Order goes back to preparing
   - **Cancel & Release**: Reserved stock released, order cancelled

### Database Backup

```bash
# Daily backup
mysqldump -u root -p dombi > backup_$(date +%Y%m%d).sql

# Restore
mysql -u root -p dombi < backup_YYYYMMDD.sql
php artisan migrate
```

## Rate Limits

| Action | Limit |
|--------|-------|
| Login | 5/min per IP |
| Checkout | 3/min per user |
| Stock Adjustment | 10/min per user |
| CSV Export | 5/min per user |
| Sensitive Actions | 10/min per user |

## PWA Update Flow

1. New deploy updates `public/build/manifest.json` timestamp
2. Frontend polls `/api/version` every 5 minutes
3. If build hash changes → "Versi baru tersedia" banner appears
4. User clicks "Refresh" → page reloads with new assets
5. Service worker activates new cache on next visit

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 503 on health check | Check DB connection, run `php artisan migrate` |
| Stale frontend | Clear browser cache, or wait for update banner |
| Stock mismatch | Use Owner → Inventory → Edit with notes |
| Failed delivery stuck | Use Owner → Deliveries → Resolve |
| Login rate limited | Wait 1 minute, or check IP |
