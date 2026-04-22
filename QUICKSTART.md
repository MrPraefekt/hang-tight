# Quick Start

## Setup & Run (3 commands)

```bash
make install          # install dependencies
make seed             # create database with sample data
make dev              # start backend + frontend
```

Open http://localhost:5173 and use **Simulation** panel to test.

---

## Useful Commands

### Development

```bash
make dev              # backend (nodemon) + frontend (vite) in parallel
make build            # build frontend into backend/public/
make clean            # remove build artifacts
```

### Database

```bash
make seed             # reset and seed SQLite database
sqlite3 backend/data/hangboard.db "SELECT * FROM sessions;"
```

### Deployment (Raspberry Pi)

```bash
make pi-setup         # one-time Pi setup (Node.js, systemd)
make deploy           # build + rsync + restart service
make deploy-quick     # rsync only (skip npm install on Pi)
make logs             # tail Pi service logs
make status           # check Pi service status
```

### Data Export

```bash
make pull-data        # copy Pi database to local
make pull-csv         # export to CSV files
```

### Firmware

```bash
cd firmware
pio run -t upload     # build and upload to ESP32
pio device monitor    # serial output
```

### API Testing

```bash
curl http://localhost:3001/health
curl http://localhost:3001/sessions
curl -X POST http://localhost:3001/session/start
curl -X POST http://localhost:3001/session/stop
curl -X POST http://localhost:3001/simulate/start \
  -H "Content-Type: application/json" -d '{"session_id": 1}'
```

---

## Documentation

- [README.md](README.md) — Project overview
- [SETUP.md](SETUP.md) — Detailed dev setup
- [DEPLOYMENT.md](DEPLOYMENT.md) — Raspberry Pi deployment
- [API.md](API.md) — API reference
- [ARCHITECTURE.md](ARCHITECTURE.md) — System design
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — Fixing problems
