#!/bin/bash
set -e

DEPLOY_DIR="${1:-.}"

cd "$DEPLOY_DIR"

echo "=== Deploying Dombi ==="

# Maintenance mode
php artisan down 2>/dev/null || true

# Install dependencies
composer install --optimize-autoloader --no-dev --no-interaction

# Database migrations
php artisan migrate --force

# Cache optimization
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Storage link
ln -sf storage/app/public public/storage

# Fix permissions
chmod -R 755 storage/ bootstrap/cache/

# Disable maintenance mode
php artisan up

echo "=== Deploy complete ==="
