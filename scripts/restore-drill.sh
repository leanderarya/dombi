#!/usr/bin/env bash
set -euo pipefail

# Dombi Restore Drill Script
# Usage: BACKUP_ARCHIVE_PASSWORD=xxx AWS_* set, then ./scripts/restore-drill.sh s3://bucket/path/backup.zip
# This script is for OFFLINE isolated restore verification — NEVER restore directly to production DB.

BACKUP_PATH=${1:-""}
RESTORE_DIR=${RESTORE_DIR:-./restore-test}
DB_NAME=${DB_NAME:-dombi_restore_test}
DB_USER=${DB_USER:-root}
DB_PASS=${DB_PASS:-${DB_PASSWORD:-140504}}
DB_HOST=${DB_HOST:-127.0.0.1}

if [ -z "$BACKUP_PATH" ]; then
  echo "Usage: $0 <s3://bucket/backup.zip OR local/path.zip>"
  echo "Env: BACKUP_ARCHIVE_PASSWORD required for encrypted backups"
  echo "Optional: DB_NAME, DB_USER, DB_PASS, DB_HOST, RESTORE_DIR"
  exit 1
fi

if [ -z "${BACKUP_ARCHIVE_PASSWORD:-}" ]; then
  echo "ERROR: BACKUP_ARCHIVE_PASSWORD env var required"
  exit 1
fi

echo "=== Dombi Restore Drill ==="
echo "Backup: $BACKUP_PATH"
echo "Restore dir: $RESTORE_DIR"
echo "DB: $DB_NAME @ $DB_HOST"
echo ""

# Step 1: Download if S3
if [[ "$BACKUP_PATH" == s3://* ]]; then
  echo "[1/7] Downloading from S3..."
  if ! command -v aws &>/dev/null; then
    echo "aws cli not found, install aws-cli"
    exit 1
  fi
  LOCAL_ZIP="./$(basename "$BACKUP_PATH")"
  aws s3 cp "$BACKUP_PATH" "$LOCAL_ZIP"
  BACKUP_PATH="$LOCAL_ZIP"
else
  echo "[1/7] Using local backup: $BACKUP_PATH"
fi

if [ ! -f "$BACKUP_PATH" ]; then
  echo "Backup file not found: $BACKUP_PATH"
  exit 1
fi

# Step 2: Clean restore dir
echo "[2/7] Cleaning restore dir..."
rm -rf "$RESTORE_DIR"
mkdir -p "$RESTORE_DIR"

# Step 3: Unzip with password
echo "[3/7] Unzipping with password (AES-256)..."
unzip -P "$BACKUP_ARCHIVE_PASSWORD" "$BACKUP_PATH" -d "$RESTORE_DIR"
echo "Unzipped files:"
ls -lh "$RESTORE_DIR" | head -20

# Step 4: Find SQL dump
SQL_FILE=$(find "$RESTORE_DIR" -name "*.sql" | head -1)
if [ -z "$SQL_FILE" ]; then
  echo "No SQL dump found in backup"
  find "$RESTORE_DIR" -type f | head -20
  exit 1
fi
echo "[4/7] Found SQL dump: $SQL_FILE"

# Step 5: Create restore DB
echo "[5/7] Creating restore DB $DB_NAME..."
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" -e "DROP DATABASE IF EXISTS \`$DB_NAME\`; CREATE DATABASE \`$DB_NAME\`;" 2>&1 | grep -v "Warning"

# Step 6: Restore
echo "[6/7] Restoring DB..."
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$SQL_FILE" 2>&1 | grep -v "Warning"

# Step 7: Verify
echo "[7/7] Verifying restore..."
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASS" -e "
  USE \`$DB_NAME\`;
  SELECT 'orders' as tbl, COUNT(*) as cnt FROM orders
  UNION ALL SELECT 'users', COUNT(*) FROM users
  UNION ALL SELECT 'products', COUNT(*) FROM products
  UNION ALL SELECT 'outlets', COUNT(*) FROM outlets;
" 2>&1 | grep -v "Warning"

UPLOADS=$(find "$RESTORE_DIR" -type f | wc -l)
echo "Total files in backup: $UPLOADS"
if [ -d "$RESTORE_DIR/storage" ]; then
  echo "Uploads in storage/app:"
  find "$RESTORE_DIR/storage" -type f | head -10
fi

echo ""
echo "=== DRILL SUCCESS ==="
echo "Evidence to record:"
echo "- Backup file: $BACKUP_PATH"
echo "- Size: $(du -h "$BACKUP_PATH" | cut -f1)"
echo "- DB: $DB_NAME"
echo "- Restore dir: $RESTORE_DIR"
echo "- Verify above counts look reasonable"
echo ""
echo "Next: record in docs/BACKUP-RESTORE-EVIDENCE.md and PRODUCTION_CHECKLIST.md"
echo "Clean up with: rm -rf $RESTORE_DIR $DB_NAME (DROP DATABASE)"
