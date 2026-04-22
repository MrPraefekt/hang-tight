# Deployment Guide

This system is designed to run on a **Raspberry Pi** on your local network. The backend serves both the API and the built React frontend as static files.

## Architecture

```
Development Machine                  Raspberry Pi
┌────────────────┐    rsync         ┌────────────────────────┐
│ make build     │ ────────────►   │ /opt/hang-tight/       │
│ make deploy    │                  │   server.js            │
└────────────────┘                  │   public/ (React)      │
                                    │   data/  (SQLite DB)   │
                                    │                        │
                                    │ systemd: hangboard     │
                                    │ http://<pi-ip>:3001    │
                                    └────────────────────────┘
```

---

## Prerequisites

- Raspberry Pi (any model with WiFi or Ethernet)
- Raspberry Pi OS (Lite is fine)
- SSH access to the Pi
- Your dev machine on the same network

---

## Phase 1: One-Time Pi Setup

Configure `PI_HOST` and `PI_USER` in the Makefile (or pass as env vars):

```bash
make pi-setup PI_HOST=192.168.1.50 PI_USER=pi
```

This will:

1. Install Node.js 20 on the Pi
2. Create `/opt/hang-tight/` directory
3. Copy the `hangboard.service` systemd unit
4. Enable the service

### Manual Setup (if you prefer)

```bash
# On the Pi:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs
sudo mkdir -p /opt/hang-tight/data
sudo chown -R pi:pi /opt/hang-tight

# Copy systemd service
sudo cp deploy/hangboard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable hangboard
```

---

## Phase 2: Deploy

```bash
make deploy
```

This will:

1. Build the frontend (`npm run build` → `backend/public/`)
2. rsync the backend (excluding `node_modules`, `.env`, `*.db`) to the Pi
3. Run `npm install --production` on the Pi
4. Restart the `hangboard` systemd service

After deploy, open: `http://<pi-ip>:3001`

### Quick Deploy (skip npm install)

```bash
make deploy-quick
```

Use this for code-only changes when dependencies haven't changed.

---

## Phase 3: ESP32 Configuration

Update `firmware/platformio.ini` with the Pi's IP:

```ini
build_flags =
    -D WIFI_SSID="YourSSID"
    -D WIFI_PASSWORD="YourPassword"
    -D WS_SERVER="192.168.1.50"
    -D WS_PORT=3001
```

Build and upload:

```bash
cd firmware && pio run -t upload -e esp32
```

---

## Operations

### Service Management

```bash
make status           # systemctl status hangboard
make logs             # journalctl -u hangboard -f
```

Or SSH directly:

```bash
ssh pi@hang-tight.local
sudo systemctl restart hangboard
sudo journalctl -u hangboard -f --no-pager
```

### Pull Data from Pi

```bash
make pull-data        # copies hangboard.db to data/hangboard-pi.db
make pull-csv         # exports sessions, samples, calibration as CSV
```

### Database on Pi

```bash
ssh pi@hang-tight.local
sqlite3 /opt/hang-tight/data/hangboard.db "SELECT COUNT(*) FROM sessions;"
```

---

## Backup

The SQLite database is a single file. Back it up with:

```bash
make pull-data        # rsync from Pi to local
# or:
scp pi@hang-tight.local:/opt/hang-tight/data/hangboard.db ./backup-$(date +%Y%m%d).db
```

---

## Post-Deployment Checklist

- [ ] Frontend loads at `http://<pi-ip>:3001`
- [ ] WebSocket connection shows "Connected"
- [ ] Simulation mode works
- [ ] ESP32 connects and streams data
- [ ] Sessions can be started/stopped
- [ ] Calibration can be saved/loaded
- [ ] Historical data displays correctly

---

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues.

**Service won't start**: Check `make logs` for errors. Common causes:

- Missing `node_modules` — run `make deploy` (not `deploy-quick`)
- Port 3001 already in use
- Permissions on `/opt/hang-tight/data/`

**Can't reach Pi**: Verify network connectivity with `ping hang-tight.local`. Check that the Pi is on and connected to the same network.
