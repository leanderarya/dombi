# Phase 9: Production Deployment - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy Dombi ke production environment

**Architecture:** Standard Laravel deployment dengan Nginx, MySQL, Redis

**Tech Stack:** Laravel 13, PHP 8.3, MySQL 8.0+, Redis, Nginx

---

## Prerequisites

- [ ] Server/VPS dengan Ubuntu 22.04+ atau similar
- [ ] Domain name sudah diarahkan ke server
- [ ] SSH access ke server
- [ ] SSL certificate (Let's Encrypt)

---

### Task 1: Server Setup

**Estimated:** 1 day

- [ ] **Step 1: Install dependencies**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install PHP 8.3
sudo apt install -y software-properties-common
sudo add-apt-repository ppa:ondrej/php
sudo apt update
sudo apt install -y php8.3 php8.3-fpm php8.3-mysql php8.3-xml php8.3-curl php8.3-mbstring php8.3-zip php8.3-bcmath php8.3-gd php8.3-intl php8.3-redis

# Install MySQL 8.0
sudo apt install -y mysql-server
sudo mysql_secure_installation

# Install Redis
sudo apt install -y redis-server

# Install Nginx
sudo apt install -y nginx

# Install Composer
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

- [ ] **Step 2: Configure PHP**

Edit `/etc/php/8.3/fpm/php.ini`:

```ini
memory_limit = 256M
upload_max_filesize = 10M
post_max_size = 10M
max_execution_time = 60
date.timezone = Asia/Jakarta
```

- [ ] **Step 3: Configure MySQL**

```sql
CREATE DATABASE dombi_production;
CREATE USER 'dombi'@'localhost' IDENTIFIED BY 'strong_password_here';
GRANT ALL PRIVILEGES ON dombi_production.* TO 'dombi'@'localhost';
FLUSH PRIVILEGES;
```

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore: document server setup prerequisites"
```

---

### Task 2: Application Deployment

**Estimated:** 0.5 day

- [ ] **Step 1: Clone repository**

```bash
cd /var/www
sudo git clone https://github.com/your-repo/dombi.git
sudo chown -R www-data:www-data dombi
cd dombi
```

- [ ] **Step 2: Install dependencies**

```bash
composer install --optimize-autoloader --no-dev
npm ci
npm run build
```

- [ ] **Step 3: Configure environment**

```bash
cp .env.example .env
php artisan key:generate
```

Edit `.env`:

```env
APP_NAME=Dombi
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=dombi_production
DB_USERNAME=dombi
DB_PASSWORD=strong_password_here

CACHE_STORE=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis

REDIS_HOST=127.0.0.1
REDIS_PORT=6379

MAIL_MAILER=log
```

- [ ] **Step 4: Run migrations and seed**

```bash
php artisan migrate --force
php artisan db:seed --force
php artisan storage:link
```

- [ ] **Step 5: Optimize**

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
```

- [ ] **Step 6: Commit**

```bash
git commit --allow-empty -m "chore: document application deployment steps"
```

---

### Task 3: Nginx Configuration

**Estimated:** 0.5 day

- [ ] **Step 1: Create Nginx config**

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    root /var/www/dombi/public;
    index index.php;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }

    client_max_body_size 10M;
}
```

- [ ] **Step 2: Enable site**

```bash
sudo ln -s /etc/nginx/sites-available/dombi /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "chore: document Nginx configuration"
```

---

### Task 4: SSL Certificate

**Estimated:** 0.5 day

- [ ] **Step 1: Install Certbot**

```bash
sudo apt install -y certbot python3-certbot-nginx
```

- [ ] **Step 2: Obtain certificate**

```bash
sudo certbot --nginx -d your-domain.com
```

- [ ] **Step 3: Auto-renewal**

```bash
sudo crontab -e
# Add: 0 0 1 * * certbot renew --quiet
```

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore: document SSL setup"
```

---

### Task 5: Scheduler & Queue

**Estimated:** 0.5 day

- [ ] **Step 1: Setup cron**

```bash
crontab -e
```

Add:

