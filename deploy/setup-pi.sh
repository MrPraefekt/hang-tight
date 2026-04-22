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

# --- Fix npm registry (in case corporate proxy is configured) ---
echo "registry=https://registry.npmjs.org/" > ~/.npmrc
sudo sh -c 'echo "registry=https://registry.npmjs.org/" > /etc/npmrc' 2>/dev/null || true
rm -f "$APP_DIR/.npmrc" "$APP_DIR/backend/.npmrc" "$APP_DIR/frontend/.npmrc"

# --- Install avahi for .local hostname resolution ---
if ! command -v avahi-daemon &>/dev/null; then
  sudo apt-get install -y avahi-daemon
  sudo systemctl enable avahi-daemon
  sudo systemctl start avahi-daemon
fi

# --- Install dependencies ---
echo "[4/5] Installing dependencies..."
cd "$APP_DIR/frontend" && rm -rf node_modules package-lock.json && npm install
cd "$APP_DIR/backend" && rm -rf node_modules package-lock.json && npm install --production

# --- Build frontend ---
echo "      Building frontend..."
cd "$APP_DIR/frontend" && npm run build
rm -rf "$APP_DIR/backend/public"
cp -r "$APP_DIR/frontend/dist" "$APP_DIR/backend/public"

# --- Seed database ---
if [ ! -f "$APP_DIR/backend/data/hangboard.db" ]; then
  echo "      Seeding database..."
  cd "$APP_DIR/backend" && node scripts/init-db.js --seed
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

# --- Auto-deploy watcher (polls GitHub every 15 seconds) ---
cat > "$APP_DIR/deploy/watch.sh" << 'WATCHEOF'
#!/bin/bash
APP_DIR="/opt/hang-tight"
BRANCH="main"
LOG="/tmp/hang-tight-deploy.log"
while true; do
  cd "$APP_DIR"
  git fetch origin --quiet 2>/dev/null
  LOCAL=$(git rev-parse HEAD 2>/dev/null)
  REMOTE=$(git rev-parse origin/$BRANCH 2>/dev/null)
  if [ -n "$LOCAL" ] && [ -n "$REMOTE" ] && [ "$LOCAL" != "$REMOTE" ]; then
    echo "$(date): New commit detected, deploying..." >> "$LOG"
    ./deploy/deploy.sh --quick >> "$LOG" 2>&1
    echo "$(date): Deploy complete." >> "$LOG"
  fi
  sleep 15
done
WATCHEOF
chmod +x "$APP_DIR/deploy/watch.sh"

# Install as systemd service
sudo tee /etc/systemd/system/hangboard-watcher.service > /dev/null << EOF
[Unit]
Description=Hang-Tight Auto-Deploy Watcher
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/deploy/watch.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable hangboard-watcher
sudo systemctl restart hangboard-watcher
echo "[✓] Auto-deploy watcher installed (polls every 15s)"

echo ""
echo "============================================"
echo "  ✓ Setup complete!"
echo ""
echo "  App:      http://$(hostname).local:3001"
echo "            http://$(hostname -I | awk '{print $1}'):3001"
echo ""
echo "  Auto-deploy: ON (polls every 15s)"
echo "  Auto-reload: ON (browser refreshes on new build)"
echo ""
echo "  Just 'git push' and refresh your browser!"
echo ""
echo "  Service:  sudo systemctl status hangboard"
echo "  Watcher:  sudo systemctl status hangboard-watcher"
echo "  Logs:     sudo journalctl -u hangboard -f"
echo "  Deploy:   cat /tmp/hang-tight-deploy.log"
echo "============================================"
