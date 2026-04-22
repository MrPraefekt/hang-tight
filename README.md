# Hangboard Force Measurement System

A complete system for real-time grip strength monitoring using HX711 load cells, WebSocket streaming, and a local SQLite database — designed to run on a Raspberry Pi.

## Overview

This project provides an end-to-end solution for measuring and analyzing force data from hangboard training:

- **ESP32 Firmware** — Reads HX711 load cell at 80 Hz, outputs at 20 Hz
- **Node.js Backend** — WebSocket server with calibration, sessions, and simulation
- **React Frontend** — Real-time visualization and control interface
- **SQLite Database** — Lightweight local storage via `better-sqlite3`

### Key Features

- Real-time force measurement and visualization
- Automatic calibration workflow
- Session recording and historical analysis
- Simulation mode for testing without hardware
- WebSocket-based live data streaming
- One-command deployment to Raspberry Pi
- CSV export for external analysis

---

## Project Structure

```
hang-tight/
├── firmware/                  # ESP32 Arduino code
│   ├── main.cpp              # HX711 reader + WebSocket client
│   └── platformio.ini        # Build configuration
│
├── backend/                  # Node.js server
│   ├── server.js             # Express + WebSocket + SQLite
│   ├── package.json
│   ├── scripts/
│   │   ├── init-db.js        # Schema creation + seeding
│   │   └── seed.sql          # Sample training data (SQLite)
│   └── data/                 # SQLite database (auto-created)
│
├── frontend/                 # React + Vite UI
│   ├── src/
│   │   ├── App.jsx
│   │   ├── index.css
│   │   ├── main.jsx
│   │   └── components/
│   │       ├── LiveMonitor.jsx
│   │       ├── SessionManager.jsx
│   │       ├── CalibrationPanel.jsx
│   │       ├── SimulationPanel.jsx
│   │       └── HistoricalData.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
│
├── deploy/
│   └── hangboard.service     # systemd unit for Raspberry Pi
│
├── Makefile                  # Dev, build, deploy, seed commands
├── README.md
├── ARCHITECTURE.md
├── SETUP.md
├── QUICKSTART.md
├── DEPLOYMENT.md
├── API.md
├── TROUBLESHOOTING.md
└── LICENSE
```

---

## Quick Start

### Prerequisites

- **Node.js 18+**
- **Git**
- (Optional) ESP32 + HX711 for live hardware

### 1. Install & Seed

```bash
make install
make seed
```

### 2. Run Development

```bash
make dev
```

This starts the backend (port 3001) and frontend (port 5173) in parallel.

### 3. Test Without Hardware

Open http://localhost:5173, go to the **Simulation** panel, select a session, and click **Start Simulation**. Data will stream as if from real hardware.

---

## System Architecture

```
┌─────────────┐
│   ESP32     │  80 Hz sampling → 20 Hz output
│  + HX711    │
└──────┬──────┘
       │ WebSocket (raw data)
       ▼
┌──────────────────────┐
│   Backend Server     │  Node.js + Express
│   - Calibration      │  SQLite (better-sqlite3)
│   - Session Mgmt     │
│   - Broadcast        │
└──────┬───────────┬───┘
       │ WS        │ REST
       ▼           ▼
┌─────────────────────┐
│   Frontend (React)  │  Recharts live graph
│   - Live display    │
│   - Controls        │
└─────────────────────┘
```

All data is stored locally in `backend/data/hangboard.db` (SQLite, WAL mode).

---

## Calibration

**Formula**: `force = (raw - offset) × scale`

1. Remove all load from the sensor
2. Note the raw ADC value → this is your **offset**
3. Place a known weight (e.g. 10 N) on the sensor
4. Calculate: `scale = known_weight / (loaded_raw - offset)`
5. Enter offset and scale in the Calibration panel and save

---

## Simulation Mode

Test the full data pipeline without any hardware:

```bash
curl -X POST http://localhost:3001/simulate/start \
  -H "Content-Type: application/json" \
  -d '{"session_id": 1}'
```

Or use the Simulation panel in the frontend UI.

---

## Database Schema (SQLite)

```sql
sessions   (id, start_time, end_time, created_at, updated_at)
samples    (id, session_id, timestamp, raw, force, created_at)
calibration(id, offset, scale, created_at, updated_at)
```

Indexes on `samples(session_id)`, `samples(timestamp)`, `sessions(start_time)`, `calibration(created_at)`.

---

## Deployment

The system is designed to run on a **Raspberry Pi** on your local network.

```bash
make deploy              # Build frontend, rsync to Pi, restart service
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for full Pi setup instructions.

---

## Hardware Wiring

### ESP32 → HX711

| ESP32 Pin | HX711 Pin   |
| --------- | ----------- |
| GPIO 25   | DT (Data)   |
| GPIO 26   | SCK (Clock) |
| 3.3V      | VCC         |
| GND       | GND         |

### HX711 → Load Cell

Connect per strain gauge color code: Red (E+), Black (E−), Green (A+), White (A−).

---

## Technical Stack

| Component | Technology                       |
| --------- | -------------------------------- |
| Firmware  | Arduino C++ (PlatformIO)         |
| Backend   | Node.js, Express, better-sqlite3 |
| Frontend  | React 18, Vite, Recharts         |
| Database  | SQLite (WAL mode)                |
| Deploy    | Makefile + rsync + systemd       |

---

## Documentation

- [QUICKSTART.md](QUICKSTART.md) — Minimal steps to get running
- [SETUP.md](SETUP.md) — Detailed development setup
- [DEPLOYMENT.md](DEPLOYMENT.md) — Raspberry Pi deployment
- [API.md](API.md) — REST & WebSocket reference
- [ARCHITECTURE.md](ARCHITECTURE.md) — System design & data flow
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — Common issues & fixes

---

## License

MIT License — see [LICENSE](LICENSE)