```cron
* * * * * cd /var/www/dombi && php artisan schedule:run >> /dev/null 2>&1
```

- [ ] **Step 2: Setup queue worker**

Create `/etc/systemd/system/dombi-queue.service`:

```ini
[Unit]
Description=Dombi Queue Worker
After=network.target

[Service]
User=www-data
Group=www-data
Restart=always
ExecStart=/usr/bin/php /var/www/dombi/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable dombi-queue
sudo systemctl start dombi-queue
```

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "chore: document scheduler and queue setup"
```

---

### Task 6: Backup Configuration

**Estimated:** 0.5 day

- [ ] **Step 1: Configure Spatie Backup**

Edit `config/backup.php`:

```php
'destination' => [
    'filename_prefix' => 'dombi-backup-',
    'disks' => ['local'],
],
```

- [ ] **Step 2: Setup backup schedule**

Already configured in `routes/console.php`:

```php
Schedule::command('backup:clean')->daily()->at('02:00');
Schedule::command('backup:run')->daily()->at('02:30');
Schedule::command('backup:monitor')->daily()->at('03:00');
```

- [ ] **Step 3: Test backup**

```bash
php artisan backup:run
```

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore: document backup configuration"
```

---

### Task 7: Monitoring

**Estimated:** 0.5 day

- [ ] **Step 1: Configure Sentry**

Add to `.env`:

```env
SENTRY_LARAVEL_DSN=https://your-sentry-dsn
SENTRY_TRACES_SAMPLE_RATE=0.1
```

- [ ] **Step 2: Setup uptime monitoring**

Use external service (UptimeRobot, Pingdom, etc.) to monitor:
- `https://your-domain.com/health`
- `https://your-domain.com/version`

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "chore: document monitoring setup"
```

---

### Task 8: Go-Live Checklist

**Estimated:** 0.5 day

- [ ] **Step 1: Pre-launch verification**

```bash
# Run tests
php artisan test

# Check routes
php artisan route:list

# Clear all cache
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear

# Recache for production
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

- [ ] **Step 2: Verify features**

- [ ] Customer can browse products
- [ ] Customer can create order
- [ ] Outlet can process order
- [ ] Courier can deliver order
- [ ] Owner can view dashboard
- [ ] Settlement flow works
- [ ] Notifications work

- [ ] **Step 3: Monitor**

- [ ] Check Sentry for errors
- [ ] Check server logs
- [ ] Monitor response times
- [ ] Monitor queue jobs

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore: complete go-live checklist"
```

---

## Post-Launch

### Daily Tasks
- [ ] Check Sentry for new errors
- [ ] Monitor queue jobs
- [ ] Verify backups running

### Weekly Tasks
- [ ] Review performance metrics
- [ ] Check disk usage
- [ ] Update dependencies if needed

### Monthly Tasks
- [ ] Security updates
- [ ] Database optimization
- [ ] Review and rotate logs

---

## Rollback Plan

If critical issues found:

1. **Stop queue worker:**
   ```bash
   sudo systemctl stop dombi-queue
   ```

2. **Revert to previous version:**
   ```bash
   cd /var/www/dombi
   git checkout previous-tag
   composer install --optimize-autoloader --no-dev
   php artisan migrate --force
   php artisan config:cache
   ```

3. **Restart services:**
   ```bash
   sudo systemctl restart php8.3-fpm
   sudo systemctl restart nginx
   sudo systemctl start dombi-queue
   ```

---

## Summary

| Task | Description | Est. |
|------|-------------|------|
| 1. Server Setup | Install dependencies | 1d |
| 2. Application Deployment | Clone, install, configure | 0.5d |
| 3. Nginx Configuration | Web server setup | 0.5d |
| 4. SSL Certificate | HTTPS setup | 0.5d |
| 5. Scheduler & Queue | Background jobs | 0.5d |
| 6. Backup Configuration | Automated backups | 0.5d |
| 7. Monitoring | Sentry + uptime | 0.5d |
| 8. Go-Live Checklist | Final verification | 0.5d |
| **Total** | | **4.5d** |
