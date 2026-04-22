#!/bin/bash
# =============================================================================
# Hang-Tight — Pi Setup Script
# Run this ONCE on a fresh Raspberry Pi via SSH.
#
# Usage:
#   ssh hang-tight@<pi-ip> "bash /opt/hang-tight/deploy/setup-pi.sh"
#
# Safe to re-run — idempotent. Will not overwrite existing database.
# =============================================================================
set -euo pipefail

REPO_URL="https://github.com/mrpraefekt/hang-tight.git"
APP_DIR="/opt/hang-tight"
PI_USER="$(whoami)"
STEP=""

# --- Error trap: print which step failed ---
trap 'echo ""; echo "✗ FAILED at step: $STEP"; echo "  Fix the issue above and re-run this script."; exit 1' ERR

# =============================================================================
# Step 1: System packages
# =============================================================================
STEP="Install system packages (git, avahi)"

if ! command -v git &>/dev/null; then
  echo "[1/6] Installing git..."
  sudo apt-get update -qq
  sudo apt-get install -y git
else
  echo "[✓] git already installed"
fi

if ! command -v avahi-daemon &>/dev/null; then
  echo "[1/6] Installing avahi-daemon..."
  sudo apt-get install -y avahi-daemon
  sudo systemctl enable avahi-daemon
  sudo systemctl start avahi-daemon
else
  echo "[✓] avahi-daemon already installed"
fi

# =============================================================================
# Step 2: Node.js
# =============================================================================
STEP="Install Node.js"

if command -v node &>/dev/null; then
  echo "[✓] Node.js already installed: $(node --version)"
else
  echo "[2/6] Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
  sudo apt-get install -y nodejs
  echo "[✓] Node.js installed: $(node --version)"
fi

# =============================================================================
# Step 3: Fix npm registry (BEFORE any npm install)
# =============================================================================
STEP="Fix npm registry"

echo "[3/6] Ensuring npm registry is set to npmjs.org..."
echo "registry=https://registry.npmjs.org/" > "$HOME/.npmrc"
sudo sh -c 'echo "registry=https://registry.npmjs.org/" > /etc/npmrc' 2>/dev/null || true

# =============================================================================
# Step 4: Clone or update repo
# =============================================================================
STEP="Clone repository"

if [ -d "$APP_DIR/.git" ]; then
  echo "[✓] Repo already cloned at $APP_DIR"
  cd "$APP_DIR"
  git fetch origin
  git reset --hard origin/main
else
  echo "[4/6] Cloning repository..."
  sudo mkdir -p "$APP_DIR"
  sudo chown -R "$PI_USER:$PI_USER" "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
fi

# Ensure ownership is correct (handles re-runs after sudo operations)
sudo chown -R "$PI_USER:$PI_USER" "$APP_DIR"

# Remove any stale .npmrc files inside the repo
rm -f "$APP_DIR/.npmrc" "$APP_DIR/backend/.npmrc" "$APP_DIR/frontend/.npmrc"

# =============================================================================
# Step 5: Install dependencies + build
# =============================================================================
STEP="Install frontend dependencies"

echo "[5/6] Installing dependencies and building..."

# Frontend: clean install (delete lockfile to purge any baked proxy URLs)
rm -rf "$APP_DIR/frontend/node_modules" "$APP_DIR/frontend/package-lock.json"
cd "$APP_DIR/frontend" && npm install

STEP="Build frontend"

npm run build

STEP="Copy frontend build to backend"

rm -rf "$APP_DIR/backend/public"
cp -r "$APP_DIR/frontend/dist" "$APP_DIR/backend/public"

STEP="Install backend dependencies"

# Backend: clean install
rm -rf "$APP_DIR/backend/node_modules" "$APP_DIR/backend/package-lock.json"
cd "$APP_DIR/backend" && npm install --production

# =============================================================================
# Step 5b: Seed database (only if it doesn't exist)
# =============================================================================
STEP="Seed database"

if [ ! -f "$APP_DIR/backend/data/hangboard.db" ]; then
  echo "      Seeding database..."
  mkdir -p "$APP_DIR/backend/data"
  cd "$APP_DIR/backend" && node scripts/init-db.js --seed
else
  echo "[✓] Database already exists, skipping seed"
fi

# =============================================================================
# Step 6: Systemd services
# =============================================================================
STEP="Install systemd services"

echo "[6/6] Setting up systemd services..."

# Make deploy script executable
chmod +x "$APP_DIR/deploy/deploy.sh"

# --- Main app service (template the user) ---
sed "s/User=DEPLOY_USER/User=$PI_USER/" "$APP_DIR/deploy/hangboard.service" \
  | sudo tee /etc/systemd/system/hangboard.service > /dev/null

# --- Auto-deploy watcher ---
cat > "$APP_DIR/deploy/watch.sh" << 'WATCHEOF'
#!/bin/bash
# Polls GitHub every 15s — runs deploy.sh when new commits are detected.
APP_DIR="/opt/hang-tight"
LOCK="/tmp/hang-tight-deploy.lock"
LOG="/tmp/hang-tight-deploy.log"

while true; do
  cd "$APP_DIR"
  git fetch origin --quiet 2>/dev/null

  LOCAL=$(git rev-parse HEAD 2>/dev/null)
  REMOTE=$(git rev-parse origin/main 2>/dev/null)

  if [ -n "$LOCAL" ] && [ -n "$REMOTE" ] && [ "$LOCAL" != "$REMOTE" ]; then
    # Lock to prevent overlapping deploys
    if [ -f "$LOCK" ]; then
      echo "$(date): Deploy already in progress, skipping." >> "$LOG"
    else
      touch "$LOCK"
      echo "$(date): New commit detected, deploying..." >> "$LOG"
      "$APP_DIR/deploy/deploy.sh" >> "$LOG" 2>&1 || echo "$(date): Deploy FAILED" >> "$LOG"
      echo "$(date): Deploy complete." >> "$LOG"
      rm -f "$LOCK"
    fi
  fi

  sleep 15
done
WATCHEOF
chmod +x "$APP_DIR/deploy/watch.sh"

sudo tee /etc/systemd/system/hangboard-watcher.service > /dev/null << EOF
[Unit]
Description=Hang-Tight Auto-Deploy Watcher
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$PI_USER
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/deploy/watch.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Reload and start everything
sudo systemctl daemon-reload
sudo systemctl enable hangboard hangboard-watcher
sudo systemctl restart hangboard
sudo systemctl restart hangboard-watcher

# =============================================================================
# Done
# =============================================================================
echo ""
echo "============================================"
echo "  ✓ Setup complete!"
echo ""
echo "  App:      http://$(hostname).local:3001"
echo "            http://$(hostname -I | awk '{print $1}'):3001"
echo ""
echo "  Auto-deploy: ON (polls GitHub every 15s)"
echo "  Auto-reload: ON (browser refreshes on new build)"
echo ""
echo "  Workflow:  edit → git push → wait 15s → browser reloads"
echo ""
echo "  Service:  sudo systemctl status hangboard"
echo "  Watcher:  sudo systemctl status hangboard-watcher"
echo "  Logs:     sudo journalctl -u hangboard -f"
echo "  Deploy:   cat /tmp/hang-tight-deploy.log"
echo "============================================"
