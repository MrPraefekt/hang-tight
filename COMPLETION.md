# Project Summary

## Hangboard Force Measurement System

A local-first system for real-time grip strength monitoring, designed to run on a Raspberry Pi.

---

## What's Included

### ESP32 Firmware (`firmware/`)

- HX711 load cell reader at 80 Hz → 20 Hz output
- 4-sample moving average filter
- WebSocket client with auto-reconnect

### Backend Server (`backend/`)

- Express + WebSocket server
- SQLite database via `better-sqlite3` (WAL mode)
- REST API: calibration, sessions, simulation
- Serves built frontend as static files

### React Frontend (`frontend/`)

- Live force graph (Recharts)
- Session recording controls
- Calibration panel
- Simulation mode for testing without hardware
- Historical session browser
- Responsive dark theme

### Database (`backend/scripts/`)

- `init-db.js` — schema creation + seeding
- `seed.sql` — sample training data (SQLite)

### Deployment (`deploy/`, `Makefile`)

- `hangboard.service` — systemd unit for Raspberry Pi
- `make deploy` — build + rsync + restart
- `make pull-data` / `make pull-csv` — data export

### Documentation

- README, SETUP, QUICKSTART, DEPLOYMENT, API, ARCHITECTURE, TROUBLESHOOTING

---

## Technology Stack

| Layer      | Technology                           |
| ---------- | ------------------------------------ |
| Firmware   | Arduino C++ (PlatformIO)             |
| Backend    | Node.js 18+, Express, better-sqlite3 |
| Frontend   | React 18, Vite, Recharts             |
| Database   | SQLite (WAL mode)                    |
| Deployment | Makefile, rsync, systemd             |

---

## Quick Start

```bash
make install   # install deps
make seed      # create DB + sample data
make dev       # run backend + frontend
```

Open http://localhost:5173 → use Simulation panel to test.

---

## Deploy to Raspberry Pi

```bash
make pi-setup  # one-time setup
make deploy    # build + deploy + restart
```

---

## Key Design Decisions

- **SQLite over PostgreSQL** — no separate DB server, single-file database, perfect for embedded/Pi use
- **Makefile over CI/CD** — simple, transparent, no cloud dependencies
- **rsync over containers** — lightweight, fast, works over SSH
- **Static frontend serving** — backend serves React build, single port for everything
- **No authentication** — single-user local device, security via network isolation
