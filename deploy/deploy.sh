#!/bin/bash
# =============================================================================
# Hang-Tight — Deploy Script (runs on the Pi)
# Pulls latest code, installs deps, builds frontend, restarts service.
#
# Usage:  ./deploy.sh
# =============================================================================
set -euo pipefail

APP_DIR="/opt/hang-tight"

cd "$APP_DIR"

echo "==> Pulling latest from origin/main..."
git fetch origin
git reset --hard origin/main

# Ensure npm uses public registry (not corporate proxy)
echo "registry=https://registry.npmjs.org/" > "$HOME/.npmrc"

echo "==> Installing frontend dependencies..."
rm -f "$APP_DIR/frontend/package-lock.json"
cd "$APP_DIR/frontend" && npm install

echo "==> Building frontend..."
npm run build

echo "==> Copying frontend build to backend/public..."
rm -rf "$APP_DIR/backend/public"
cp -r "$APP_DIR/frontend/dist" "$APP_DIR/backend/public"

echo "==> Installing backend dependencies..."
rm -f "$APP_DIR/backend/package-lock.json"
cd "$APP_DIR/backend" && npm install --production

echo "==> Restarting service..."
sudo systemctl restart hangboard

echo ""
echo "✓ Deployed: $(git -C "$APP_DIR" log --oneline -1)"
echo "  Open: http://$(hostname -I | awk '{print $1}'):3001"
