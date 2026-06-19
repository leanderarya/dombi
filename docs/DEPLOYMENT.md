# Dombi - Deployment Workflow (Hostinger)

## Quick Deploy Steps

### 1. Pull Latest Changes (Lokal)

```bash
cd /Users/aryaajisadda/Herd/dombi
git pull origin main
```

### 2. Build Frontend (Lokal)

```bash
npm run build
```

Output: `public/build/` folder

### 3. Upload ke Server

Upload `public/build/` folder ke `/public_html/public/build/` via:
- Hostinger File Manager
- FTP/SFTP
- rsync (jika ada SSH access)

### 4. Upload Backend Changes (jika ada file PHP yang berubah)

Upload file PHP yang berubah ke server, sesuai path structure.

### 5. Clear Cache di Server

```bash
/opt/alt/php83/usr/bin/php artisan config:cache
/opt/alt/php83/usr/bin/php artisan route:cache
/opt/alt/php83/usr/bin/php artisan view:cache
```

---

## Full Deployment (Pertama Kali / Reset)

### Step 1: Upload Semua File

Upload seluruh project ke `/public_html/` kecuali:
- `node_modules/`
- `.git/`
- `tests/`
- `.env.example`

### Step 2: Setup Environment

```bash
# Copy .env.production ke .env
cp .env.production .env

# Edit .env dengan credentials Hostinger
# - DB_DATABASE, DB_USERNAME, DB_PASSWORD
# - APP_URL=https://lightcyan-mink-255361.hostingersite.com
# - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
```

### Step 3: Install Dependencies

```bash
/opt/alt/php83/usr/bin/php /opt/alt/php83/usr/bin/composer install --optimize-autoloader --no-dev
```

### Step 4: Generate APP_KEY (jika belum ada)

```bash
/opt/alt/php83/usr/bin/php artisan key:generate
```

### Step 5: Run Migrations

```bash
/opt/alt/php83/usr/bin/php artisan migrate --force
```

### Step 6: Seed Database

```bash
/opt/alt/php83/usr/bin/php artisan db:seed --force
```

### Step 7: Create Storage Symlink

```bash
/opt/alt/php83/usr/bin/php artisan storage:link
```

### Step 8: Cache Configuration

```bash
/opt/alt/php83/usr/bin/php artisan config:cache
/opt/alt/php83/usr/bin/php artisan route:cache
/opt/alt/php83/usr/bin/php artisan view:cache
```

### Step 9: Set Permissions

```bash
chmod -R 755 storage/
chmod -R 755 bootstrap/cache/
```

### Step 10: Setup Cron Job

Via Hostinger Control Panel → Advanced → Cron Jobs:

```
* * * * * cd /home/username/public_html && /opt/alt/php83/usr/bin/php artisan schedule:run >> /dev/null 2>&1
```

---

## Verification Checklist

- [ ] Homepage loads: `https://lightcyan-mink-255361.hostingersite.com/`
- [ ] Login works: `/login`
- [ ] Customer flow: browse → checkout → order
- [ ] Owner dashboard: `/owner/dashboard`
- [ ] Outlet dashboard: `/outlet/dashboard`
- [ ] Courier dashboard: `/courier/dashboard`
- [ ] No errors in `storage/logs/laravel.log`

---

## Troubleshooting

### 500 Error

```bash
# Check error log
tail -f storage/logs/laravel.log

# Clear all cache
/opt/alt/php83/usr/bin/php artisan cache:clear
/opt/alt/php83/usr/bin/php artisan config:clear
/opt/alt/php83/usr/bin/php artisan route:clear
/opt/alt/php83/usr/bin/php artisan view:clear

# Re-cache
/opt/alt/php83/usr/bin/php artisan config:cache
/opt/alt/php83/usr/bin/php artisan route:cache
```

### Assets Not Loading

```bash
# Verify build folder exists
ls -la public/build/

# Clear browser cache
# Verify .env APP_URL is correct
```

### Database Connection Failed

```bash
# Check .env database credentials
cat .env | grep DB_

# Test connection
/opt/alt/php83/usr/bin/php artisan tinker --execute="DB::connection()->getPdo(); echo 'Connected';"
```

---

## Akun Demo

| Role | Email | Password |
|------|-------|----------|
| Owner | `owner@example.com` | `password` |
| Outlet Tembalang | `outlet.tembalang@example.com` | `password` |
| Outlet Banyumanik | `outlet.banyumanik@example.com` | `password` |
| Courier | `courier@example.com` | `password` |
