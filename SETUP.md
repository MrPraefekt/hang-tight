# Development Setup Guide

## Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org/)
- **Git** — [Download](https://git-scm.com/)
- **PlatformIO** (for ESP32 firmware): `pip install platformio`

## Quick Setup

```bash
make install   # npm install in backend/ and frontend/
make seed      # create SQLite DB with sample data
make dev       # run backend + frontend in parallel
```

Open http://localhost:5173 — done.

---

## Step-by-Step

### Backend

```bash
cd backend
npm install
node scripts/init-db.js --seed   # creates data/hangboard.db with sample data
npx nodemon server.js            # or: make dev (runs both)
```

Server runs on http://localhost:3001.

### Frontend

```bash
cd frontend
npm install
npx vite --host                  # or: make dev (runs both)
```

Frontend runs on http://localhost:5173. It proxies API requests to `localhost:3001` (configured in `vite.config.js`).

### ESP32 Firmware

```bash
cd firmware
# Edit platformio.ini with WiFi credentials and backend IP
pio run -t upload -e esp32
pio device monitor -b 115200
```

Use your machine's local IP (not `localhost`) for the WebSocket server address.

---

## Testing Without Hardware

1. Start backend and frontend (`make dev`)
2. Open http://localhost:5173
3. In the **Simulation** panel, select a session and click **Start Simulation**
4. Watch real-time data stream through the UI

---

## Database Management

### View data

```bash
sqlite3 backend/data/hangboard.db "SELECT * FROM sessions;"
sqlite3 backend/data/hangboard.db "SELECT COUNT(*) FROM samples;"
sqlite3 backend/data/hangboard.db "SELECT * FROM calibration ORDER BY created_at DESC LIMIT 1;"
```

### Reset database

```bash
rm -f backend/data/hangboard.db backend/data/hangboard.db-wal
make seed
```

---

## Testing API Endpoints

```bash
curl http://localhost:3001/health
curl http://localhost:3001/sessions
curl http://localhost:3001/calibration

curl -X POST http://localhost:3001/calibrate \
  -H "Content-Type: application/json" \
  -d '{"offset": 1000, "scale": 0.001}'

curl -X POST http://localhost:3001/session/start
curl -X POST http://localhost:3001/session/stop

curl -X POST http://localhost:3001/simulate/start \
  -H "Content-Type: application/json" \
  -d '{"session_id": 1}'
curl -X POST http://localhost:3001/simulate/stop
```

## WebSocket Testing

```bash
npx wscat -c ws://localhost:3001
```

---

## Common Issues

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed solutions.

| Issue                 | Quick Fix                                              |
| --------------------- | ------------------------------------------------------ |
| Port 3001 in use      | `lsof -ti:3001 \| xargs kill -9`                       |
| No sample data        | `make seed`                                            |
| Frontend disconnected | Verify backend is running, check browser console       |
| npm install fails     | `rm -rf node_modules package-lock.json && npm install` |
