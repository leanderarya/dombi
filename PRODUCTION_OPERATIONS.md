# PRODUCTION OPERATIONS

**Last Updated:** 2026-06-05
**Application:** Dombi Commerce Platform

---

## TABLE OF CONTENTS

1. [Backup Procedures](#1-backup-procedures)
2. [Restore Procedures](#2-restore-procedures)
3. [Monitoring](#3-monitoring)
4. [Error Tracking](#4-error-tracking)
5. [Scheduler Monitoring](#5-scheduler-monitoring)
6. [Health Checks](#6-health-checks)
7. [Incident Response](#7-incident-response)
8. [Scheduled Jobs Reference](#8-scheduled-jobs-reference)
9. [Environment Variables](#9-environment-variables)

---

## 1. BACKUP PROCEDURES

### Automated Backups

Dombi uses `spatie/laravel-backup` for automated database backups.

**Schedule:**
- `02:00` — `backup:clean` (prune old backups)
- `02:30` — `backup:run` (create new backup)
- `03:00` — `backup:monitor` (verify backup health)

**Configuration:** `config/backup.php`

**Storage:** Configurable via `BACKUP_DISK` environment variable (default: `local`)

### Manual Backup

```bash
# Create an immediate backup
php artisan backup:run

# Create database-only backup (faster)
php artisan backup:run --only-db

# List available backups
php artisan backup:list
```

### Backup Retention

Default retention policy (configured in `config/backup.php`):
- All backups for the last day
- Daily backups for 7 days
- Weekly backups for 4 weeks
- Monthly backups for 6 months
- Yearly backups for 1 year
- Maximum storage: 5 GB

### Monitoring Backup Health

```bash
# Check backup health
php artisan backup:monitor

# This runs automatically at 03:00 daily
# Alerts are sent via configured notification channels
```

---

## 2. RESTORE PROCEDURES

**Full restore documentation:** See `RESTORE_RUNBOOK.md`

### Quick Reference

```bash
# 1. Enable maintenance mode
php artisan down --secret="recovery-token"

# 2. Restore backup
php artisan backup:restore --backup-name=dombi

# 3. Run migrations
php artisan migrate --force

# 4. Clear caches
php artisan cache:clear && php artisan config:clear

# 5. Restart services
php artisan queue:restart

# 6. Disable maintenance mode
php artisan up
```

---

## 3. MONITORING

### Health Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/health` | None | Load balancer health check |
| `GET /api/version` | None | PWA version detection |
| `GET /api/status` | Owner | Detailed system status |
| `GET /up` | None | Laravel built-in health check |

### Health Check Components

The `/api/health` endpoint checks:
- Database connectivity
- Cache read/write
- Scheduler liveness
- Storage writability

### Recommended External Monitoring

Set up external monitoring for:
- `GET /api/health` — every 1 minute, alert on non-200
- SSL certificate expiry — alert 14 days before expiry
- Domain expiry — alert 30 days before expiry

**Recommended services:** UptimeRobot, Pingdom, or Healthchecks.io

---

## 4. ERROR TRACKING

### Sentry Integration

Dombi integrates with Sentry for production error tracking.

**Configuration:** Set `SENTRY_DSN` in your `.env` file.

**What's captured:**
- Unhandled exceptions
- HTTP 500 errors
- Database errors
- Queue job failures
- Frontend JavaScript errors (via Inertia)

**What's NOT captured (by design):**
- HTTP 404 errors
- Validation errors (422)
- Authentication errors (401/403)
- Rate limit errors (429)

### Setting Up Sentry

1. Create a Sentry account at https://sentry.io
2. Create a new Laravel project in Sentry
3. Copy the DSN to your `.env`:

```env
SENTRY_DSN=https://your-key@sentry.io/your-project-id
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_ENVIRONMENT=production
```

4. Verify integration:

```bash
php artisan tinker --execute="app('sentry')->captureMessage('Test from Dombi');"
```

---

## 5. SCHEDULER MONITORING

### Scheduler Heartbeat

The scheduler writes a heartbeat timestamp every minute. The health check verifies it's recent.

**Implementation:** `App\Support\SchedulerHeartbeat`

**Health check behavior:**
- Healthy: Last heartbeat within 5 minutes
- Degraded: Last heartbeat 5-15 minutes ago
- Unhealthy: No heartbeat or >15 minutes ago

### Manual Check

```bash
# Check scheduler health
php artisan tinker --execute="echo \App\Support\SchedulerHeartbeat::isHealthy() ? 'Healthy' : 'UNHEALTHY';"
```

### Scheduler Liveness via External Monitor

Configure an external cron monitor (e.g., Healthchecks.io) that alerts if `schedule:run` misses its expected execution window.

```bash
# Add to crontab (replace cron url with your healthchecks.io ping URL)
* * * * * php artisan schedule:run && curl -fsS -m 10 https://hc-ping.com/your-uuid > /dev/null
```

---

## 6. HEALTH CHECKS

### Automated Recovery Commands

```bash
# Resolve stuck orders (stale ready_for_pickup, old failed_delivery, stalled delivering)
php artisan orders:resolve-stale --dry-run   # Preview
php artisan orders:resolve-stale              # Execute

# Reconcile inventory mismatches
php artisan inventory:reconcile --dry-run     # Preview
php artisan inventory:reconcile --fix         # Apply fixes

# Rebuild missing notifications
php artisan notifications:rebuild --dry-run   # Preview
php artisan notifications:rebuild             # Create missing

# Expire pending orders (runs every minute automatically)
php artisan orders:expire-pending

# Auto-offline inactive couriers (runs every 4 hours automatically)
php artisan couriers:auto-offline
```

---

## 7. INCIDENT RESPONSE

### Severity Levels

| Level | Definition | Response Time |
|-------|-----------|---------------|
| P0 | Data loss, complete outage | Immediate |
| P1 | Major feature broken, security breach | 1 hour |
| P2 | Degraded performance, partial feature failure | 4 hours |
| P3 | Minor issue, cosmetic problem | Next business day |

### Incident Playbooks

#### P0: Database Outage

1. Check database server status
2. If database is down, restore from latest backup (see `RESTORE_RUNBOOK.md`)
3. If database is corrupted, restore from backup + replay binlogs
4. Verify data integrity with `inventory:reconcile --dry-run`
5. Notify customers of any data loss

#### P1: Orders Stuck

1. Run `php artisan orders:resolve-stale --dry-run` to assess
2. Run `php artisan orders:resolve-stale` to fix
3. Run `php artisan inventory:reconcile --dry-run` to check inventory
4. If inventory is off, run `php artisan inventory:reconcile --fix`
5. Check Sentry for root cause

#### P1: Scheduler Down

1. Check if cron is running: `crontab -l`
2. Check scheduler heartbeat: `php artisan tinker --execute="echo \App\Support\SchedulerHeartbeat::isHealthy() ? 'OK' : 'DOWN';"`
3. Run `php artisan schedule:run` manually to catch up
4. Verify cron is properly configured in the server's crontab

#### P2: Notification Failures

1. Check `php artisan notifications:rebuild --dry-run` for missing notifications
2. Run `php artisan notifications:rebuild` to regenerate
3. Check notification table growth: `php artisan tinker --execute="echo \App\Models\Notification::count();"`

---

## 8. SCHEDULED JOBS REFERENCE

| Command | Schedule | Purpose | Log |
|---------|----------|---------|-----|
| `orders:expire-pending` | Every minute | Expire orders past confirmation deadline | `storage/logs/expire-pending.log` |
| `couriers:auto-offline` | Every 4 hours | Offline inactive couriers | `storage/logs/auto-offline.log` |
| `orders:resolve-stale` | Daily at 03:30 | Resolve stuck orders | `storage/logs/resolve-stale.log` |
| `backup:clean` | Daily at 02:00 | Prune old backups | — |
| `backup:run` | Daily at 02:30 | Create database backup | — |
| `backup:monitor` | Daily at 03:00 | Verify backup health | — |
| Scheduler heartbeat | Every minute | Record scheduler liveness | — |

---

## 9. ENVIRONMENT VARIABLES

### Required for Production

```env
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:...  # Generate with: php artisan key:generate
APP_URL=https://your-domain.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=dombi
DB_USERNAME=...
DB_PASSWORD=...  # NEVER commit this to version control

SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=database

# Error Tracking (required)
SENTRY_DSN=https://...@sentry.io/...
SENTRY_TRACES_SAMPLE_RATE=0.1

# Backup Storage (optional, default is local)
BACKUP_DISK=local  # Change to 's3' for cloud backups

# If using S3:
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=...
AWS_BUCKET=...
```

### Security Notes

- **Never commit `.env` to version control**
- **Rotate credentials** if they are ever exposed
- **Use environment-specific secrets** for different deployments
- **Enable 2FA** on all admin accounts

---

*This document should be reviewed and updated whenever infrastructure or operations change.*
