# RESTORE RUNBOOK

**Last Updated:** 2026-06-05
**Application:** Dombi Commerce Platform

---

## OVERVIEW

This runbook provides step-by-step procedures for restoring Dombi after a failure. Read the entire section before executing any steps.

---

## 1. DATABASE RESTORE

### Prerequisites

- Access to backup storage (local or S3)
- SSH access to application server
- MySQL client installed

### Steps

#### 1.1 Stop the Application

```bash
# Enable maintenance mode
php artisan down --render="errors::503" --secret="your-recovery-token"

# Stop queue workers (if running)
php artisan queue:restart

# Stop the scheduler (comment out cron temporarily)
# crontab -e  ->  comment: * * * * * php artisan schedule:run
```

#### 1.2 Identify the Backup

```bash
# List available backups
php artisan backup:list

# For local backups:
ls -la storage/app/dombi-backups/

# For S3 backups:
aws s3 ls s3://your-backup-bucket/dombi-backups/
```

#### 1.3 Restore the Database

**Option A: Full restore from spatie/laravel-backup**

```bash
# Restore the latest backup
php artisan backup:restore --backup-name=dombi

# Or restore a specific backup
php artisan backup:restore --backup-name=dombi --date="2026-06-05 02:30:00"
```

**Option B: Manual restore from SQL dump**

```bash
# Extract the backup
cd storage/app/dombi-backups/
unzip dombi-backup-2026-06-05-02-30-00.zip

# Drop and recreate the database (CAUTION: destroys current data)
mysql -u root -p -e "DROP DATABASE dombi; CREATE DATABASE dombi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Restore from dump
mysql -u root -p dombi < dombi.sql

# If compressed:
gunzip < dombi.sql.gz | mysql -u root -p dombi
```

#### 1.4 Run Pending Migrations

```bash
php artisan migrate --force
```

#### 1.5 Verify Data Integrity

```bash
# Check migration status
php artisan migrate:status

# Verify order counts
php artisan tinker --execute="echo 'Orders: ' . \App\Models\Order::count() . PHP_EOL;"

# Verify inventory exists
php artisan tinker --execute="echo 'Inventory: ' . \App\Models\OutletInventory::count() . PHP_EOL;"

# Check for stuck orders
php artisan tinker --execute="echo 'Stuck pending: ' . \App\Models\Order::where('status', 'pending_confirmation')->where('confirmation_expires_at', '<', now())->count() . PHP_EOL;"
```

#### 1.6 Restart Services

```bash
# Clear caches
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear
php artisan opcache:clear

# Restart queue workers
php artisan queue:restart

# Re-enable scheduler (uncomment cron entry)
# crontab -e  ->  uncomment: * * * * * php artisan schedule:run

# Disable maintenance mode
php artisan up
```

---

## 2. STORAGE RESTORE

### 2.1 Local File Restore

```bash
# If files were backed up separately
tar -xzf dombi-storage-backup-2026-06-05.tar.gz -C storage/app/

# Verify file permissions
chmod -R 775 storage/
chown -R www-data:www-data storage/
```

### 2.2 S3 File Restore (if using S3)

```bash
# Files are versioned in S3 - restore from version history
aws s3 cp s3://your-bucket/path/to/file s3://your-bucket/path/to/file --version-id VERSION_ID

# Or restore entire prefix
aws s3 sync s3://your-backup-bucket/storage-backup/ s3://your-bucket/storage/
```

### 2.3 Regenerate Storage Symlink

```bash
php artisan storage:link
```

---

## 3. POST-RESTORE VERIFICATION

### 3.1 Health Checks

```bash
# Check application health
curl -s https://your-domain.com/api/health | jq .

# Expected: {"status":"healthy","checks":{"database":true,"cache":true,"scheduler":true,"storage":true}}
```

### 3.2 Data Verification

```bash
# Run inventory reconciliation (dry-run first)
php artisan inventory:reconcile --dry-run

# Check for stale orders
php artisan orders:resolve-stale --dry-run

# Verify notification system
php artisan tinker --execute="echo 'Recent notifications: ' . \App\Models\Notification::where('created_at', '>', now()->subDay())->count() . PHP_EOL;"
```

### 3.3 Functional Verification

1. Create a test order via the customer interface
2. Verify outlet receives the order
3. Verify courier assignment works
4. Verify tracking page loads
5. Verify notification bell shows notifications

---

## 4. ROLLBACK PROCEDURE

### If Restore Fails

```bash
# If you have a pre-restore snapshot, restore it
# Otherwise, you may need to replay from binlogs (MySQL)

# Check if the database is in a usable state
php artisan migrate:status
php artisan tinker --execute="DB::connection()->getPdo(); echo 'OK';"
```

### If Migration Fails During Restore

```bash
# Check which migration failed
php artisan migrate:status

# Manually fix the migration issue, then continue
php artisan migrate --force
```

---

## 5. EMERGENCY CONTACTS

| Role | Contact | When to Call |
|------|---------|--------------|
| Database Admin | [TBD] | Database corruption, restore failures |
| DevOps | [TBD] | Server issues, deployment failures |
| Lead Developer | [TBD] | Application errors, data integrity issues |

---

## 6. PREVENTIVE MEASURES

1. **Test restores monthly** — A backup that has never been tested is not a backup.
2. **Monitor backup health** — `backup:monitor` runs daily and alerts on failures.
3. **Keep off-site copies** — Configure S3 backup in addition to local.
4. **Document changes** — Update this runbook when infrastructure changes.

---

*This runbook should be tested in a staging environment before relying on it in production.*
