#!/bin/bash
# =============================================================================
# Hang-Tight — Pi Setup Script
# Run this ONCE on a fresh Raspberry Pi via SSH.
# Usage:  bash setup-pi.sh
# =============================================================================
set -e

REPO_URL="https://github.com/mrpraefekt/hang-tight.git"
APP_DIR="/opt/hang-tight"
PI_USER="$(whoami)"

echo "============================================"
echo "  Hang-Tight — Raspberry Pi Setup"
echo "============================================"
echo ""

# --- Node.js ---
if command -v node &>/dev/null; then
  echo "[✓] Node.js already installed: $(node --version)"
else
  echo "[1/5] Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
  sudo apt-get install -y nodejs
  echo "[✓] Node.js installed: $(node --version)"
fi

# --- Git ---
if command -v git &>/dev/null; then
  echo "[✓] Git already installed"
else
  echo "[2/5] Installing Git..."
  sudo apt-get install -y git
fi

# --- Clone repo ---
if [ -d "$APP_DIR/.git" ]; then
  echo "[✓] Repo already cloned at $APP_DIR"
  cd "$APP_DIR" && git pull
else
  echo "[3/5] Cloning repository..."
  sudo mkdir -p "$APP_DIR"
  sudo chown -R "$PI_USER:$PI_USER" "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

# --- Install dependencies ---
echo "[4/5] Installing dependencies..."
cd frontend && npm install && cd ..
cd backend && npm install --production && cd ..

# --- Build frontend ---
echo "      Building frontend..."
cd frontend && npm run build && cd ..
rm -rf backend/public
cp -r frontend/dist backend/public

# --- Seed database ---
if [ ! -f backend/data/hangboard.db ]; then
  echo "      Seeding database..."
  cd backend && node scripts/init-db.js --seed && cd ..
else
  echo "[✓] Database already exists, skipping seed"
fi

# --- Make deploy script executable ---
chmod +x deploy/deploy.sh

# --- Systemd service ---
echo "[5/5] Setting up systemd service..."
sudo cp deploy/hangboard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable hangboard
sudo systemctl restart hangboard

echo ""
echo "============================================"
echo "  ✓ Setup complete!"
echo ""
echo "  Service:  sudo systemctl status hangboard"
echo "  Logs:     sudo journalctl -u hangboard -f"
echo "  Open:     http://$(hostname -I | awk '{print $1}'):3001"
echo ""
echo "  To deploy updates later, run:"
echo "    cd $APP_DIR && ./deploy/deploy.sh"
echo "============================================"
