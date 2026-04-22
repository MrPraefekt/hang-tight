# Troubleshooting Guide

## Backend Issues

### Port 3001 Already in Use

```bash
# Find and kill the process
lsof -ti:3001 | xargs kill -9

# Or change port in .env
PORT=3002
```

### Server Crashes on Startup

1. Check all dependencies are installed: `cd backend && npm install`
2. Check Node.js version: `node --version` (needs 18+)
3. Check logs for the specific error message

### WebSocket Connection Refused

1. Verify backend is running: `curl http://localhost:3001/health`
2. Test WebSocket directly: `npx wscat -c ws://localhost:3001`
3. Check firewall allows port 3001

---

## Frontend Issues

### Frontend Shows "Disconnected"

1. Verify backend is running
2. Check browser console (F12) for errors
3. Try hard refresh: Cmd+Shift+R

### npm install Fails

```bash
rm -rf node_modules package-lock.json
npm install
```

Check Node.js version: `node --version` (needs 18+)

### Vite Build Fails

```bash
rm -rf dist
npm run build 2>&1 | grep error
```

Verify all component imports exist in `src/components/`.

### Graph Not Displaying

1. Check WebSocket is connected (status indicator in header)
2. Start a session or simulation
3. Check browser console for Recharts errors

---

## Firmware Issues

### ESP32 Not Uploading

1. Try a different USB cable (some are charge-only)
2. Try a different USB port
3. Find correct port: `ls /dev/tty.usb*` (macOS) or `ls /dev/ttyUSB*` (Linux)
4. Upload with verbose: `pio run --verbose -t upload`

### WiFi Not Connecting

1. Verify credentials in `platformio.ini`
2. ESP32 supports **2.4 GHz only** (not 5 GHz)
3. Move closer to router
4. Check serial output: `pio device monitor -b 115200`

### WebSocket Connection Fails on ESP32

1. Use the backend machine's **local IP** (not `localhost`)
2. Verify backend is reachable: `curl http://<ip>:3001/health`
3. Check port matches (3001 by default)

### HX711 Not Reading

1. Check wiring: DT→GPIO 25, SCK→GPIO 26, VCC→3.3V, GND→GND
2. Verify load cell connections (Red=E+, Black=E−, Green=A+, White=A−)
3. HX711 needs ~1 second to stabilize after power-on

---

## Database Issues

### No Data / Empty Sessions

```bash
make seed   # resets and seeds the database
```

Or manually:

```bash
rm -f backend/data/hangboard.db backend/data/hangboard.db-wal
cd backend && node scripts/init-db.js --seed
```

### Database Locked

SQLite can lock briefly during writes. This is normal at 20 Hz write rates. The WAL mode minimizes this. If persistent:

1. Ensure only one backend process is running
2. Restart the backend

### Slow Queries

Check indexes exist:

```bash
sqlite3 backend/data/hangboard.db ".indexes"
```

Expected: `idx_samples_session_id`, `idx_samples_timestamp`, `idx_sessions_start_time`, `idx_calibration_created_at`

If missing, re-run: `node backend/scripts/init-db.js`

---

## Raspberry Pi Issues

### Service Won't Start

```bash
make logs   # or: ssh pi@hang-tight.local "sudo journalctl -u hangboard -n 50"
```

Common causes:

- Missing dependencies — run `make deploy` (full deploy with `npm install`)
- Wrong Node.js version — Pi needs Node.js 18+
- Permission denied on `data/` — `sudo chown -R pi:pi /opt/hang-tight`

### Can't SSH to Pi

```bash
ping hang-tight.local
# If no response, try the Pi's IP directly
ssh pi@192.168.1.50
```

### Database on Pi Seems Empty

The deploy excludes `*.db` files intentionally (to not overwrite Pi data). Seed on the Pi:

```bash
ssh pi@hang-tight.local "cd /opt/hang-tight && node scripts/init-db.js --seed"
```

---

## Performance Issues

### High Latency (>1 second)

1. Check network: `ping <backend-host>`
2. Reduce graph buffer size in frontend if needed
3. Check backend logs for slow operations

### High Memory Usage

1. Verify WebSocket clients disconnect properly
2. Check `backend/data/hangboard.db` size: `ls -lh backend/data/`
3. Archive old sessions if DB grows large

---

## Common Error Messages

| Error              | Meaning              | Fix                           |
| ------------------ | -------------------- | ----------------------------- |
| `EADDRINUSE :3001` | Port in use          | Kill process or change port   |
| `ECONNREFUSED`     | Backend not running  | Start backend                 |
| `CORS error`       | Cross-origin blocked | Check backend CORS config     |
| `SQLITE_BUSY`      | Database locked      | Ensure single backend process |
| `HX711 not ready`  | Sensor not connected | Check wiring                  |

---

## Still Stuck?

1. Check the relevant docs: [SETUP.md](SETUP.md), [DEPLOYMENT.md](DEPLOYMENT.md), [API.md](API.md)
2. Check backend logs: `cd backend && npx nodemon server.js`
3. Check browser console: F12 → Console tab
4. Check ESP32 serial: `pio device monitor -b 115200`
