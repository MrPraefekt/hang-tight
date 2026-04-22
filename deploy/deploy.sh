#!/bin/bash
# =============================================================================
# Hang-Tight — Deploy Script (runs on the Pi)
# Pulls latest code from GitHub, builds, and restarts the service.
#
# Usage:
#   ./deploy.sh          — full deploy (pull + build + npm install + restart)
#   ./deploy.sh --quick  — quick deploy (pull + build + restart, skip npm install)
# =============================================================================
set -e

APP_DIR="/opt/hang-tight"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"

echo "==> Pulling latest from origin/$BRANCH..."
git fetch origin
git reset --hard "origin/$BRANCH"

echo "==> Building frontend..."
cd frontend && npm run build
cd "$APP_DIR"

echo "==> Copying frontend build to backend/public..."
rm -rf backend/public
cp -r frontend/dist backend/public

if [ "$1" != "--quick" ]; then
  echo "==> Installing backend dependencies..."
  cd backend && npm install --production
  cd "$APP_DIR"
fi

echo "==> Restarting service..."
sudo systemctl restart hangboard

echo ""
echo "✓ Deployed: $(git log --oneline -1)"
echo "  Open: http://$(hostname -I | awk '{print $1}'):3001"
