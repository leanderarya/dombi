# Phase 9: Production Deployment (Hostinger) - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy Dombi application to Hostinger shared hosting

**Architecture:** Laravel 13 + React 19 + Inertia.js + MySQL 8.0, deployed to Hostinger shared hosting with Apache

**Tech Stack:** PHP 8.3, MySQL 8.0, Node.js 20, Vite 8, Hostinger Shared Hosting

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `.env.production` | Create | Production environment config |
| `config/queue.php` | Modify | Set queue to sync for shared hosting |
| `app/Console/Kernel.php` | Verify | Scheduler configuration |

---

### Task 1: Server Setup (Hostinger Control Panel)

**Estimated:** 0.5 day

- [ ] **Step 1: Create MySQL Database**

Via Hostinger Control Panel → Databases → MySQL:
- Database name: `dombi_production`
- Username: `dombi_user`
- Password: (generate strong password)
- Catat credentials untuk .env

- [ ] **Step 2: Set PHP Version**

Via Hostinger Control Panel → Advanced → PHP Configuration:
- Set PHP version ke 8.3
- Enable extensions: pdo_mysql, openssl, mbstring, json, fileinfo, bcmath

- [ ] **Step 3: Set Document Root**

Via Hostinger Control Panel → Websites → Manage:
- Document root: `public_html/public` (atau sesuai struktur Hostinger)

- [ ] **Step 4: Verify PHP Extensions**

```bash
php -m | grep -E "pdo_mysql|openssl|mbstring|json|fileinfo|bcmath"
```

Expected: All extensions listed

---

### Task 2: Build Frontend Assets (Lokal)

**Estimated:** 0.5 day

- [ ] **Step 1: Install dependencies**

```bash
npm ci
composer install --optimize-autoloader --no-dev
```

- [ ] **Step 2: Build frontend**

```bash
npm run build
```

Expected: Files generated in `public/build/`

- [ ] **Step 3: Generate APP_KEY**

```bash
php artisan key:generate --show
```

Catat output untuk .env

- [ ] **Step 4: Create production .env**

```env
APP_NAME=Dombi
APP_ENV=production
APP_KEY=base64:xxx (dari step 3)
APP_DEBUG=false
APP_URL=https://dombi.id

LOG_CHANNEL=single
LOG_LEVEL=error

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=dombi_production
DB_USERNAME=dombi_user
DB_PASSWORD=xxx (dari Hostinger)

SESSION_DRIVER=database
SESSION_LIFETIME=120

CACHE_STORE=database

QUEUE_CONNECTION=sync

MAIL_MAILER=smtp
MAIL_HOST=smtp.hostinger.com
MAIL_PORT=587
MAIL_USERNAME=noreply@dombi.id
MAIL_PASSWORD=xxx
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=noreply@dombi.id
MAIL_FROM_NAME="${APP_NAME}"

GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT=https://dombi.id/auth/google/callback
```

- [ ] **Step 5: Upload files ke Hostinger**

Upload via File Manager atau FTP:
- Seluruh folder kecuali: `node_modules/`, `.git/`, `tests/`, `.env.example`
- Pastikan `public/build/` ter-upload (hasil build)

---

### Task 3: Server Configuration

**Estimated:** 0.5 day

- [ ] **Step 1: Set permissions**

Via SSH atau File Manager:
```bash
chmod -R 755 storage/
chmod -R 755 bootstrap/cache/
```

- [ ] **Step 2: Create storage symlink**

```bash
php artisan storage:link
```

- [ ] **Step 3: Run migrations**

```bash
php artisan migrate --force
```

- [ ] **Step 4: Seed database**

```bash
php artisan db:seed --force
```

- [ ] **Step 5: Cache configuration**

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

---

### Task 4: Scheduler & Queue Setup

**Estimated:** 0.5 day

- [ ] **Step 1: Setup cron job**

Via Hostinger Control Panel → Advanced → Cron Jobs:

```
* * * * * cd /home/username/public_html && php artisan schedule:run >> /dev/null 2>&1
```

- [ ] **Step 2: Verify queue processing**

Karena menggunakan `sync` driver, queue akan diproses secara inline. Tidak perlu setup tambahan.

- [ ] **Step 3: Test scheduler**

```bash
php artisan schedule:list
```

Expected: List of scheduled commands

---

### Task 5: Domain & SSL

**Estimated:** 0.5 day

- [ ] **Step 1: Point domain ke Hostinger**

Via domain registrar:
- Update nameserver ke Hostinger nameservers
- Atau buat A record pointing ke IP Hostinger

- [ ] **Step 2: Setup SSL**

Via Hostinger Control Panel → Security → SSL:
- Install Let's Encrypt SSL certificate
- Force HTTPS redirect

- [ ] **Step 3: Verify SSL**

```bash
curl -I https://dombi.id
```

Expected: HTTP/2 200 with security headers

---

### Task 6: Post-Deployment Verification

**Estimated:** 0.5 day

- [ ] **Step 1: Test Customer Flow**

- [ ] Browse products at `/customer/products`
- [ ] Add to cart
- [ ] Checkout (pickup)
- [ ] View order tracking

- [ ] **Step 2: Test Owner Flow**

- [ ] Login as owner
- [ ] View dashboard
- [ ] Manage outlets
- [ ] View finance/settlements

- [ ] **Step 3: Test Outlet Flow**

- [ ] Login as outlet
- [ ] View orders
- [ ] Process order (confirm, prepare, ready)
- [ ] Submit settlement payment

- [ ] **Step 4: Test Courier Flow**

- [ ] Login as courier
- [ ] View deliveries
- [ ] Update delivery status

- [ ] **Step 5: Test Scheduled Tasks**

```bash
php artisan schedule:run
```

Expected: Commands execute successfully

- [ ] **Step 6: Monitor error logs**

```bash
tail -f storage/logs/laravel.log
```

Expected: No errors

---

## Verification

After completing all tasks:

1. All user roles can login and access their dashboards
2. Order flow works end-to-end (customer → outlet → courier)
3. Settlement flow works (outlet submits, owner verifies)
4. Scheduled tasks run correctly
5. No errors in logs
6. SSL certificate valid

## Summary

| Task | Description | Est. |
|------|-------------|------|
| 1 | Server Setup (Hostinger Control Panel) | 0.5d |
| 2 | Build Frontend Assets (Lokal) | 0.5d |
| 3 | Server Configuration | 0.5d |
| 4 | Scheduler & Queue Setup | 0.5d |
| 5 | Domain & SSL | 0.5d |
| 6 | Post-Deployment Verification | 0.5d |
| **Total** | | **3d** |

---

## Troubleshooting

### Common Issues

1. **500 Error after deployment**
   - Check `storage/logs/laravel.log`
   - Verify `.env` configuration
   - Run `php artisan config:cache`

2. **Database connection failed**
   - Verify DB credentials in `.env`
   - Check if MySQL is running
   - Verify database exists

3. **Assets not loading**
   - Verify `public/build/` directory exists
   - Check file permissions
   - Clear browser cache

4. **Scheduler not running**
   - Verify cron job is set up correctly
   - Check `storage/logs/laravel.log` for errors
   - Test manually: `php artisan schedule:run`

5. **Queue jobs not processing**
   - Verify `QUEUE_CONNECTION=sync` in `.env`
   - Check `jobs` table exists
