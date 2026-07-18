#!/bin/bash
set -e

DEPLOY_DIR="${1:-.}"
APP_ENV="${2:-production}"

cd "$DEPLOY_DIR"

echo "=== Deploying Dombi ($APP_ENV) ==="

# Maintenance mode
php artisan down --render='errors::503' 2>/dev/null || true

# Install dependencies
composer install --optimize-autoloader --no-dev --no-interaction

# Database migrations
php artisan migrate --force

# Cache optimization
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Storage link
php artisan storage:link --force 2>/dev/null || true

# Restart queue workers
php artisan queue:restart 2>/dev/null || true

# Fix permissions
chmod -R 755 storage/ bootstrap/cache/

# Disable maintenance mode
php artisan up

echo "=== Deploy complete ==="
