# Deployment Guide

The Pi pulls code from **GitHub** — no direct network connection between your dev machine and the Pi is needed. You push to git, the Pi pulls and rebuilds.

## Architecture

```
Dev Machine          GitHub              Raspberry Pi
┌──────────┐        ┌────────┐          ┌──────────────────────┐
│ git push │──────►│  repo  │◄────────│ git pull             │
└──────────┘        └────────┘          │ npm run build        │
                                        │ systemctl restart    │
                                        │                      │
                                        │ /opt/hang-tight/     │
                                        │   backend/server.js  │
                                        │   backend/public/    │
                                        │   backend/data/*.db  │
                                        │                      │
                                        │ http://<pi-ip>:3001  │
                                        └──────────────────────┘
```

---

## Initial Pi Setup (one time)

### What you need

- Raspberry Pi with Raspberry Pi OS (Lite is fine)
- Keyboard + monitor **or** SSH access (e.g. from a Windows laptop on the same network)
- The Pi needs internet access (to clone from GitHub and install Node.js)

### Steps

1. **Connect to the Pi** — plug in keyboard/monitor, or SSH from a Windows machine:

   ```
   ssh pi@<pi-ip-address>
   ```

   (Default password is `raspberry` — change it with `passwd`)

2. **Run the setup script**:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/mrpraefekt/hang-tight/main/deploy/setup-pi.sh | bash
   ```

   This will:
   - Install Node.js 20 and Git
   - Clone the repo to `/opt/hang-tight`
   - Install dependencies
   - Build the frontend
   - Seed the database with sample data
   - Set up and start the systemd service

3. **Verify it's running**:

   ```bash
   sudo systemctl status hangboard
   curl http://localhost:3001/health
   ```

4. **Open in browser** from any device on the same network:
   ```
   http://<pi-ip>:3001
   ```

---

## Deploying Updates

### Option A: SSH to Pi and run deploy script

From any machine that can reach the Pi:

```bash
ssh pi@<pi-ip>
cd /opt/hang-tight
./deploy/deploy.sh           # full deploy (pull + build + npm install + restart)
./deploy/deploy.sh --quick   # skip npm install (code-only changes)
```

### Option B: From your dev machine (if SSH works)

```bash
make deploy                  # git push + SSH trigger deploy on Pi
make deploy-quick            # same, but skip npm install on Pi
```

### Option C: Auto-deploy via cron (Pi polls GitHub)

Add a cron job on the Pi that checks for new commits every 2 minutes:

```bash
crontab -e
```

Add this line:

```
*/2 * * * * cd /opt/hang-tight && git fetch origin --quiet && [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ] && ./deploy/deploy.sh >> /tmp/hang-tight-deploy.log 2>&1
```

With this, just `git push` from your dev machine and the Pi picks it up automatically.

---

## ESP32 Configuration

Update `firmware/platformio.ini` with the Pi's IP:

```ini
build_flags =
    -D WIFI_SSID="YourSSID"
    -D WIFI_PASSWORD="YourPassword"
    -D WS_SERVER="<pi-ip>"
    -D WS_PORT=3001
```

Build and upload:

```bash
cd firmware && pio run -t upload -e esp32
```

---

## Operations

### Service management (on the Pi)

```bash
sudo systemctl status hangboard        # check status
sudo systemctl restart hangboard       # restart
sudo journalctl -u hangboard -f        # live logs
```

### Or via SSH from dev machine

```bash
make status PI_HOST=<pi-ip>
make logs PI_HOST=<pi-ip>
```

### Database

```bash
# On the Pi
sqlite3 /opt/hang-tight/backend/data/hangboard.db "SELECT COUNT(*) FROM sessions;"

# Re-seed (destroys existing data)
cd /opt/hang-tight/backend
rm -f data/hangboard.db data/hangboard.db-wal
node scripts/init-db.js --seed
sudo systemctl restart hangboard
```

---

## Backup

The SQLite database is a single file at `backend/data/hangboard.db`.

```bash
# From the Pi
cp /opt/hang-tight/backend/data/hangboard.db ~/backup-$(date +%Y%m%d).db

# From dev machine (if SSH works)
scp pi@<pi-ip>:/opt/hang-tight/backend/data/hangboard.db ./backup.db
```

---

## Finding the Pi's IP Address

On the Pi:

```bash
hostname -I
```

Or from another device on the same network:

```bash
ping raspberrypi.local       # default hostname
ping hang-tight.local        # if you renamed it
```

---

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues.

| Problem                 | Fix                                                              |
| ----------------------- | ---------------------------------------------------------------- |
| Service won't start     | `sudo journalctl -u hangboard -n 50` to check logs               |
| `git pull` fails        | Check internet: `ping github.com`                                |
| Port 3001 not reachable | Check firewall: `sudo ufw status`, or just `sudo ufw allow 3001` |
| Permission denied       | `sudo chown -R pi:pi /opt/hang-tight`                            |
